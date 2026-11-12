import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPOSIT_CATEGORIES,
  allocateTenths,
  percentages,
  buildDepositMix,
  donutSlices,
  donutArc,
} from '../src/panels/slot-b.js';
import { seededRandom } from '../src/data.js';

const sum = (list) => list.reduce((s, v) => s + v, 0);
const sumPct = (list) => Math.round(sum(list) * 10) / 10;

test('存款占比：四位小数补齐后恰好合计 100.0%', () => {
  const pcts = percentages([1459.2, 1662.8, 608.1, 324.4]);
  assert.equal(pcts.length, 4);
  assert.equal(sumPct(pcts), 100);
  assert.ok(pcts.every((p) => p >= 0));
  // 常见的不整除组合也不会出现 99.9 / 100.1
  for (const values of [[1, 1, 1], [1, 2, 3, 7], [0.1, 0.2, 0.3, 0.4], [5, 5]]) {
    assert.equal(sumPct(percentages(values)), 100);
  }
});

test('存款占比：全零数据返回全零而不报错', () => {
  assert.deepEqual(percentages([0, 0, 0, 0]), [0, 0, 0, 0]);
});

test('整数份额分配：合计严格等于给定总数', () => {
  assert.deepEqual(allocateTenths([1, 1, 1], 10), [4, 3, 3]);
  assert.equal(sum(allocateTenths([3, 5, 2, 7], 40523)), 40523);
  assert.deepEqual(allocateTenths([1, 1], 0), [0, 0]);
});

test('模拟存款结构：同一种子可复现，合计等于中心显示值', () => {
  const a = buildDepositMix(seededRandom(20261112), 4052.3);
  const b = buildDepositMix(seededRandom(20261112), 4052.3);
  assert.deepEqual(a, b);
  assert.equal(a.items.length, 4);
  assert.deepEqual(a.items.map((it) => it.name), DEPOSIT_CATEGORIES.map((c) => c.name));
  assert.equal(a.total, 4052.3);
  assert.equal(Math.round(sum(a.items.map((it) => it.value)) * 10) / 10, a.total);
  assert.ok(a.items.every((it) => it.value > 0));
});

test('环形扇形：首尾相接，扫过角合计为 360° 减去间隙', () => {
  const items = [
    { key: 'a', value: 36 },
    { key: 'b', value: 41 },
    { key: 'c', value: 15 },
    { key: 'd', value: 8 },
  ];
  const slices = donutSlices(items, 2);
  assert.equal(slices.length, 4);
  assert.ok(slices[0].startDeg > 0);
  assert.equal(Math.round(sum(slices.map((s) => s.sweepDeg + 2))), 360);
  // 相邻扇形之间的空隙恰好为 gapDeg
  for (let i = 1; i < slices.length; i++) {
    const prevEnd = slices[i - 1].startDeg + slices[i - 1].sweepDeg;
    assert.ok(Math.abs(slices[i].startDeg - prevEnd - 2) < 1e-9);
  }
});

test('环形 path：从正上方开始，两个圆弧或整圆路径', () => {
  const quarter = donutArc(120, 120, 100, 64, 0, 90);
  assert.match(quarter, /^M120\.00,20\.00 A100,100 0 0 1 /);
  assert.equal((quarter.match(/ A/g) || []).length, 2);
  assert.match(quarter, /Z$/);
  // 大于半圆用 large-arc-flag = 1
  assert.match(donutArc(120, 120, 100, 64, 0, 270), / A100,100 0 1 1 /);
  // 整圆拆成两段，否则起终点重合画不出来
  assert.equal((donutArc(120, 120, 100, 64, 0, 360).match(/ A/g) || []).length, 4);
  // 没有扫过角时不产生路径
  assert.equal(donutArc(120, 120, 100, 64, 0, 0), '');
});

test('环形 path 的终点落在起始角加扫过角的位置', () => {
  const d = donutArc(120, 120, 100, 64, 45, 90);
  // 45° + 90° = 135°，外半径 100 的终点
  const endX = 120 + 100 * Math.cos((45 * Math.PI) / 180);
  const endY = 120 + 100 * Math.sin((45 * Math.PI) / 180);
  assert.match(d, new RegExp(`A100,100 0 0 1 ${endX.toFixed(2)},${endY.toFixed(2)}`));
});
