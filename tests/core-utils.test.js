import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, median, mean, rollingSlope } from '../src/core/Utils.js';

test('clamp', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
});

test('median — tek sayı', () => {
  assert.equal(median([3, 1, 2]), 2);
});

test('median — çift sayı', () => {
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test('median — boş dizi', () => {
  assert.equal(median([]), 0);
});

test('mean', () => {
  assert.equal(mean([1, 2, 3, 4]), 2.5);
  assert.equal(mean([]), 0);
});

test('rollingSlope — artan seri pozitif eğim', () => {
  const levels = [1, 2, 3, 4, 5].map((qty, i) => ({ qty, price: i }));
  const slope = rollingSlope(levels);
  assert.ok(slope > 0, `slope pozitif olmalı, geldi: ${slope}`);
});

test('rollingSlope — azalan seri negatif eğim', () => {
  const levels = [5, 4, 3, 2, 1].map((qty, i) => ({ qty, price: i }));
  const slope = rollingSlope(levels);
  assert.ok(slope < 0, `slope negatif olmalı, geldi: ${slope}`);
});

test('rollingSlope — yetersiz veri', () => {
  assert.equal(rollingSlope([{ qty: 1, price: 1 }]), 0);
});
