import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHeatmap,
  peakHour,
  intensity,
  CARD_TYPES,
  TOTAL_WAN,
} from '../src/panels/card-hourly-heatmap.js';

/** 简单的可复现随机源，避免测试依赖浏览器或其它模块。 */
function lcg(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('热力矩阵：3 行 × 24 列，数值有限且非负', () => {
  const { values } = buildHeatmap(lcg(20261112));
  assert.equal(values.length, CARD_TYPES.length);
  assert.equal(values.length, 3);
  for (const row of values) {
    assert.equal(row.length, 24);
    for (const v of row) {
      assert.ok(Number.isFinite(v), `${v} 应为有限数`);
      assert.ok(v >= 0, `${v} 不应为负`);
    }
  }
});

test('今日总笔数固定为 86.4 万笔，各格按权重分配后精确合计', () => {
  const heatmap = buildHeatmap(lcg(7), TOTAL_WAN);
  assert.equal(heatmap.total, TOTAL_WAN);
  const sum = heatmap.values.flat().reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum - TOTAL_WAN) < 1e-9, `合计 ${sum} 应等于 ${TOTAL_WAN}`);
});

test('固定种子下矩阵可复现', () => {
  const a = buildHeatmap(lcg(20261112));
  const b = buildHeatmap(lcg(20261112));
  assert.deepEqual(a.values, b.values);
});

test('峰值小时：午间 12 时最高', () => {
  const { values } = buildHeatmap(lcg(20261112));
  assert.equal(peakHour(values), 12);
});

test('峰值小时：按列求和、并列取较早的小时、空矩阵返回 0', () => {
  assert.equal(peakHour([[0, 5, 1], [0, 5, 2]]), 1);
  assert.equal(peakHour([[9, 1], [9, 1]]), 0);
  assert.equal(peakHour([]), 0);
  assert.equal(peakHour([[0, 1, 3], [0, 2, 1]]), 2);
});

test('强度归一化：0–1 且越界被夹住', () => {
  assert.equal(intensity(0, 0, 10), 0);
  assert.equal(intensity(5, 0, 10), 0.5);
  assert.equal(intensity(10, 0, 10), 1);
  assert.equal(intensity(-3, 0, 10), 0);
  assert.equal(intensity(99, 0, 10), 1);
  assert.equal(intensity(5, 5, 5), 0);
  assert.equal(intensity(Number.NaN, 0, 10), 0);
});
