import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTER_DEFS,
  TREND_POINTS,
  formatCounter,
  nextStep,
  buildTrend,
  createCounters,
  advanceCounters,
  sparklinePath,
} from '../src/panels/slot-c.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

/** 固定序列的伪随机数，便于复现。 */
const seeded = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

test('计数器定义完整：三个指标、单位与纯函数可用', () => {
  assert.deepEqual(COUNTER_DEFS.map((d) => d.name), ['新开户数', '理财申购额', '信用卡交易笔数']);
  assert.deepEqual(COUNTER_DEFS.map((d) => d.unit), ['户', '万元', '笔']);
});

test('数字格式化：千分位与小固定数位', () => {
  assert.equal(formatCounter(12_846, 0), '12,846');
  assert.equal(formatCounter(158_432, 0), '158,432');
  assert.equal(formatCounter(8_632.4, 1), '8,632.4');
  assert.equal(formatCounter(0, 1), '0.0');
});

test('随机步长落在区间内且按小数位取整', () => {
  assert.equal(nextStep(() => 0, 3, 9, 0), 3);
  near(nextStep(() => 0.999999, 3, 9, 0), 9, 1);
  assert.equal(nextStep(() => 0.5, 3, 9, 0), 6);
  const money = nextStep(() => 0.1234, 18.6, 64.8, 1);
  near(money * 10, Math.round(money * 10));
  for (let i = 1; i < 20; i += 1) {
    const v = nextStep(() => i / 20, 18.6, 64.8, 1);
    assert.ok(v >= 18.6 && v <= 64.8, `${v} 在 18.6~64.8 之间`);
  }
});

test('趋势线：长度固定、以当前值收尾、逐点递增', () => {
  const rand = seeded(7);
  for (const def of COUNTER_DEFS) {
    const trend = buildTrend(rand, def);
    assert.equal(trend.length, TREND_POINTS);
    assert.equal(trend.at(-1), def.base);
    for (let i = 1; i < trend.length; i += 1) {
      assert.ok(trend[i] > trend[i - 1], `${def.key} 第 ${i} 点应递增`);
    }
    for (const v of trend) assert.ok(Number.isFinite(v));
  }
});

test('初始状态：三个计数器都从定义值开始，同一种子结果一致', () => {
  const a = createCounters(seeded(42));
  const b = createCounters(seeded(42));
  assert.deepEqual(a, b);
  for (const def of COUNTER_DEFS) {
    assert.equal(a[def.key].value, def.base);
    assert.equal(a[def.key].trend.length, TREND_POINTS);
    assert.equal(a[def.key].trend.at(-1), def.base);
  }
});

test('推进一次：值增加、增量在步长内、趋势窗口右移一位', () => {
  const state = createCounters(seeded(11));
  const next = advanceCounters(state, seeded(99));
  for (const def of COUNTER_DEFS) {
    const before = state[def.key];
    const after = next[def.key];
    assert.ok(after.value > before.value, `${def.key} 应当增长`);
    assert.ok(after.delta >= def.step[0] && after.delta <= def.step[1], `${def.key} 增量 ${after.delta} 在步长内`);
    near(after.value, before.value + after.delta);
    assert.equal(after.trend.length, TREND_POINTS);
    assert.equal(after.trend.at(-1), after.value);
    assert.deepEqual(after.trend.slice(0, -1), before.trend.slice(1));
  }
  // 不修改传入状态
  assert.equal(state.accounts.value, COUNTER_DEFS[0].base);
  assert.equal(state.accounts.trend.length, TREND_POINTS);
});

test('迷你趋势线 path：点数不足返回空串，坐标落在画布内', () => {
  assert.equal(sparklinePath([], 100, 30), '');
  assert.equal(sparklinePath([5], 100, 30), '');

  const values = [1, 4, 2, 8, 6];
  const d = sparklinePath(values, 100, 30, 4);
  assert.match(d, /^M[\d.]+,[\d.]+(?:L[\d.]+,[\d.]+){4}$/);
  const pairs = d.slice(1).split('L').map((p) => p.split(',').map(Number));
  for (const [x, y] of pairs) {
    assert.ok(x >= 4 - 1e-9 && x <= 96 + 1e-9, `x=${x} 在边距内`);
    assert.ok(y >= 4 - 1e-9 && y <= 26 + 1e-9, `y=${y} 在边距内`);
  }
  near(pairs[0][0], 4);
  near(pairs.at(-1)[0], 96);
  near(pairs[3][1], 4);
});

test('迷你趋势线 path：全等值保持在中间高度，不出现 NaN', () => {
  const d = sparklinePath([7, 7, 7], 100, 30, 2);
  assert.doesNotMatch(d, /NaN/);
  const ys = d.slice(1).split('L').map((p) => Number(p.split(',')[1]));
  for (const y of ys) near(y, 15);
});
