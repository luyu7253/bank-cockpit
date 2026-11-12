import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDepositMix,
  normalizeShares,
  arcPathFor,
  DEPOSIT_CATEGORIES,
} from '../src/panels/deposit-mix.js';

const tenths = (shares) => shares.map((s) => Math.round(s * 10));

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('normalizeShares：按比例归一，合计精确为 100', () => {
  assert.deepEqual(normalizeShares([1, 2, 3, 4]), [10, 20, 30, 40]);
  for (const values of [
    [1, 1, 1],
    [13, 27, 41, 19],
    [0.4, 0.3, 0.2, 0.1],
    [321.7, 198.2, 87.5, 41.9],
  ]) {
    const shares = normalizeShares(values);
    assert.equal(shares.length, values.length);
    assert.equal(tenths(shares).reduce((a, b) => a + b, 0), 1000);
    for (const s of shares) assert.ok(s >= 0 && s <= 100);
  }
});

test('normalizeShares：非法值与全零输入安全处理', () => {
  assert.deepEqual(normalizeShares([0, 0, 0, 0]), [0, 0, 0, 0]);
  assert.deepEqual(normalizeShares([5, NaN, -3, Infinity]), [100, 0, 0, 0]);
});

test('buildDepositMix：四类存款、颜色顺序 0..3', () => {
  const mix = buildDepositMix(4000, seeded(20261112));
  assert.equal(mix.total, 4000);
  assert.deepEqual(mix.items.map((i) => i.name), DEPOSIT_CATEGORIES);
  assert.deepEqual(mix.items.map((i) => i.seriesIndex), [0, 1, 2, 3]);
});

test('buildDepositMix：占比合计 100，金额与总额量级一致', () => {
  const total = 4123.6;
  const mix = buildDepositMix(total, seeded(20261112));
  assert.equal(mix.items.length, 4);
  const sumTenths = mix.items.reduce((acc, i) => acc + Math.round(i.share * 10), 0);
  assert.equal(sumTenths, 1000);
  for (const item of mix.items) {
    assert.ok(item.share > 0 && item.share < 100);
    assert.ok(item.value > 0);
    assert.ok(Math.abs(item.value - (total * item.share) / 100) <= 0.05);
  }
  const valueSum = mix.items.reduce((acc, i) => acc + i.value, 0);
  assert.ok(Math.abs(valueSum - total) <= 0.5, `金额合计 ${valueSum} 与总额 ${total} 差距过大`);
});

test('buildDepositMix：同一种子结果固定', () => {
  const a = buildDepositMix(4000, seeded(20261112));
  const b = buildDepositMix(4000, seeded(20261112));
  assert.deepEqual(a, b);
});

test('arcPathFor：空角度返回空串，普通扇区是闭合 path', () => {
  assert.equal(arcPathFor(80, 80, 70, 50, 0, 0), '');
  assert.equal(arcPathFor(80, 80, 70, 50, 40, 20), '');

  const d = arcPathFor(80, 80, 70, 50, -90, 0);
  assert.match(d, /^M/);
  assert.match(d, / A70,70 /);
  assert.match(d, / A50,50 /);
  assert.match(d, /Z$/);
  // 从正上方开始（cx=80, cy-rOuter=10）
  assert.match(d, /^M80\.00,10\.00/);
});

test('arcPathFor：整圆拆成两段弧，避免起终点重合', () => {
  const d = arcPathFor(80, 80, 70, 50, -90, 270);
  assert.equal((d.match(/M/g) ?? []).length, 2);
  assert.equal((d.match(/Z/g) ?? []).length, 2);
});

test('arcPathFor：半径非法时返回空串', () => {
  assert.equal(arcPathFor(80, 80, 0, 0, 0, 90), '');
});
