import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTERS,
  TREND_POINTS,
  formatCounter,
  nextStep,
  buildTrend,
  advanceCounters,
  sparklinePath,
} from '../src/panels/realtime-counters.js';

// 测试只依赖面板导出的纯函数；这里用本地 LCG 提供可复现的随机数。
function makeRand(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

test('数字格式化：千分位与固定小数位', () => {
  assert.equal(formatCounter(0), '0');
  assert.equal(formatCounter(12846), '12,846');
  assert.equal(formatCounter(158432), '158,432');
  assert.equal(formatCounter(8632.4, 1), '8,632.4');
  assert.equal(formatCounter(1234.567, 1), '1,234.6');
  assert.equal(formatCounter(Number.NaN), '—');
});

test('每次增量落在设定范围内，并按指标小数位取整', () => {
  for (let i = 0; i < COUNTERS.length; i += 1) {
    const [lo, hi] = COUNTERS[i].step;
    for (const r of [0, 0.2, 0.5, 0.8, 0.999999]) {
      const step = nextStep(i, () => r);
      assert.ok(step >= lo && step <= hi, `第 ${i} 个指标增量越界：${step}`);
      assert.equal(step, Number(step.toFixed(COUNTERS[i].decimals)));
    }
  }
  assert.equal(nextStep(0, () => 0), 3);
  assert.equal(nextStep(0, () => 1), 9);
  assert.equal(nextStep(1, () => 0), 18.6);
  assert.equal(nextStep(1, () => 1), 64.8);
  assert.equal(nextStep(2, () => 0), 60);
  assert.equal(nextStep(2, () => 1), 180);
});

test('趋势线长度 16–20 个点，单调递增，且以初始值收尾', () => {
  assert.ok(TREND_POINTS >= 16 && TREND_POINTS <= 20);
  for (let i = 0; i < COUNTERS.length; i += 1) {
    const trend = buildTrend(i, TREND_POINTS, makeRand(20261112 + i));
    assert.equal(trend.length, TREND_POINTS);
    assert.equal(trend.at(-1), COUNTERS[i].initial);
    for (let j = 1; j < trend.length; j += 1) {
      assert.ok(trend[j] > trend[j - 1], `第 ${i} 个指标趋势未递增：${trend[j - 1]} → ${trend[j]}`);
    }
    for (const v of trend) {
      assert.equal(v, Number(v.toFixed(COUNTERS[i].decimals)));
    }
  }
  assert.equal(buildTrend(0, 16, makeRand(1)).length, 16);
  assert.equal(buildTrend(0, 20, makeRand(1)).length, 20);
});

test('固定种子生成相同趋势', () => {
  const a = buildTrend(1, TREND_POINTS, makeRand(7));
  const b = buildTrend(1, TREND_POINTS, makeRand(7));
  assert.deepEqual(a, b);
});

test('advanceCounters 三个指标一起增长且不修改原数组', () => {
  const before = COUNTERS.map((c) => c.initial);
  const snapshot = [...before];
  const next = advanceCounters(before, makeRand(42));
  assert.deepEqual(before, snapshot);
  assert.equal(next.length, COUNTERS.length);
  for (let i = 0; i < COUNTERS.length; i += 1) {
    const delta = Number((next[i] - before[i]).toFixed(COUNTERS[i].decimals));
    const [lo, hi] = COUNTERS[i].step;
    assert.ok(delta >= lo && delta <= hi, `第 ${i} 个指标增量越界：${delta}`);
    assert.equal(next[i], Number(next[i].toFixed(COUNTERS[i].decimals)));
  }
});

test('sparkline 边界：首尾落在 pad 内，极值贴顶/贴底', () => {
  const parse = (d) => d.split(/[ML]/).filter(Boolean).map((p) => p.split(',').map(Number));

  const rising = parse(sparklinePath([1, 2, 3], 100, 20, 2));
  assert.equal(rising.length, 3);
  assert.deepEqual(rising[0], [2, 18]);
  assert.deepEqual(rising[2], [98, 2]);
  for (const [x, y] of rising) {
    assert.ok(x >= 2 && x <= 98);
    assert.ok(y >= 2 && y <= 18);
  }

  const falling = parse(sparklinePath([3, 2, 1], 100, 20, 2));
  assert.deepEqual(falling[0], [2, 2]);
  assert.deepEqual(falling[2], [98, 18]);

  const flat = parse(sparklinePath([5, 5, 5], 100, 20, 2));
  for (const [, y] of flat) assert.equal(y, 10);

  assert.equal(sparklinePath([], 100, 20), '');
  assert.equal(sparklinePath([5], 100, 20), '');
});
