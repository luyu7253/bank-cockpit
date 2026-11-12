import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  METALS_BASE, TICK_MS, SEED, STEP_LIMIT, DAILY_LIMIT, HISTORY_LEN,
  roundTo, formatPrice, formatSigned, formatPct, changeOf,
  buildHistory, buildMetals, stepMetals, sparkGeometry,
} from '../src/panels/precious-metals.js';

// 与 src/data.js 相同的 mulberry32，测试里只用于驱动面板导出的纯函数。
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

const isTwoDecimals = (v) => Number.isFinite(v) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

test('常量：两只金属、5 秒刷新、固定种子', () => {
  assert.equal(TICK_MS, 5000);
  assert.equal(SEED, 20261112);
  assert.deepEqual(METALS_BASE.map((m) => m.name), ['黄金', '白银']);
  assert.deepEqual(METALS_BASE.map((m) => m.code), ['Au99.99', 'Ag(T+D)']);
  assert.equal(METALS_BASE[0].unit, '元/克');
  assert.equal(METALS_BASE[1].unit, '元/千克');
});

test('buildMetals：首屏价格、昨收与涨跌幅自洽', () => {
  const metals = buildMetals(seeded(SEED));
  assert.equal(metals.length, 2);

  const [gold, silver] = metals;
  assert.equal(gold.key, 'gold');
  assert.equal(gold.price, 618.8);
  assert.equal(gold.prevClose, 612.4);
  assert.equal(gold.delta, 6.4);
  assert.equal(gold.pct, 1.05);
  assert.equal(gold.trend, 'up');

  assert.equal(silver.price, 7612);
  assert.equal(silver.prevClose, 7644);
  assert.equal(silver.delta, -32);
  assert.equal(silver.pct, -0.42);
  assert.equal(silver.trend, 'down');

  // 首屏一涨一跌，直接展示「涨红跌绿」两种状态
  assert.notEqual(gold.trend, silver.trend);
});

test('buildMetals：固定种子结果一致，走势随涨跌方向收尾', () => {
  const a = buildMetals(seeded(SEED));
  const b = buildMetals(seeded(SEED));
  assert.deepEqual(a, b, '同一种子必须得到相同首屏');
  assert.notDeepEqual(a, buildMetals(seeded(SEED + 1)), '不同种子应有不同走势');

  for (const metal of a) {
    assert.equal(metal.history.length, HISTORY_LEN);
    assert.equal(metal.history.at(-1), metal.price, '走势最后一点必须等于现价');
    assert.equal(metal.open, metal.history[0], '今开取今日走势的第一点');
    assert.ok(metal.history.every((v) => Number.isFinite(v) && v > 0));
    assert.ok(isTwoDecimals(metal.price));
  }
});

test('buildHistory：起点在昨收附近、终点严格等于现价、可复现', () => {
  const h = buildHistory(618.8, 612.4, seeded(7), 40);
  assert.equal(h.length, 40);
  assert.equal(h.at(-1), 618.8);
  assert.ok(Math.abs(h[0] - 612.4) < Math.abs(618.8 - 612.4), '起点应更靠近昨收而不是现价');
  assert.deepEqual(h, buildHistory(618.8, 612.4, seeded(7), 40));

  assert.equal(buildHistory(1, 1, seeded(1), 2).length, 2);
  assert.deepEqual(buildHistory(NaN, 1, seeded(1)), []);
  assert.equal(buildHistory(1, 1, seeded(1), 0).length, 2, '点数下限为 2');
});

test('changeOf：涨、跌、持平与非法输入', () => {
  assert.deepEqual(changeOf(618.8, 612.4), { delta: 6.4, pct: 1.05, trend: 'up' });
  assert.deepEqual(changeOf(7612, 7644), { delta: -32, pct: -0.42, trend: 'down' });
  assert.equal(changeOf(612.4, 612.4).trend, 'flat');
  assert.equal(changeOf(612.4001, 612.4).trend, 'flat', '涨跌幅不足 0.01% 时视为持平');
  assert.equal(changeOf(NaN, 612.4).trend, 'flat');
  assert.equal(changeOf(618.8, 0).trend, 'flat');
  assert.ok(Number.isNaN(changeOf(NaN, 612.4).pct));
});

test('roundTo / formatPrice：小数位、千分位与非法值', () => {
  assert.equal(roundTo(0.005, 2), 0.01);
  assert.equal(roundTo(2.676, 2), 2.68);
  assert.equal(roundTo(7612.004, 2), 7612);
  assert.ok(Object.is(roundTo(-0.00001, 2), 0), '-0 必须归一成 0');
  assert.ok(Number.isNaN(roundTo(NaN)));

  assert.equal(formatPrice(618.8, 2), '618.80');
  assert.equal(formatPrice(7612, 2), '7,612.00');
  assert.equal(formatPrice(1234567.891, 2), '1,234,567.89');
  assert.equal(formatPrice(0, 2), '0.00');
  assert.equal(formatPrice(NaN), '—');
  assert.equal(formatPrice(Infinity), '—');
});

