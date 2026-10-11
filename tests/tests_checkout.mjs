import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Load the shipped browser scripts, suppressing only their automatic page init.
// The DOM below is deliberately small: the flow, validation and voucher rendering
// remain the production implementations, while network/storage failures are controlled.
function browserHarness(page = 'booking') {
  const elements = new Map();
  const notifications = [];
  let intervalCount = 0;
  class Element {
    constructor() {
      this.value = ''; this.textContent = ''; this.innerHTML = '';
      this.hidden = false; this.disabled = false; this.checked = false;
      this.style = {}; this.dataset = {}; this.listeners = new Map();
      const classes = new Set();
      this.classList = {
        add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name),
        toggle: (name, enabled) => { if (enabled) classes.add(name); else classes.delete(name); },
      };
      this.error = { textContent: '' };
    }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    dispatchEvent(event) { this.listeners.get(event.type)?.(event); }
    setAttribute(name, value) { this[name] = value; }
    focus() { document.activeElement = this; }
    reset() {}
    closest(selector) { return selector === '.field' ? { querySelector: () => this.error } : null; }
    getClientRects() { return [1]; }
  }
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  const panes = [1, 2, 3].map(value => { const el = new Element(); el.dataset.pane = String(value); return el; });
  const steps = [1, 2, 3].map(value => { const el = new Element(); el.dataset.step = String(value); return el; });
  const sides = [new Element(), new Element()];
  const companions = [];
  const document = {
    body: { style: {} }, activeElement: null,
    querySelector: element, getElementById: id => element(`#${id}`),
    querySelectorAll(selector) {
      if (selector === '#checkout [data-pane]') return panes;
      if (selector === '#stepper-bar .sb-step') return steps;
      if (selector === '#checkout [data-side]') return sides;
      if (selector === '[data-companion]') return companions;
      return [];
    },
    dispatchEvent() {}, addEventListener() {},
  };
  const context = vm.createContext({
    document, URL, URLSearchParams, Date, Intl, Map, Set,
    location: { origin: 'http://127.0.0.1:8000', pathname: '/tour-utv.html', search: '' },
    history: { replaceState() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    sessionStorage: { setItem() {}, getItem() { return null; } },
    localStorage: { getItem() { return null; }, setItem() {} },
    Layout: { render() {} }, Icons: { svg: name => `<svg data-icon="${name}"></svg>` },
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type) { this.type = type; } },
    setTimeout() {}, clearInterval() {}, setInterval() { return ++intervalCount; },
  });
  const load = name => readFileSync(new URL(`../js/${name}`, import.meta.url), 'utf8');
  vm.runInContext(load('data.js'), context, { filename: 'data.js' });
  vm.runInContext(load('store.js'), context, { filename: 'store.js' });
  if (page === 'booking') {
    vm.runInContext(load('booking.js').replace(/Booking\.init\(\);\s*$/, ''), context, { filename: 'booking.js' });
    vm.runInContext('globalThis.flow = Checkout; globalThis.booking = Booking; globalThis.store = Store; globalThis.utils = Utils;', context);
  } else {
    vm.runInContext(load('voucher.js').replace(/VoucherPage\.init\(\);\s*$/, ''), context, { filename: 'voucher.js' });
    vm.runInContext('globalThis.flow = VoucherPage; globalThis.store = Store; globalThis.utils = Utils;', context);
  }
  context.utils.toast = (message, kind) => notifications.push({ message, kind });
  context.store.refresh = async () => {};
  return { context, flow: context.flow, store: context.store, booking: context.booking,
    element, panes, sides, companions, notifications, Element };
}

