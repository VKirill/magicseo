import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportRows, toCsv } from '../../lib/positions/report.ts';

const PROJECTS = [
  { id: 527041, domain: 'proart-show.ru', region: 213, name: '[Москва] PRO АРТ' },
  { id: 527050, domain: 'proart-show.ru', region: 2, name: '[СПб] PRO АРТ' },
  { id: 600001, domain: 'museshow.ru', region: 213, name: '[Москва] MUSESHOW' },
];

function memoryKv(seed: Record<string, unknown>) {
  const store = new Map<string, unknown>(Object.entries(seed));
  return {
    store,
    async get(key: string) {
      return store.get(key);
    },
    async set(key: string, value: unknown) {
      store.set(key, value);
    },
  };
}

const check = (pc: number | null, mobile: number | null, url: string) => ({ pc, mobile, url });

const kv = memoryKv({
  'pos:527041:2026-06': {
    'оркестр при свечах': {
      '2026-06-17': check(101, 4, 'https://proart-show.ru/orkestr'),
      '2026-06-18': check(5, 6, 'https://proart-show.ru/orkestr'),
    },
    'свечи, 3000 шт': { '2026-06-17': check(12, 15, 'https://proart-show.ru/svechi') },
  },
  'pos:527041:2026-07': {
    'оркестр при свечах': { '2026-07-13': check(3, 101, 'https://proart-show.ru/orkestr') },
  },
  'pos:527050:2026-06': {
    'оркестр при свечах': { '2026-06-18': check(7, 9, 'https://proart-show.ru/spb') },
  },
  'pos:600001:2026-06': {
    'музыкальный шоу': { '2026-06-18': check(2, 3, 'https://museshow.ru/') },
  },
});

test('reportRows filters by domain', async () => {
  const rows = await reportRows(kv, PROJECTS, { domain: 'proart-show.ru', from: '2026-06-01', to: '2026-07-31' });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.site === 'proart-show.ru'));
  assert.ok(rows.some((r) => r.city === 'Москва') && rows.some((r) => r.city === 'Санкт-Петербург'));
});

test('reportRows filters by region and the city comes from cityByRegion', async () => {
  const rows = await reportRows(kv, PROJECTS, {
    domain: 'proart-show.ru',
    region: 213,
    from: '2026-06-01',
    to: '2026-07-31',
  });
  assert.deepEqual(
    rows.map((r) => [r.keyword, r.date, r.pcPosition, r.mobilePosition]),
    [
      ['оркестр при свечах', '2026-06-17', 101, 4],
      ['оркестр при свечах', '2026-06-18', 5, 6],
      ['оркестр при свечах', '2026-07-13', 3, 101],
      ['свечи, 3000 шт', '2026-06-17', 12, 15],
    ],
  );
  assert.ok(rows.every((r) => r.city === 'Москва'));
});

test('reportRows filters by keyword substring and by date range', async () => {
  const exactKeyword = await reportRows(kv, PROJECTS, {
    domain: 'proart-show.ru',
    region: 213,
    keyword: '3000',
    from: '2026-06-01',
    to: '2026-07-31',
  });
  assert.deepEqual(
    exactKeyword.map((r) => [r.keyword, r.date]),
    [['свечи, 3000 шт', '2026-06-17']],
  );
  const substringInRange = await reportRows(kv, PROJECTS, {
    domain: 'proart-show.ru',
    region: 213,
    keyword: 'свеч',
    from: '2026-06-18',
    to: '2026-07-13',
  });
  assert.deepEqual(
    substringInRange.map((r) => [r.keyword, r.date]),
    [
      ['оркестр при свечах', '2026-06-18'],
      ['оркестр при свечах', '2026-07-13'],
    ],
  );
});

test('toCsv starts with the exact header and quotes a keyword containing a comma', async () => {
  const rows = await reportRows(kv, PROJECTS, {
    domain: 'proart-show.ru',
    region: 213,
    from: '2026-06-01',
    to: '2026-07-31',
  });
  const csv = toCsv(rows);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'site,city,keyword,date,pc_position,mobile_position,found_url');
  assert.ok(
    lines.includes('proart-show.ru,Москва,"свечи, 3000 шт",2026-06-17,12,15,https://proart-show.ru/svechi'),
    'comma keyword must be double-quoted',
  );
  assert.ok(csv.includes(',101,'), 'position 101 is kept as 101 in the CSV');
  const withNull = toCsv([
    { site: 's', city: 'c', keyword: 'k', date: '2026-06-17', pcPosition: null, mobilePosition: 4, foundUrl: 'u' },
  ]);
  assert.equal(withNull, 'site,city,keyword,date,pc_position,mobile_position,found_url\ns,c,k,2026-06-17,,4,u\n');
});
