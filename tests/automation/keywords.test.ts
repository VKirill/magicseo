import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderKeywords, toKeywordsCsv } from '../../lib/automation/keywords.ts';

test('renderKeywords replaces %город% and %в_городе%, trims and drops duplicates keeping order', () => {
  const keywords = renderKeywords(
    ['оркестр при свечах %город%', 'концерт %в_городе%', 'оркестр при свечах %город%'],
    { gorod: 'Воткинск', vGorode: 'в Воткинске' },
  );
  assert.deepEqual(keywords, ['оркестр при свечах Воткинск', 'концерт в Воткинске']);
});

test('toKeywordsCsv writes one keyword per line with trailing newline and no header', () => {
  assert.equal(toKeywordsCsv(['a b', 'c']), 'a b\nc\n');
});
