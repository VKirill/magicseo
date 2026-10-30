import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toJson } from '../lib/json.ts';

test('toJson drops nested undefined, keeps null and array order', () => {
  const value = { a: 1, b: undefined, c: { d: undefined, e: null }, f: [1, { g: undefined }] };
  assert.throws(() => assert.deepStrictEqual(JSON.parse(JSON.stringify(value)), value));
  const json = toJson(value);
  assert.deepStrictEqual(json, { a: 1, c: { e: null }, f: [1, {}] });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(json)), json);
});