test('formatSigned / formatPct：带符号、0 无符号', () => {
  assert.equal(formatSigned(6.4, 2), '+6.40');
  assert.equal(formatSigned(-32, 2), '-32.00');
  assert.equal(formatSigned(0, 2), '0.00');
  assert.equal(formatSigned(-1234.5, 2), '-1,234.50');
  assert.equal(formatSigned(NaN, 2), '—');

  assert.equal(formatPct(1.045, 2), '+1.05%');
  assert.equal(formatPct(-0.42, 2), '-0.42%');
  assert.equal(formatPct(0, 2), '0.00%');
  assert.equal(formatPct(NaN, 2), '—');
});

test('stepMetals：单 tick 波动不超过 ±0.06%，保留 2 位小数', () => {
  const before = buildMetals(seeded(SEED));
  const after = stepMetals(before, seeded(99));

  assert.equal(after.length, 2);
  for (const [i, next] of after.entries()) {
    const prev = before[i];
    const max = prev.price * STEP_LIMIT + 0.0051; // 2 位小数取整的最大误差
    assert.ok(Math.abs(next.price - prev.price) <= max, `${next.name} 单 tick 波动超限`);
    assert.ok(isTwoDecimals(next.price));
    assert.equal(next.history.length, HISTORY_LEN);
    assert.equal(next.history.at(-1), next.price);
    assert.equal(next.history[0], prev.history[1], '走势向左滚动一格');
    assert.equal(next.open, prev.open, '今开不随每 5 秒的波动改变');
    assert.equal(next.delta, roundTo(next.price - next.prevClose, 2));
    assert.equal(next.pct, changeOf(next.price, next.prevClose).pct);
    assert.equal(next.trend, changeOf(next.price, next.prevClose).trend);
  }
});

test('stepMetals：极端随机值下仍受波动上限约束', () => {
  const before = buildMetals(seeded(1));
  const up = stepMetals(before, () => 0.999999);
  const down = stepMetals(before, () => 0);
  for (const [i, r] of up.entries()) {
    assert.ok(r.price >= before[i].price, '最大值随机源应让价格上行');
    assert.ok(r.price <= before[i].price * (1 + STEP_LIMIT) + 0.0051);
  }
  for (const [i, r] of down.entries()) {
    assert.ok(r.price <= before[i].price, '最小值随机源应让价格下行');
    assert.ok(r.price >= before[i].price * (1 - STEP_LIMIT) - 0.0051);
  }
});

test('stepMetals：不修改入参，返回新数组', () => {
  const before = buildMetals(seeded(SEED));
  const snapshot = JSON.parse(JSON.stringify(before));
  const after = stepMetals(before, seeded(5));
  assert.notEqual(after, before);
  assert.deepEqual(before, snapshot, '原数组不能被就地修改');
  after[0].price = 1;
  after[0].history.push(1);
  assert.deepEqual(before, snapshot, '修改返回数组不能影响入参');
});

test('stepMetals：非法输入不抛错', () => {
  assert.deepEqual(stepMetals(null), []);
  assert.deepEqual(stepMetals(undefined), []);
  const bad = [{ key: 'gold', name: '黄金', price: NaN, prevClose: 612.4, digits: 2, step: 0.0006, history: [1] }];
  const out = stepMetals(bad, () => 0.5);
  assert.equal(out.length, 1);
  assert.ok(Number.isNaN(out[0].price));
});

test('stepMetals：长时间随机游走仍限制在昨收 ±2.5% 内', () => {
  let metals = buildMetals(seeded(SEED));
  const rand = seeded(42);
  for (let tick = 0; tick < 4000; tick += 1) {
    metals = stepMetals(metals, rand);
    for (const m of metals) {
      const pct = ((m.price - m.prevClose) / m.prevClose) * 100;
      assert.ok(Math.abs(pct) <= DAILY_LIMIT * 100 + 0.01, `第 ${tick} 次波动后 ${m.name} 超出当日涨跌幅上限`);
      assert.ok(m.history.every((v) => v > 0));
    }
  }
});

test('sparkGeometry：折线在画布内、末点对应现价、昨收虚线在范围内', () => {
  const values = [10, 11, 10.5, 12, 13];
  const geo = sparkGeometry(values, { width: 100, height: 50, pad: 4, baseline: 10.8 });
  assert.ok(geo);
  assert.match(geo.line, /^M\d+(\.\d)?,\d+(\.\d)?(L\d+(\.\d)?,\d+(\.\d)?){4}$/);
  assert.match(geo.area, /Z$/);
  assert.equal(geo.width, 100);
  assert.equal(geo.height, 50);
  assert.ok(geo.last.x >= 94 && geo.last.x <= 96);
  assert.ok(geo.last.y >= 4 && geo.last.y <= 46);
  assert.ok(geo.baselineY >= 4 && geo.baselineY <= 46);
  assert.ok(geo.baselineY > geo.last.y, '昨收低于最高价，虚线应在末点下方');

  // 低于所有价格时，纵轴范围被昨收撑开
  const low = sparkGeometry(values, { width: 100, height: 50, pad: 4, baseline: 5 });
  assert.ok(low.baselineY >= 4 && low.baselineY <= 46);
  assert.notEqual(low.line, geo.line);

  assert.equal(sparkGeometry([1], { width: 100, height: 50 }), null);
  assert.equal(sparkGeometry(null), null);
  assert.equal(sparkGeometry([1, 2], { width: 100, height: 50 }).baselineY, null);
});
