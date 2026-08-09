import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/core/EventBus.js';

test('on + emit + off', () => {
  const bus = new EventBus();
  let count = 0;
  const off = bus.on('x', () => count++);
  bus.emit('x');
  assert.equal(count, 1);
  off();
  bus.emit('x');
  assert.equal(count, 1);
});

test('birden fazla dinleyici sırayla çalışır', () => {
  const bus = new EventBus();
  const order = [];
  bus.on('e', () => order.push('a'));
  bus.on('e', () => order.push('b'));
  bus.emit('e');
  assert.deepEqual(order, ['a', 'b']);
});

test('dinleyici hatası diğerlerini etkilemez', () => {
  const bus = new EventBus();
  let ok = false;
  bus.on('e', () => { throw new Error('booom'); });
  bus.on('e', () => { ok = true; });
  bus.emit('e');
  assert.equal(ok, true);
});

test('veri taşınır', () => {
  const bus = new EventBus();
  let received = null;
  bus.on('d', (data) => { received = data; });
  bus.emit('d', { hello: 'world' });
  assert.deepEqual(received, { hello: 'world' });
});

test('once — tek seferlik', () => {
  const bus = new EventBus();
  let count = 0;
  bus.once('o', () => count++);
  bus.emit('o');
  bus.emit('o');
  assert.equal(count, 1);
});
