import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig, DEFAULT_CONFIG } from '../lib/config.ts';

test('parseConfig({}) deep-equals DEFAULT_CONFIG', () => {
  assert.deepStrictEqual(parseConfig({}), DEFAULT_CONFIG);
});

test('a second site given only id, domain and concerts.baseUrl is filled from defaults', () => {
  const cfg = parseConfig({
    sites: [
      {
        id: 'atmosphere-show',
        domain: 'atmosphere-show.ru',
        concerts: { baseUrl: 'https://atmosphere-show.ru' },
      },
      { id: 'other', domain: 'example.ru', concerts: { baseUrl: 'https://example.ru' } },
    ],
  });
  assert.equal(cfg.sites.length, 2);
  const s = cfg.sites[1];
  assert.equal(s.id, 'other');
  assert.equal(s.domain, 'example.ru');
  assert.equal(s.concerts.baseUrl, 'https://example.ru');
  assert.equal(s.concerts.postType, 'concerts');
  assert.equal(s.concerts.credentialName, null);
  assert.equal(s.mode, 'dry-run');
  assert.equal(s.stopHoursBefore, 48);
  assert.equal(s.newProject, null);
  assert.deepEqual(s.cityAliases, { 'СПб': 'Санкт-Петербург' });
  assert.deepEqual(s.regionOverrides, {});
});

test('parseConfig throws on mode auto', () => {
  assert.throws(() =>
    parseConfig({
      sites: [
        {
          id: 'x',
          domain: 'example.ru',
          concerts: { baseUrl: 'https://example.ru' },
          mode: 'auto',
        },
      ],
    }),
  );
});