function reservation(status = 'CONFIRMADA') {
  return {
    code: 'BGV-2026-ABC123', token: 'private-test-token', tourId: 'utv-huacachina',
    tourTitle: 'UTV en Huacachina', date: '2026-10-08', slotId: 's1630', slotTime: '16:30',
    slotLabel: 'Sunset dorado', pax: { adults: 2, children: 0 }, vehicles: 1,
    status, expiresAt: Date.now() + 600_000,
    customer: { name: 'Lucía', last: 'Quispe', docType: 'DNI', doc: '12345678',
      email: 'lucia@example.com', phone: '+51912345678', notes: '' },
    companions: [{ name: 'Andrés', last: 'Rojas', docType: 'DNI', doc: '87654321' }],
    extras: [], amounts: { base: 240, extras: 0, total: 240, currency: 'PEN' },
    payment: { method: 'card', brand: 'VISA', last4: '1111', scenario: 'approved', simulated: true },
    history: [{ status, at: '2026-10-05T12:00:00Z' }],
  };
}

function readyToPay(harness) {
  const { flow, element, booking } = harness;
  const confirmed = reservation();
  flow.hold = { ...confirmed, status: 'BORRADOR' };
  flow.customer = confirmed.customer; flow.companions = confirmed.companions;
  flow.method = 'card'; flow.step = 2; flow.holdTimer = 1;
  element('#c-number').value = '4111 1111 1111 1111';
  element('#c-name').value = 'Lucía Quispe';
  element('#c-exp').value = `12/${String(new Date().getFullYear() + 1).slice(-2)}`;
  element('#c-cvv').value = '123';
  element('#payment-error').hidden = true;
  // Background booking widget redraw is outside the checkout regression scope.
  booking.renderCalendar = () => {}; booking.renderSlots = () => {};
  return confirmed;
}

test('closing a slow release blocks reopen, then permits a new hold without losing it', async () => {
  const h = browserHarness();
  let resolveRelease;
  const releasing = new Promise(resolve => { resolveRelease = resolve; });
  let created = 0;
  const original = reservation('BORRADOR');
  const next = { ...reservation('BORRADOR'), code: 'BGV-2026-NEXT12' };
  h.flow.hold = original; h.flow.step = 1;
  h.booking.state.date = next.date; h.booking.state.slotId = next.slotId;
  h.booking.renderAll = () => {};
  h.store.releaseHold = async (code, token) => {
    assert.equal(code, original.code); assert.equal(token, original.token);
    await releasing;
  };
  h.store.createHold = async () => { created++; return next; };
  const closing = h.flow.close();
  assert.equal(h.flow.closing, true);
  await h.flow.open();
  assert.equal(created, 0, 'reopening must not allocate vehicles while release is in flight');
  resolveRelease(); await closing;
  assert.equal(h.flow.closing, false);
  await h.flow.open();
  assert.equal(created, 1);
  assert.equal(h.flow.hold.code, next.code);
  assert.equal(h.element('#checkout').classList.contains('open'), true);
});

