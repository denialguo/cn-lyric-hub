import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLyricMetadata, validateLyricSource } from './lyricMetadata.js';

function expectKind(source, kind, context = {}) {
  const issues = detectLyricMetadata(source, context);
  assert.ok(issues.some(x => x.kind === kind), JSON.stringify(issues));
}

test('recording personnel and studios in imported Jay Chou preamble are flagged without deleting lyrics', () => {
  const lyrics = '周杰伦\n蔡科俊Again\n杨瑞代\n杨大纬录音工作室\n第一句歌词\n第二句歌词';
  const original = lyrics;
  expectKind(lyrics, 'studio_preamble', { title: '双刀', artist: 'Jay Chou' });
  assert.equal(lyrics, original);
  assert.equal(validateLyricSource(lyrics).ok, false);
});

test('source-site boilerplate and KRC credits are flagged', () => {
  expectKind('和平与爱\n欢迎您\n呼吸着春风吹送那芬芳', 'site_boilerplate', { title: '和平与爱' });
  expectKind('丝丝小雨\nKRC 制作阿林\n一阵阵绵绵细雨', 'recording_credit');
  expectKind('今天我心情很好\nwww.example.com', 'site_boilerplate');
});

test('instrumental markers, trailing END, and standalone markup are flagged', () => {
  expectKind('第一句\n（ MUSIC )\n第二句', 'instrumental_marker');
  expectKind('你好\n- END -', 'end_marker');
  expectKind('你好\n]', 'stray_markup');
});

test('artist/title headers trigger manual review rather than deletion', () => {
  const lyrics = '人来人往\n\n朋友已走';
  const issues = detectLyricMetadata(lyrics, { title: '人来人往', artist: 'Eason Chan' });
  assert.ok(issues.some(x => x.kind === 'possible_title_header' && x.confidence === 'review'));
  assert.ok(lyrics.includes('朋友已走'));
});

test('sung words, colloquial and Cantonese source text are preserved', () => {
  const safe = [
    '我说我要一个大大的飞机 但却得到一台旧旧录音机',
    '他说作曲就是我的命',
    '旧日的足迹\n即使前方路难行',
    'ㄖㄨㄟ ㄙㄡ ㄙㄡ ㄒ一 ㄉㄡ',
    '风 吹过麦田\n空空两手来 挥手归去',
    '今天我在studio录音 只为唱给你听',
    'This is a song in English and Cantonese\n係咪真係咁樣',
  ];
  for (const value of safe) assert.equal(detectLyricMetadata(value).length, 0, value);
});

test('standalone song-title line with additional performed chorus is review-only', () => {
  const issues = detectLyricMetadata('简简单单\n我们只是简单相爱', { title: '简简单单' });
  assert.equal(issues.some(x => x.confidence === 'high'), false);
  assert.ok(issues.some(x => x.confidence === 'review'));
});

test('unrelated later mentions of credits do not trigger high confidence', () => {
  assert.deepEqual(detectLyricMetadata('我要写这首歌\n录音师来了也不怕\n我还在唱'), []);
});

test('empty sources are safe for optional fields', () => {
  assert.deepEqual(detectLyricMetadata(''), []);
  assert.equal(validateLyricSource('').ok, true);
});

test('source recognizer provides stable 1-based line numbers', () => {
  const result = detectLyricMetadata('第一句\n第二句\n录音：小王\n第三句');
  assert.equal(result.find(x => x.kind === 'recording_credit')?.line_number, 3);
});
