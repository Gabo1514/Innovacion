import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../js/premium.js');

test('dates use Lima rather than the host UTC day', () => {
  assert.equal(core.today(Date.parse('2026-10-06T02:59:00Z')), '2026-10-05');
  assert.equal(core.today(Date.parse('2026-10-06T05:00:00Z')), '2026-10-06');
  assert.equal(core.addDays('2026-12-31', 1), '2027-01-01');
});

test('booking date bounds reject past, overflow and impossible dates', () => {
  const today = '2026-10-06';
  assert.equal(core.validDate(today, today), true);
  assert.equal(core.validDate(core.addDays(today, 90), today), true);
  assert.equal(core.validDate(core.addDays(today, 91), today), false);
  assert.equal(core.validDate('2026-10-05', today), false);
  assert.equal(core.validDate('2026-02-30', '2026-02-01'), false);
  assert.equal(core.validDate('2028-02-29', '2028-02-01'), true);
  assert.equal(core.validDate('2026-1-06', today), false);
});

test('restored trip context validates stale and malformed browser data', () => {
  assert.deepEqual(core.context(null, '2026-10-06'), { destination: 'all', date: '2026-10-07', pax: 2 });
  assert.deepEqual(core.context({ destination: 'unrecognised', date: '2026-09-30', pax: 2.5 }, '2026-10-06'), { destination: 'all', date: '2026-10-07', pax: 2 });
  assert.deepEqual(core.context({ destination: 'paracas', date: '2026-10-10', pax: '9' }, '2026-10-06'), { destination: 'paracas', date: '2026-10-10', pax: 9 });
  assert.equal(core.context({ pax: 10 }, '2026-10-06').pax, 2);
});

test('comparison limit remains valid after deselection and catalogue changes', () => {
  const available = ['a', 'b', 'c', 'd'];
  assert.deepEqual(core.toggleCompare(['a', 'b', 'c'], 'd', available), { items: ['a', 'b', 'c'], limited: true });
  assert.deepEqual(core.toggleCompare(['a', 'b', 'c'], 'b', available), { items: ['a', 'c'], limited: false });
  assert.deepEqual(core.toggleCompare(['a', 'a', 'obsolete', 'b'], 'd', available), { items: ['a', 'b', 'd'], limited: false });
  assert.deepEqual(core.toggleCompare(['a'], 'obsolete', available), { items: ['a'], limited: false });
});

test('multilingual search combines filters and sorts without altering editorial order', () => {
  const items = [
    { id: 'nasca', destination: 'nasca', title: { es: 'Líneas de Nasca', en: 'Nasca flight' }, region: { es: 'Nasca', en: 'Nasca' }, pricePEN: 460, durationHours: 0.5 },
    { id: 'dunes', destination: 'huacachina', title: { es: 'Dunas al atardecer', en: 'Sunset dunes' }, pricePEN: 70, durationHours: 2 },
    { id: 'utv', destination: 'huacachina', title: { es: 'Huacachina en UTV', en: 'Private UTV' }, pricePEN: 120, durationHours: 1 },
  ];
  assert.deepEqual(core.filter(items, { query: 'LINEAS' }).map(item => item.id), ['nasca']);
  assert.deepEqual(core.filter(items, { destination: 'huacachina', query: 'private', savedOnly: true, saved: ['utv'] }).map(item => item.id), ['utv']);
  assert.deepEqual(core.filter(items, { sort: 'price-asc' }).map(item => item.id), ['dunes', 'utv', 'nasca']);
  assert.deepEqual(core.filter(items, { sort: 'duration' }).map(item => item.id), ['nasca', 'utv', 'dunes']);
  assert.deepEqual(items.map(item => item.id), ['nasca', 'dunes', 'utv']);
});

test('EUR reference prices transition to a supported legacy checkout currency', () => {
  assert.equal(core.legacyCurrency('EUR'), 'PEN');
  assert.equal(core.legacyCurrency('USD'), 'USD');
  assert.equal(core.legacyCurrency('PEN'), 'PEN');
  assert.equal(core.legacyCurrency('unexpected'), 'PEN');
});

test('newsletter registration requires valid email and explicit boolean consent', () => {
  assert.equal(core.newsletterValid(' traveller@example.test ', true), true);
  assert.equal(core.newsletterValid('traveller@example.test', false), false);
  assert.equal(core.newsletterValid('traveller@example.test', 'true'), false);
  assert.equal(core.newsletterValid('traveller@', true), false);
  assert.equal(core.newsletterValid('a'.repeat(245) + '@example.test', true), false);
});

test('HTTP proposal download preserves UTF-8 content and enforces byte bounds', () => {
  const content = 'Propuesta de viaje\nViña y desierto · 2 viajeros\nS/ 240';
  const url = new URL(core.planDownloadURL(content, '2026-10-10', '2026-10-06'), 'http://localhost');
  assert.equal(url.pathname, '/api/plan.txt');
  assert.equal(url.searchParams.get('content'), content);
  assert.equal(url.searchParams.get('date'), '2026-10-10');
  assert.equal(core.planDownloadURL('ñ'.repeat(9000), '2026-10-10', '2026-10-06') !== null, true);
  assert.equal(core.planDownloadURL('ñ'.repeat(9001), '2026-10-10', '2026-10-06'), null);
  assert.equal(core.planDownloadURL('', '2026-10-10', '2026-10-06'), null);
  assert.equal(core.planDownloadURL('Propuesta', '2026-10-05', '2026-10-06'), null);
});