test('a delayed hold response keeps the checkout tied to the allocated departure and price', async () => {
  const h = browserHarness();
  const allocated = {
    ...reservation('BORRADOR'),
    extras: [{ id: 'fotos', label: 'Fotos profesionales en HD', amount: 40 }],
    amounts: { base: 240, extras: 40, total: 280, currency: 'PEN' },
  };
  Object.assign(h.booking.state, {
    date: allocated.date, slotId: allocated.slotId, adults: 2, children: 0,
    extras: new Set(['fotos']),
  });
  let resolveHold, submitted;
  const response = new Promise(resolve => { resolveHold = resolve; });
  h.store.createHold = async selection => { submitted = selection; return response; };
  const opening = h.flow.open();
  assert.equal(h.flow.opening, true);
  assert.equal(h.element('#reservar').inert, true, 'the selector is unavailable while allocation is in flight');
  assert.equal(h.element('#bk-continue').disabled, true);
  // A stale event or another script must never replace the server allocation.
  Object.assign(h.booking.state, {
    date: '2026-10-10', slotId: 's1000', adults: 9, children: 0,
    extras: new Set(['gopro']),
  });
  resolveHold(allocated); await opening;
  assert.deepEqual(JSON.parse(JSON.stringify(submitted)), {
    date: allocated.date, slotId: allocated.slotId,
    pax: { adults: 2, children: 0 }, extras: ['fotos'],
  });
  assert.equal(h.flow.hold.code, allocated.code);
  assert.equal(h.booking.state.date, allocated.date);
  assert.equal(h.booking.state.slotId, allocated.slotId);
  assert.equal(h.booking.state.adults, 2);
  assert.deepEqual([...h.booking.state.extras], ['fotos']);
  assert.equal((h.element('#companions').innerHTML.match(/<fieldset/g) || []).length, 1);
  for (const side of h.sides) {
    assert.match(side.innerHTML, /16:30 · Sunset dorado/);
    assert.match(side.innerHTML, /Fotos profesionales en HD/);
    assert.match(side.innerHTML, /S\/ 280\.00/);
    assert.doesNotMatch(side.innerHTML, /Video GoPro|9 adultos|10:00/);
  }
  // Even a later mutation cannot change the checkout's allocated summary.
  h.booking.state.adults = 9; h.booking.state.extras = new Set(['gopro']);
  h.flow.renderSide(); h.flow.renderCompanions();
  assert.match(h.sides[0].innerHTML, /S\/ 280\.00/);
  assert.equal((h.element('#companions').innerHTML.match(/<fieldset/g) || []).length, 1);
  assert.equal(h.flow.opening, false);
  assert.equal(h.element('#reservar').inert, false);
  assert.equal(h.element('#checkout').classList.contains('open'), true);
});

test('failed allocation and failed refresh always release the opening lock for another attempt', async () => {
  const h = browserHarness(); const allocated = reservation('BORRADOR');
  Object.assign(h.booking.state, { date: allocated.date, slotId: allocated.slotId });
  let rejectHold;
  const response = new Promise((_resolve, reject) => { rejectHold = reject; });
  h.store.createHold = async () => response;
  h.store.refresh = async () => { throw new Error('Refresh unavailable'); };
  const opening = h.flow.open();
  assert.equal(h.element('#reservar').inert, true);
  assert.equal(h.flow.opening, true);
  rejectHold(new Error('No hay vehículos para este turno')); await opening;
  assert.equal(h.flow.opening, false);
  assert.equal(h.element('#reservar').inert, false);
  assert.equal(h.flow.hold, null);
  assert.equal(h.element('#checkout').classList.contains('open'), false);
  assert.match(h.element('#booking-error').textContent, /No hay vehículos/);
  assert.equal(h.notifications[0].kind, 'error');
  h.store.createHold = async () => allocated;
  h.store.refresh = async () => {};
  await h.flow.open();
  assert.equal(h.flow.hold.code, allocated.code);
  assert.equal(h.flow.opening, false);
  assert.equal(h.element('#reservar').inert, false);
  assert.equal(h.element('#checkout').classList.contains('open'), true);
});

test('a committed card payment with a lost response recovers the existing voucher', async () => {
  const h = browserHarness(); const committed = readyToPay(h);
  let posted = 0, queried = 0;
  h.store.pay = async (code, token, data) => {
    posted++;
    assert.equal(code, committed.code); assert.equal(token, committed.token);
    assert.equal(data.payment.scenario, 'approved');
    assert.deepEqual(Object.keys(data.payment).sort(), ['brand', 'method', 'scenario']);
    throw new TypeError('Network response lost after commit');
  };
  h.store.fetchReservation = async (code, token) => {
    queried++;
    assert.equal(code, committed.code); assert.equal(token, committed.token);
    return committed;
  };
  await h.flow.submitPayment();
  assert.equal(posted, 1, 'recovery must not post another payment'); assert.equal(queried, 1);
  assert.equal(h.flow.lastReservation.code, committed.code);
  assert.equal(h.flow.step, 3); assert.equal(h.panes[2].hidden, false);
  assert.match(h.element('#voucher').innerHTML, /Reserva confirmada/);
  assert.match(h.element('#voucher').innerHTML, /BGV-2026-ABC123/);
  assert.equal(h.element('#payment-error').hidden, true);
  assert.equal(h.flow.busy, false); assert.equal(h.element('#pay-submit').disabled, false);
  assert.equal(h.flow.holdTimer, null);
});

