import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMobileTrend, formatWan, growthPct } from '../src/panels/mobile-active-users.js';

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

test('buildMobileTrend：生成 7 天趋势，末值固定 128.6', () => {
  const trend = buildMobileTrend(seeded(20261112));
  assert.equal(trend.length, 7);
  assert.equal(trend.at(-1), 128.6);
  for (const v of trend) {
    assert.ok(Number.isFinite(v), '每个点都必须是有限数值');
    assert.ok(v > 0, '日活必须为正');
    assert.equal(v, Math.round(v * 10) / 10, '保留 1 位小数');
  }
});

test('buildMobileTrend：同一种子结果一致，不修改传入的随机源', () => {
  const a = buildMobileTrend(seeded(20261112));
  const b = buildMobileTrend(seeded(20261112));
  assert.deepEqual(a, b);
  const c = buildMobileTrend(seeded(1));
  assert.notDeepEqual(a, c, '不同种子应产生不同形状');
});

test('formatWan：万户数值保留 1 位小数并加千分位', () => {
  assert.equal(formatWan(128.6), '128.6');
  assert.equal(formatWan(486.2), '486.2');
  assert.equal(formatWan(72.4), '72.4');
  assert.equal(formatWan(0), '0.0');
  assert.equal(formatWan(1234.56), '1,234.6');
  assert.equal(formatWan(-0.04), '0.0');
  assert.equal(formatWan('abc'), '—');
  assert.equal(formatWan(NaN), '—');
  assert.equal(formatWan(Infinity), '—');
});

test('growthPct：正增长、负增长、零增长与非法基数', () => {
  assert.equal(growthPct(128.6, 122.5), 5);
  assert.ok(growthPct(128.6, 122.5) > 0);
  assert.equal(growthPct(120, 125), -4);
  assert.ok(growthPct(120, 125) < 0);
  assert.equal(growthPct(128.6, 128.6), 0);
  assert.equal(growthPct(72.4, 67.9), 6.6);
  assert.equal(growthPct(100, 0), null);
  assert.equal(growthPct(NaN, 100), null);
  assert.equal(growthPct(100, NaN), null);
});
