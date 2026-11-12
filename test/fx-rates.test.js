import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FX_BASE, STEP_LIMIT, buildFxRates, stepRates, formatRate, trendOf, formatDelta,
} from '../src/panels/fx-rates.js';

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

const isFourDecimals = (v) => Number.isFinite(v) && Math.abs(v * 1e4 - Math.round(v * 1e4)) < 1e-6;

test('buildFxRates：固定 5 种货币，初始牌价与设计值一致', () => {
  const rates = buildFxRates(seeded(20261112));
  assert.equal(rates.length, 5);
  assert.deepEqual(rates.map((r) => r.name), ['美元', '欧元', '日元', '港币', '英镑']);
  assert.deepEqual(rates.map((r) => r.code), ['USD', 'EUR', 'JPY', 'HKD', 'GBP']);
  assert.deepEqual(
    rates.map((r) => [r.buy, r.sell]),
    [[7.1234, 7.1562], [7.7412, 7.789], [4.7231, 4.7586], [0.9123, 0.9158], [9.0123, 9.0567]],
  );
  for (const [i, r] of rates.entries()) {
    assert.equal(r.buy, FX_BASE[i].buy);
    assert.equal(r.sell, FX_BASE[i].sell);
    assert.deepEqual([r.name, r.buy, r.sell], [FX_BASE[i].name, FX_BASE[i].buy, FX_BASE[i].sell]);
  }
  assert.equal(rates[2].note, '100 日元', '日元行必须标注按 100 日元报价');
});

test('buildFxRates：买卖价差为正、价格保留 4 位小数', () => {
  for (const r of buildFxRates(seeded(7))) {
    assert.ok(r.sell > r.buy, `${r.name} 的卖出价必须高于买入价`);
    assert.ok(r.sell - r.buy > 0);
    assert.ok(isFourDecimals(r.buy), `${r.name} 买入价保留 4 位小数`);
    assert.ok(isFourDecimals(r.sell), `${r.name} 卖出价保留 4 位小数`);
  }
});

test('buildFxRates：固定种子结果一致，且首屏涨跌有正有负、幅度小幅', () => {
  const a = buildFxRates(seeded(20261112));
  const b = buildFxRates(seeded(20261112));
  assert.deepEqual(a, b, '同一种子必须得到相同首屏');
  assert.notDeepEqual(a, buildFxRates(seeded(20261113)), '不同种子应有不同涨跌');

  const signs = new Set(a.map((r) => r.trend));
  assert.ok(signs.has('up'), '首屏必须有上涨');
  assert.ok(signs.has('down'), '首屏必须有下跌');
  for (const r of a) {
    assert.notEqual(r.trend, 'flat', '首屏涨跌不能是持平');
    assert.ok(Math.abs(r.delta) >= 0.0004 && Math.abs(r.delta) <= 0.002, '首屏涨跌应为小幅');
    assert.ok(isFourDecimals(r.delta));
    assert.equal(trendOf(r.delta), r.trend);
    assert.equal(formatRate(r.prevBuy + r.delta) === formatRate(r.buy), true);
  }
});

test('stepRates：波动不超过 ±0.02%，保留 4 位小数且价差仍为正', () => {
  const before = buildFxRates(seeded(20261112));
  const after = stepRates(before, seeded(99));

  assert.equal(after.length, 5);
  for (const [i, next] of after.entries()) {
    const prev = before[i];
    const maxBuy = prev.buy * STEP_LIMIT + 0.000051;
    const maxSell = prev.sell * STEP_LIMIT + 0.000051;
    assert.ok(Math.abs(next.buy - prev.buy) <= maxBuy, `${next.name} 买入价波动超限`);
    assert.ok(Math.abs(next.sell - prev.sell) <= maxSell, `${next.name} 卖出价波动超限`);
    assert.ok(next.sell > next.buy, `${next.name} 波动后价差必须仍为正`);
    assert.ok(isFourDecimals(next.buy));
    assert.ok(isFourDecimals(next.sell));
    assert.equal(next.prevBuy, prev.buy);
    assert.equal(next.prevSell, prev.sell);
    assert.equal(next.delta, Math.round((next.buy - prev.buy) * 1e4) / 1e4);
    assert.equal(next.trend, trendOf(next.delta));
  }
});