test('blocked session storage does not hide a successfully paid checkout voucher', async () => {
  const h = browserHarness(); const paid = readyToPay(h);
  let lookups = 0;
  h.context.sessionStorage.setItem = () => { throw new Error('Storage access blocked'); };
  h.store.pay = async () => paid;
  h.store.fetchReservation = async () => { lookups++; throw new Error('not needed'); };
  await h.flow.submitPayment();
  assert.equal(h.flow.step, 3); assert.match(h.element('#voucher').innerHTML, /Reserva confirmada/);
  assert.equal(h.flow.lastReservation.code, paid.code);
  assert.equal(h.element('#payment-error').hidden, true);
  assert.equal(lookups, 0, 'optional persistence failure must not become a payment failure');
  assert.equal(h.element('#c-number').value, ''); assert.equal(h.element('#c-cvv').value, '');
});

test('a declined payment whose hold remains draft never produces a success voucher', async () => {
  const h = browserHarness(); const draft = readyToPay(h);
  h.element('#c-number').value = '4000 0000 0000 0002';
  h.store.pay = async (_code, _token, data) => {
    assert.equal(data.payment.scenario, 'declined');
    const error = new Error('Pago de demostración rechazado'); error.status = 402; throw error;
  };
  h.store.fetchReservation = async () => ({ ...draft, status: 'BORRADOR' });
  await h.flow.submitPayment();
  assert.equal(h.flow.step, 2); assert.equal(h.flow.lastReservation, null);
  assert.equal(h.element('#payment-error').hidden, false);
  assert.match(h.element('#payment-error').textContent, /rechazado/);
  assert.equal(h.flow.busy, false); assert.equal(h.element('#pay-submit').disabled, false);
});

test('voucher lookup remains visible when session storage rejects persistence', async () => {
  const h = browserHarness('voucher'); const valid = reservation();
  h.context.sessionStorage.setItem = () => { throw new Error('Storage access blocked'); };
  h.flow.credentials = { code: valid.code, token: valid.token };
  h.store.fetchReservation = async (code, token) => {
    assert.equal(code, valid.code); assert.equal(token, valid.token); return valid;
  };
  h.element('#voucher-result').hidden = true; h.element('#voucher-empty').hidden = false;
  await h.flow.load();
  assert.equal(h.element('#voucher-result').hidden, false);
  assert.equal(h.element('#voucher-empty').hidden, true);
  assert.equal(h.element('#voucher-loading').hidden, true);
  assert.equal(h.element('#voucher-error').hidden, true);
  assert.match(h.element('#voucher-result').innerHTML, /Tu aventura está confirmada/);
  assert.match(h.element('#voucher-result').innerHTML, /BGV-2026-ABC123/);
});

