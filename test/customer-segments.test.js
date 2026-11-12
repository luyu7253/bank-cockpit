import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSegments, normalizeShares, formatWan } from '../src/panels/customer-segments.js';

// 与 src/data.js 的 mulberry32 同款，测试里自带一份，避免依赖浏览器/页面数据。
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

const sum = (list) => list.reduce((s, v) => s + v, 0);
const oneDecimal = (v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;

test('normalizeShares：等分时直接得到 25/25/25/25', () => {
  assert.deepEqual(normalizeShares([1, 1, 1, 1]), [25, 25, 25, 25]);
});

test('normalizeShares：合计严格归一到 100，且每项只有 1 位小数', () => {
  const cases = [
    [1, 1, 1],
    [3, 2, 1],
    [17.3, 9.8, 6.4, 2.1],
    [0.1, 0.2, 0.3],
    [500, 300, 199, 1],
  ];
  for (const values of cases) {
    const shares = normalizeShares(values);
    assert.equal(shares.length, values.length);
    assert.ok(Math.abs(sum(shares) - 100) < 1e-9, `${values.join('/')} 合计 ${sum(shares)}`);
    for (const v of shares) assert.ok(oneDecimal(v), `${v} 不是 1 位小数`);
  }
  assert.deepEqual(normalizeShares([3, 2, 1]), [50, 33.3, 16.7]);
  assert.deepEqual(normalizeShares([1, 1, 1]), [33.4, 33.3, 33.3]);
});

test('normalizeShares：全 0 输入返回全 0，不产生 NaN', () => {
  assert.deepEqual(normalizeShares([0, 0, 0, 0]), [0, 0, 0, 0]);
  assert.deepEqual(normalizeShares([]), []);
});

test('formatWan：1 位小数 + 千分位', () => {
  assert.equal(formatWan(620.4), '620.4');
  assert.equal(formatWan(1002.64), '1,002.6');
  assert.equal(formatWan(0), '0.0');
  assert.equal(formatWan(1234.56), '1,234.6');
});

test('buildSegments：四层客户、AUM 合计 1,200–1,400 亿元、客户约 1,000 万户', () => {
  const segments = buildSegments(seeded(20261112));
  assert.equal(segments.length, 4);
  assert.deepEqual(segments.map((s) => s.name), ['大众客户', '潜力客户', '财富客户', '私行客户']);

  const aumTotal = sum(segments.map((s) => s.aum));
  const customerTotal = sum(segments.map((s) => s.customers));
  assert.ok(aumTotal >= 1200 && aumTotal <= 1400, `AUM 合计 ${aumTotal}`);
  assert.ok(customerTotal >= 950 && customerTotal <= 1100, `客户合计 ${customerTotal}`);
  assert.ok(Math.abs(aumTotal - Math.round(aumTotal * 10) / 10) < 1e-9, 'AUM 合计应为 1 位小数');

  for (const s of segments) {
    assert.ok(s.aum > 0);
    assert.ok(s.customers > 0);
    assert.ok(oneDecimal(s.aum), `${s.name} AUM 小数位异常`);
    assert.ok(oneDecimal(s.customers), `${s.name} 客户数小数位异常`);
    assert.ok(s.share > 0 && s.share <= 100);
    assert.ok(oneDecimal(s.share));
    assert.ok(s.delta >= -4.5 && s.delta <= 4.5, `${s.name} 环比 ${s.delta}`);
  }
});

test('buildSegments：占比归一到 100，且按 AUM 降序排列', () => {
  for (const seed of [20261112, 1, 42, 987654321]) {
    const segments = buildSegments(seeded(seed));
    const shares = segments.map((s) => s.share);
    assert.ok(Math.abs(sum(shares) - 100) < 1e-9, `seed ${seed} 占比合计 ${sum(shares)}`);
    for (let i = 1; i < segments.length; i += 1) {
      assert.ok(segments[i - 1].aum >= segments[i].aum, `seed ${seed} 未按 AUM 降序`);
    }
  }
});

test('buildSegments：同一种子结果完全一致（刷新不跳数）', () => {
  const a = buildSegments(seeded(20261112));
  const b = buildSegments(seeded(20261112));
  assert.deepEqual(a, b);
});

test('buildSegments：传入非法随机函数时报错', () => {
  assert.throws(() => buildSegments(null), TypeError);
});
