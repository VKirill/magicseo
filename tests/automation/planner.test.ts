import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Concert } from '../../lib/concerts/wordpress.ts';
import type { SiteConfig } from '../../lib/config.ts';
import { planSite, type Action, type CityProject } from '../../lib/automation/planner.ts';

const NOW = new Date('2027-01-29T12:00:00Z');

const SITE: SiteConfig = {
  id: 'atmosphere-show',
  domain: 'atmosphere-show.ru',
  concerts: { baseUrl: 'https://atmosphere-show.ru', postType: 'concerts', credentialName: null },
  nameTemplate: 'Концерт %город% — atmosphere-show.ru',
  keywordTemplates: ['оркестр при свечах %город%', '3000 свечей %город%'],
  cityAliases: {},
  regionOverrides: {},
  timeZoneOverrides: {},
  mode: 'dry-run',
  stopHoursBefore: 48,
  newProject: null,
};

function concert(over: Partial<Concert> & { city: string }): Concert {
  return {
    id: 1,
    status: 'publish',
    link: 'https://atmosphere-show.ru/koncert/',
    cityIn: `в ${over.city}`,
    date: '2027-02-03',
    time: '19:00',
    soldOut: false,
    postponedTo: null,
    modifiedGmt: '2026-10-01T00:00:00Z',
    ...over,
  };
}

function project(over: Partial<CityProject> & { id: number; region: number }): CityProject {
  return { name: `Проект ${over.id}`, domain: SITE.domain, active: true, ...over };
}

function plan(concerts: Concert[], projects: CityProject[] = []): Action[] {
  return planSite({ site: SITE, concerts, projects, now: NOW });
}

test('city without a project and a concert 5 days ahead: create then start with name, region and keywords', () => {
  const actions = plan([
    concert({ city: 'Воткинск', date: '2027-02-03', time: '19:00' }), // 15:00Z, 5d 3h ahead
  ]);
  assert.equal(actions.length, 2);
  const [create, start] = actions;
  assert.equal(create.kind, 'create');
  assert.equal(create.city, 'Воткинск');
  assert.equal(create.region, 11149);
  assert.equal(create.projectId, null);
  assert.equal(create.name, 'Концерт Воткинск — atmosphere-show.ru');
  assert.deepEqual(create.keywords, ['оркестр при свечах Воткинск', '3000 свечей Воткинск']);
  assert.equal(create.nearestStartUtc, '2027-02-03T15:00:00.000Z');
  assert.equal(start.kind, 'start');
  assert.equal(start.region, 11149);
  assert.equal(start.projectId, null);
});

test('inactive project with a concert 49 h ahead: start', () => {
  const actions = plan(
    [concert({ city: 'Москва', date: '2027-01-31', time: '16:00' })], // 13:00Z = +49 h
    [project({ id: 5, region: 213, active: false })],
  );
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, 'start');
  assert.equal(actions[0].projectId, 5);
  assert.equal(actions[0].nearestStartUtc, '2027-01-31T13:00:00.000Z');
});

test('active project with the nearest concert 47 h ahead and a second one 10 days ahead: stop', () => {
  const actions = plan(
    [
      concert({ id: 1, city: 'Москва', date: '2027-01-31', time: '14:00' }), // 11:00Z = +47 h
      concert({ id: 2, city: 'Москва', date: '2027-02-08', time: '15:00' }), // 12:00Z = +10 d
    ],
    [project({ id: 5, region: 213, active: true })],
  );
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, 'stop');
  assert.equal(actions[0].projectId, 5);
  assert.equal(actions[0].nearestStartUtc, '2027-01-31T11:00:00.000Z');
});

test('concert exactly 48 h ahead: stop; a minute later it would be start', () => {
  const exact = plan(
    [concert({ city: 'Москва', date: '2027-01-31', time: '15:00' })], // 12:00Z = +48 h
    [project({ id: 5, region: 213, active: true })],
  );
  assert.equal(exact.length, 1);
  assert.equal(exact[0].kind, 'stop');

  const later = plan(
    [concert({ city: 'Москва', date: '2027-01-31', time: '15:01' })],
    [project({ id: 5, region: 213, active: false })],
  );
  assert.equal(later.length, 1);
  assert.equal(later[0].kind, 'start');
});

test('draft concert or published concert without a link: no action for that city', () => {
  const actions = plan([
    concert({ id: 1, city: 'Самара', status: 'draft' }),
    concert({ id: 2, city: 'Сочи', link: '' }),
  ]);
  assert.deepEqual(actions, []);
});

test('active project with no future concert: stop', () => {
  const actions = plan(
    [concert({ city: 'Санкт-Петербург', date: '2027-01-01', time: '19:00' })], // past
    [project({ id: 7, region: 2, active: true })],
  );
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, 'stop');
  assert.equal(actions[0].projectId, 7);
  assert.equal(actions[0].reason, 'no_future_concert');
  assert.equal(actions[0].nearestStartUtc, null);
});

test('a project of another domain in the same region never appears in actions', () => {
  const actions = plan(
    [concert({ city: 'Екатеринбург', date: '2027-02-05', time: '19:00' })],
    [
      { id: 9, name: 'Екатеринбург MUSESHOW.RU', domain: 'museshow.ru', region: 54, active: true },
      { id: 10, name: 'Москва MUSESHOW.RU', domain: 'museshow.ru', region: 213, active: true },
    ],
  );
  assert.equal(actions.length, 2); // create + start for the site's own city project only
  for (const a of actions) {
    assert.ok(a.projectId !== 9 && a.projectId !== 10);
    assert.ok(!a.reason.includes('museshow'));
  }
  assert.ok(actions.every((a) => a.kind === 'create' || a.kind === 'start'));
});

test('city unknown to resolveCity: one skip action with reason unmapped_city', () => {
  const actions = plan([
    concert({ id: 1, city: 'Зарячье', date: '2027-02-03', time: '19:00' }),
    concert({ id: 2, city: 'Зарячье', date: '2027-02-04', time: '19:00' }),
  ]);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, 'skip');
  assert.equal(actions[0].city, 'Зарячье');
  assert.equal(actions[0].region, null);
  assert.equal(actions[0].reason, 'unmapped_city');
  assert.equal(actions[0].nearestStartUtc, null);
});
