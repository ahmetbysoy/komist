import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, median, mean, formatPrice, formatVolume, getDecimalPlaces } from '../src/core/Utils.js';

test('clamp', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
});

test('median — tek/çift/boş', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), 0);
});

test('mean', () => {
  assert.equal(mean([1, 2, 3, 4]), 2.5);
  assert.equal(mean([]), 0);
});

test('formatPrice — büyüklüğe göre', () => {
  assert.equal(formatPrice(65000), '65000.00');
  assert.equal(formatPrice(0.0012345), '0.001234');
});

test('formatVolume', () => {
  assert.equal(formatVolume(1234567), '1.23M');
  assert.equal(formatVolume(500), '500');
});

test('getDecimalPlaces', () => {
  assert.equal(getDecimalPlaces('BTCUSDT'), 1);
  assert.equal(getDecimalPlaces('ETHUSDT'), 2);
  assert.equal(getDecimalPlaces('SOLUSDT'), 2);
});
