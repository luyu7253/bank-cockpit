import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFunnel, conversionRate, funnelWidth, FUNNEL_STAGES } from '../src/panels/wealth-funnel.js';

test('buildFunnel：5 个中文阶段，顺序固定', () => {
  const funnel = buildFunnel(() => 0.5);
  assert.equal(funnel.length, 5);
  assert.deepEqual(funnel.map((stage) => stage.name), FUNNEL_STAGES);
  assert.deepEqual(FUNNEL_STAGES, ['访问产品页', '风险测评', '预约咨询', '申购下单', '成交确认']);
});

test('buildFunnel：固定随机源得到建议量级且严格递减', () => {
  const funnel = buildFunnel(() => 0.5);
  assert.deepEqual(funnel.map((stage) => stage.value), [12860, 6420, 3150, 1480, 1126]);
  for (const stage of funnel) {
    assert.ok(Number.isInteger(stage.value), '人数必须是整数');
    assert.ok(stage.value > 0, '人数必须为正');
    assert.match(String(stage.value), /^\d+$/);
  }
});

test('buildFunnel：任意随机源下都严格递减且为正整数', () => {
  const sources = [
    () => 0,
    () => 0.5,
    () => 1,
    (() => {
      let x = 7;
      return () => {
        x = (x * 48271) % 2147483647;
        return x / 2147483647;
      };
    })(),
  ];
  for (const rand of sources) {
    const values = buildFunnel(rand).map((stage) => stage.value);
    assert.equal(values.length, 5);
    for (let i = 0; i < values.length; i += 1) {
      assert.ok(Number.isInteger(values[i]) && values[i] > 0, `第 ${i + 1} 阶段必须为正整数`);
      if (i > 0) assert.ok(values[i] < values[i - 1], `第 ${i + 1} 阶段必须小于上一阶段`);
    }
  }
});

test('conversionRate：相对上一阶段，保留 1 位小数', () => {
  assert.equal(conversionRate(12860, 6420), 49.9);
  assert.equal(conversionRate(6420, 3150), 49.1);
  assert.equal(conversionRate(1480, 1126), 76.1);
  assert.equal(conversionRate(1126, 1126), 100);
  assert.equal(conversionRate(1000, 499), 49.9);
  assert.equal(conversionRate(3, 1), 33.3);
  assert.equal(conversionRate(100, 0), 0);
});

test('conversionRate：没有上一阶段或非法输入返回 null', () => {
  assert.equal(conversionRate(0, 100), null);
  assert.equal(conversionRate(-1, 100), null);
  assert.equal(conversionRate(Number.NaN, 100), null);
  assert.equal(conversionRate(100, Number.NaN), null);
  assert.equal(conversionRate(Number.POSITIVE_INFINITY, 100), null);
});

test('funnelWidth：按人数比例计算并限制在 72–360 之间', () => {
  assert.equal(funnelWidth(12860, 12860), 360);
  assert.equal(funnelWidth(0, 12860), 72);
  assert.equal(funnelWidth(-100, 12860), 72);
  assert.equal(funnelWidth(12860 * 2, 12860), 360);
  assert.equal(funnelWidth(12860 / 2, 12860), 216);
  assert.equal(funnelWidth(100, 0), 72);
  assert.equal(funnelWidth(Number.NaN, 12860), 72);
  for (const value of [0, 1, 100, 1126, 1480, 3150, 6420, 12860, 99999]) {
    const width = funnelWidth(value, 12860);
    assert.ok(width >= 72 && width <= 360, `${value} 的条宽 ${width} 超出范围`);
  }
});

test('funnelWidth：人数递减时条宽也递减', () => {
  const values = [12860, 6420, 3150, 1480, 1126];
  const widths = values.map((value) => funnelWidth(value, values[0]));
  for (let i = 1; i < widths.length; i += 1) {
    assert.ok(widths[i] < widths[i - 1], `第 ${i + 1} 条宽度必须小于上一条`);
    assert.ok(widths[i] > 0);
  }
});
