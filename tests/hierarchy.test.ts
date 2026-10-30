import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildHierarchy, rowsFromCatalog, type ProjectRow } from '../lib/hierarchy.ts';

function row(overrides: Partial<ProjectRow> & Pick<ProjectRow, 'id' | 'name' | 'domain' | 'region'>): ProjectRow {
  return {
    active: false,
    keywords: 0,
    periodSpent: 0,
    totalSpent: 0,
    lastJobStatus: null,
    ...overrides,
  };
}

test('buildHierarchy groups by site, configured site first, projects sorted by city', () => {
  const rows: ProjectRow[] = [
    row({ id: 1, name: 'ПРО АРТ [Новокузнецк]', domain: 'proart-show.ru', region: 237 }),
    row({ id: 2, name: 'MUSESHOW Москва', domain: 'museshow.ru', region: 213 }),
    row({
      id: 3,
      name: 'Аура [Москва]',
      domain: 'atmosphere-show.ru',
      region: 213,
      active: true,
      keywords: 5,
      periodSpent: 10,
      totalSpent: 20,
      lastJobStatus: 2,
    }),
    row({ id: 4, name: 'Аура [СПб]', domain: 'atmosphere-show.ru', region: 2 }),
    row({ id: 5, name: 'Эльбрус тур', domain: 'atmosphere-show.ru', region: 999999 }),
  ];
  const sites = buildHierarchy(rows, ['atmosphere-show.ru']);
  assert.equal(sites.length, 3);
  assert.equal(sites[0].domain, 'atmosphere-show.ru');
  assert.equal(sites[0].configured, true);
  assert.deepEqual(
    sites.map((s) => s.configured),
    [true, false, false],
  );
  assert.deepEqual(sites.slice(1).map((s) => s.domain), ['proart-show.ru', 'museshow.ru']);
  assert.deepEqual(sites[0].projects.map((p) => p.city), ['Москва', 'Санкт-Петербург', 'Эльбрус тур']);
  const first = sites[0].projects[0];
  assert.equal(first.id, 3);
  assert.equal(first.active, true);
  assert.equal(first.keywords, 5);
  assert.equal(first.periodSpent, 10);
  assert.equal(first.totalSpent, 20);
  assert.equal(first.lastJobStatus, 2);
});

test('rowsFromCatalog reads catalog_items and counts money in rubles', () => {
  const sample = JSON.parse(readFileSync(new URL('./fixtures/catalog-items.json', import.meta.url), 'utf8'));
  const rows = rowsFromCatalog(sample, { 544055: true });
  const selfy = rows.find((r) => r.name === 'SelfyStudio');
  assert.ok(selfy, 'SelfyStudio row must be present');
  assert.equal(selfy.totalSpent, 798);
  assert.equal(selfy.periodSpent, 798);
  assert.equal(selfy.region, 213);
  assert.equal(selfy.active, true);
  assert.equal(selfy.keywords, 23);
  assert.equal(selfy.lastJobStatus, 2);
  assert.ok(rows.some((r) => r.domain === 'proart-show.ru'));
});
