import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCity, cityByRegion, concertStartUtc } from '../../lib/cities/index.ts';
import fixture from '../fixtures/atmosphere-cities.json' with { type: 'json' };

test('every single-candidate city resolves to its region and a valid IANA timeZone', () => {
  const singles = fixture.cities.filter((c) => c.yandexRegionCandidates.length === 1);
  assert.equal(singles.length, 143);
  for (const c of singles) {
    const r = resolveCity(c.name);
    assert.ok(r, `resolveCity(${c.name}) returned null`);
    assert.equal(r.name, c.name);
    assert.equal(r.region, c.yandexRegionCandidates[0]);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: r.timeZone }), c.name);
  }
});

test('cities with 0 or 2+ candidates resolve to null', () => {
  const ambiguous = fixture.cities.filter((c) => c.yandexRegionCandidates.length !== 1);
  assert.equal(ambiguous.length, 9);
  for (const c of ambiguous) {
    assert.equal(resolveCity(c.name), null, c.name);
  }
});

test('resolveCity known regions, aliases and overrides', () => {
  assert.equal(resolveCity('Москва')?.region, 213);
  assert.equal(resolveCity('Санкт-Петербург')?.region, 2);
  assert.equal(resolveCity('Воткинск')?.region, 11149);
  assert.equal(resolveCity('Воткинск')?.timeZone, 'Europe/Samara');
  assert.equal(resolveCity('СПб'), null);
  assert.equal(
    resolveCity('СПб', { aliases: { 'СПб': 'Санкт-Петербург' } })?.name,
    'Санкт-Петербург',
  );
  assert.equal(resolveCity('Киров'), null);
  assert.equal(resolveCity('Киров', { regionOverrides: { 'Киров': 46 } })?.region, 46);
  assert.equal(resolveCity('Несуществующий'), null);
});

test('cityByRegion', () => {
  assert.equal(cityByRegion(213), 'Москва');
  assert.equal(cityByRegion(2), 'Санкт-Петербург');
  assert.equal(cityByRegion(999999), null);
});

test('concertStartUtc converts city local time to UTC', () => {
  const c = { date: '2027-01-31', time: '19:00' };
  assert.equal(concertStartUtc(c, 'Europe/Samara').toISOString(), '2027-01-31T15:00:00.000Z');
  assert.equal(concertStartUtc(c, 'Asia/Novosibirsk').toISOString(), '2027-01-31T12:00:00.000Z');
  assert.equal(concertStartUtc(c, 'Europe/Moscow').toISOString(), '2027-01-31T16:00:00.000Z');
});
