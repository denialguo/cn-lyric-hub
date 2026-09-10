import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isChinese, generatePinyin, alignSyllables, generateCharacterPinyin } from './lyrics.js';

test('isChinese covers CJK including Ext-B, and excludes lookalikes', () => {
  for (const c of ['你', '㐀', '豈', '𠀀', '𣏕']) assert.ok(isChinese(c), `${c} should be Han`);
  for (const c of ['ａ', '，', '、', 'ㄅ', 'あ', '한', 'a', '1']) assert.ok(!isChinese(c), `${c} should not be Han`);
});

test('a code-point spread never splits a surrogate pair', () => {
  // LyricLine relies on this: .split('') would yield two broken halves.
  assert.equal([...'𠀀'].length, 1);
  assert.equal('𠀀'.split('').length, 2);
});

test('generatePinyin resolves polyphones by word context', async () => {
  assert.equal((await generatePinyin('音乐')), 'yīn yuè');   // not "yīn lè"
  assert.equal((await generatePinyin('银行')), 'yín háng');  // not "yín xíng"
  assert.equal((await generatePinyin('长大')), 'zhǎng dà');  // not "cháng dà"
});

test('generatePinyin applies tone sandhi', async () => {
  assert.equal((await generatePinyin('不是')), 'bú shì');
  assert.equal((await generatePinyin('一个')), 'yí gè');
});

test('generatePinyin passes Latin through untouched', async () => {
  assert.match((await generatePinyin('Baby 别哭')), /^Baby /);
});

test('generatePinyin preserves line count exactly', async () => {
  // The load-bearing invariant: lyrics_chinese and lyrics_pinyin are parallel
  // \n-delimited columns and nothing in Postgres enforces equal line counts.
  const zh = '一\n\n二\n三\n';
  assert.equal((await generatePinyin(zh)).split('\n').length, zh.split('\n').length);
});

test('generatePinyin maps a blank line to an empty string', async () => {
  assert.equal((await generatePinyin('一\n\n二')).split('\n')[1], '');
});

test('alignSyllables maps one syllable per Han character', () => {
  assert.deepEqual(alignSyllables('浪奔', 'làng bēn'), ['làng', 'bēn']);
});

test('alignSyllables splits on punctuation, not just whitespace', () => {
  // Regression: "nǎ，shān" has no space, so a whitespace-only split fused two
  // syllables into one token and dropped the whole line to the fallback.
  assert.deepEqual(
    alignSyllables('咿哪，山对山来崖对崖', 'yī nǎ，shān duì shān lái yá duì yá'),
    ['yī', 'nǎ', 'shān', 'duì', 'shān', 'lái', 'yá', 'duì', 'yá'],
  );
  assert.deepEqual(
    alignSyllables('啊...手执欢乐', 'a...shǒu zhí huān lè'),
    ['a', 'shǒu', 'zhí', 'huān', 'lè'],
  );
});

test('alignSyllables ignores Latin words carried through from the lyric', () => {
  assert.deepEqual(alignSyllables('Baby 别哭', 'Baby bié kū'), ['bié', 'kū']);
  assert.deepEqual(alignSyllables('我love你', 'wǒ love nǐ'), ['wǒ', 'nǐ']);
});

test('alignSyllables returns null when it cannot match, so the caller falls back', () => {
  assert.equal(alignSyllables('浪奔流', 'làng bēn'), null);        // too few
  assert.equal(alignSyllables('浪奔', 'làng bēn liú'), null);      // too many
  assert.equal(alignSyllables('浪奔', ''), null);                  // no pinyin
  assert.equal(alignSyllables('', 'làng'), null);                  // no lyric
  assert.equal(alignSyllables('hello', 'hello'), null);            // no Han at all
  // Word-grouped pinyin ("píngguǒ" for 蘋果) cannot be split; falling back is correct.
  assert.equal(alignSyllables('蘋果', 'píngguǒ'), null);
});

test('round trip: generated pinyin always aligns with its own line', async () => {
  for (const line of ['浪奔', '萬里滔滔江水永不休', '音乐让我快乐', '你好，世界']) {
    const syllables = alignSyllables(line, (await generatePinyin(line)));
    assert.ok(syllables, `expected ${line} to align`);
    assert.equal(syllables.length, [...line].filter(isChinese).length);
  }
});

test('lazy character fallback handles grouped pinyin and supplementary Han', async () => {
  assert.deepEqual(await generateCharacterPinyin('Baby 音乐!'), ['yīn', 'lè']);
  assert.equal((await generateCharacterPinyin('𠀀')).length, 1);
});