test('stepRates：极端随机值下仍受 ±0.02% 上限约束', () => {
  const before = buildFxRates(seeded(1));
  const up = stepRates(before, () => 0.999999);
  const down = stepRates(before, () => 0);
  for (const [i, r] of up.entries()) {
    assert.ok(r.buy >= before[i].buy, '最大值随机源应让买入价上行');
    assert.ok(r.sell >= before[i].sell);
    assert.ok(r.buy <= before[i].buy * (1 + STEP_LIMIT) + 0.000051);
  }
  for (const [i, r] of down.entries()) {
    assert.ok(r.buy <= before[i].buy, '最小值随机源应让买入价下行');
    assert.ok(r.buy >= before[i].buy * (1 - STEP_LIMIT) - 0.000051);
  }
});

test('stepRates：不修改入参，返回新数组', () => {
  const before = buildFxRates(seeded(20261112));
  const snapshot = JSON.parse(JSON.stringify(before));
  const after = stepRates(before, seeded(5));
  assert.notEqual(after, before);
  assert.deepEqual(before, snapshot, '原数组不能被就地修改');
  after[0].buy = 1;
  assert.deepEqual(before, snapshot, '修改返回数组不能影响入参');
});

test('stepRates：非法输入不抛错', () => {
  assert.deepEqual(stepRates(null), []);
  assert.deepEqual(stepRates(undefined), []);
  const bad = [{ code: 'USD', name: '美元', buy: NaN, sell: 7 }];
  const out = stepRates(bad, () => 0.5);
  assert.equal(out.length, 1);
  assert.ok(Number.isNaN(out[0].buy));
});

test('formatRate：固定 4 位小数，非法值为「—」', () => {
  assert.equal(formatRate(7.1234), '7.1234');
  assert.equal(formatRate(7.7), '7.7000');
  assert.equal(formatRate(0), '0.0000');
  assert.equal(formatRate(0.912345), '0.9123');
  assert.equal(formatRate(9.05676), '9.0568');
  assert.equal(formatRate(-0.00001), '0.0000');
  assert.equal(formatRate('abc'), '—');
  assert.equal(formatRate(NaN), '—');
  assert.equal(formatRate(Infinity), '—');
});

test('trendOf：涨、跌、持平判断', () => {
  assert.equal(trendOf(0.0012), 'up');
  assert.equal(trendOf(-0.0008), 'down');
  assert.equal(trendOf(0), 'flat');
  assert.equal(trendOf(0.00001), 'flat', '不足 4 位小数可显示的幅度视为持平');
  assert.equal(trendOf(-0.00001), 'flat');
  assert.equal(trendOf(NaN), 'flat');
  assert.equal(trendOf('0.001'), 'up');
});

test('formatDelta：箭头 + 带符号数字，持平时为「—」', () => {
  assert.deepEqual(formatDelta(0.0012), { trend: 'up', text: '▲ +0.0012' });
  assert.deepEqual(formatDelta(-0.0008), { trend: 'down', text: '▼ -0.0008' });
  assert.deepEqual(formatDelta(0), { trend: 'flat', text: '—' });
});

test('stepRates：长时间随机游走后买卖价差仍为正', () => {
  let rates = buildFxRates(seeded(20261112));
  const rand = seeded(42);
  for (let tick = 0; tick < 3000; tick += 1) {
    rates = stepRates(rates, rand);
    for (const r of rates) assert.ok(r.sell > r.buy, `第 ${tick} 次波动后 ${r.name} 价差必须为正`);
  }
});
