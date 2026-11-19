import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeSubmissionArtists,
  legacySubmissionArtists,
  submissionArtists,
} from './submissionArtists.js';

test('serializeSubmissionArtists preserves which artist is missing a Chinese name', () => {
  assert.deepEqual(serializeSubmissionArtists([
    { id: null, name_en: 'The Weeknd', name_zh: '', isNew: true },
    { id: 'faye-id', name_en: 'Faye Wong', name_zh: '王菲' },
  ]), [
    { id: null, name_en: 'The Weeknd', name_zh: '', isNew: true },
    { id: 'faye-id', name_en: 'Faye Wong', name_zh: '王菲', isNew: false },
  ]);
});

test('legacy mismatch never shifts one Chinese name onto the wrong English artist', () => {
  const faye = { id: 'faye-id', name_en: 'Faye Wong', name_zh: '王菲' };
  assert.deepEqual(
    legacySubmissionArtists(
      { artist_en: 'The Weeknd, Faye Wong', artist_zh: '王菲' },
      [faye]
    ),
    [
      { id: null, name_en: 'The Weeknd', name_zh: '', isNew: true },
      faye,
    ]
  );
});

test('legacy equal-length lists can still be paired positionally', () => {
  assert.deepEqual(
    legacySubmissionArtists(
      { artist_en: 'Jay Chou, JJ Lin', artist_zh: '周杰伦, 林俊杰' },
      []
    ),
    [
      { id: null, name_en: 'Jay Chou', name_zh: '周杰伦', isNew: true },
      { id: null, name_en: 'JJ Lin', name_zh: '林俊杰', isNew: true },
    ]
  );
});

test('structured artist_data wins over lossy legacy display strings', () => {
  assert.deepEqual(
    submissionArtists({
      artist_en: 'The Weeknd, Faye Wong',
      artist_zh: '王菲',
      artist_data: [
        { id: null, name_en: 'The Weeknd', name_zh: '', isNew: true },
        { id: 'faye-id', name_en: 'Faye Wong', name_zh: '王菲', isNew: false },
      ],
    }),
    [
      { id: null, name_en: 'The Weeknd', name_zh: '', isNew: true },
      { id: 'faye-id', name_en: 'Faye Wong', name_zh: '王菲', isNew: false },
    ]
  );
});
