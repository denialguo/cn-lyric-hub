import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesLine, selectedLineTranslation } from './lineAnchors.js';

test('anchors reject reorders, rewritten/deleted lines and unverified legacy data', () => {
  const row = { line_index: 1, original_line: '愛你' };
  assert.equal(matchesLine(row, ['你好', '愛你']), true);
  for (const lines of [['愛你', '你好'], ['你好', '想你'], ['你好'], []]) {
    assert.equal(matchesLine(row, lines), false);
  }
  assert.equal(matchesLine({ line_index: 0 }, ['你好']), false);
  assert.equal(matchesLine({ line_index: -1, original_line: '' }, ['']), false);
  assert.equal(matchesLine({ line_index: 0, original_line: '' }, ['']), true);
  assert.equal(selectedLineTranslation('legacy choice', '愛你'), null);
  const choice = { content: 'Love you', original_line: '愛你' };
  assert.equal(selectedLineTranslation(choice, '愛你'), 'Love you');
  assert.equal(selectedLineTranslation(choice, '想你'), null);
  assert.equal(selectedLineTranslation(null, '愛你'), null);
});