test('a slower earlier voucher lookup cannot replace the newer reservation or its private token', async () => {
  const h = browserHarness('voucher');
  const earlier = { ...reservation(), code: 'BGV-2026-AAAAAA', token: 'token-for-A' };
  const newer = { ...reservation(), code: 'BGV-2026-BBBBBB', token: 'token-for-B' };
  let resolveEarlier, resolveNewer;
  const responseEarlier = new Promise(resolve => { resolveEarlier = resolve; });
  const responseNewer = new Promise(resolve => { resolveNewer = resolve; });
  const persisted = [];
  h.context.sessionStorage.setItem = (_key, value) => persisted.push(JSON.parse(value));
  h.store.fetchReservation = async (code, token) => {
    assert.equal(token, code === earlier.code ? earlier.token : newer.token);
    return code === earlier.code ? responseEarlier : responseNewer;
  };
  h.flow.credentials = { code: earlier.code, token: earlier.token };
  const first = h.flow.load();
  h.flow.credentials = { code: newer.code, token: newer.token };
  const second = h.flow.load();
  resolveNewer(newer); await second;
  const visibleTicket = h.element('#voucher-result').innerHTML;
  assert.match(visibleTicket, /BGV-2026-BBBBBB/);
  assert.match(visibleTicket, /token-for-B/);
  resolveEarlier(earlier); await first;
  assert.equal(h.flow.reservation.code, newer.code);
  assert.equal(h.flow.reservation.token, newer.token);
  assert.equal(h.element('#voucher-result').innerHTML, visibleTicket);
  assert.equal(h.element('#voucher-result').hidden, false);
  assert.equal(h.element('#voucher-loading').hidden, true);
  assert.equal(h.element('#voucher-error').hidden, true);
  assert.deepEqual(persisted, [{ code: newer.code, token: newer.token }]);
});

test('a failed earlier voucher lookup does not hide the newer successful ticket', async () => {
  const h = browserHarness('voucher');
  const newer = { ...reservation(), code: 'BGV-2026-BBBBBB', token: 'token-for-B' };
  let rejectEarlier;
  const responseEarlier = new Promise((_resolve, reject) => { rejectEarlier = reject; });
  h.store.fetchReservation = async code => code === 'BGV-2026-AAAAAA' ? responseEarlier : newer;
  h.flow.credentials = { code: 'BGV-2026-AAAAAA', token: 'token-for-A' };
  const first = h.flow.load();
  h.flow.credentials = { code: newer.code, token: newer.token };
  await h.flow.load();
  const visibleTicket = h.element('#voucher-result').innerHTML;
  rejectEarlier(new Error('El enlace anterior no es válido')); await first;
  assert.equal(h.flow.reservation.code, newer.code);
  assert.equal(h.element('#voucher-result').innerHTML, visibleTicket);
  assert.equal(h.element('#voucher-result').hidden, false);
  assert.equal(h.element('#voucher-error').hidden, true);
  assert.equal(h.element('#voucher-loading').hidden, true);
});

function travelerForm(primaryType, primaryDocument, companionType, companionDocument) {
  const h = browserHarness();
  const values = {
    '#f-name': 'Lucía', '#f-last': 'Quispe', '#f-doctype': primaryType, '#f-doc': primaryDocument,
    '#f-email': 'lucia@example.com', '#f-cc': '+51', '#f-phone': '912345678', '#f-notes': '',
    '#c-name': 'Lucía Quispe',
  };
  for (const [selector, value] of Object.entries(values)) h.element(selector).value = value;
  h.element('#f-terms').checked = true;
  const data = { name: 'Andrés', last: 'Rojas', docType: companionType, doc: companionDocument };
  const fields = new Map(Object.entries(data).map(([key, value]) => {
    const field = new h.Element(); field.value = value; return [key, field];
  }));
  h.companions.push({ querySelector(selector) { return fields.get(selector.match(/data-key="([^"]+)"/)[1]); } });
  h.flow.hold = reservation('BORRADOR');
  return h;
}

test('different document types may share a number without blocking valid travelers', () => {
  const h = travelerForm('DNI', '12345678', 'PAS', '12345678');
  h.flow.submitData();
  assert.equal(h.flow.step, 2);
  assert.equal(h.flow.customer.docType, 'DNI');
  assert.equal(h.flow.companions[0].docType, 'PAS');
  assert.equal(h.element('#err-terms').textContent, '');
});

test('the same passport in different letter case is rejected before payment', () => {
  const h = travelerForm('PAS', 'AB123456', 'PAS', 'ab123456');
  h.flow.submitData();
  assert.equal(h.flow.step, 1);
  assert.equal(h.flow.customer, null);
  assert.match(h.element('#err-terms').textContent, /documento diferente/);
});
