import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringLayout, scale, arcPath, gaugeArc, regulatoryState, sparkPath } from '../src/layout.js';
import { regulatory, kpiTrend } from '../src/data.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('环形布局：第一个点在正上方，点数正确', () => {
  const pts = ringLayout(4, 100, 100, 50, 30);
  assert.equal(pts.length, 4);
  near(pts[0].x, 100); near(pts[0].y, 70);
  near(pts[1].x, 150); near(pts[1].y, 100);
});

test('线性映射会夹住越界值', () => {
  assert.equal(scale(5, 0, 10, 0, 100), 50);
  assert.equal(scale(-1, 0, 10, 0, 100), 0);
  assert.equal(scale(99, 0, 10, 0, 100), 100);
  assert.equal(scale(3, 2, 2, 7, 9), 7);
});

test('弧线 path 以起点开头、终点结尾', () => {
  const d = arcPath(0, 0, 100, 0);
  assert.match(d, /^M0\.0,0\.0 Q/);
  assert.match(d, /100\.0,0\.0$/);
});

test('仪表盘弧：0 只有起点，超过一半用大弧标记', () => {
  assert.doesNotMatch(gaugeArc(50, 50, 40, 0), /A/);
  assert.match(gaugeArc(50, 50, 40, 0.9), / 0 1 1 /);
  assert.match(gaugeArc(50, 50, 40, 0.3), / 0 0 1 /);
});

test('监管状态：安全 / 关注 / 突破红线', () => {
  assert.equal(regulatoryState({ value: 13.6, limit: 10.5, better: 'high' }), 'safe');
  assert.equal(regulatoryState({ value: 11, limit: 10.5, better: 'high' }), 'watch');
  assert.equal(regulatoryState({ value: 9, limit: 10.5, better: 'high' }), 'breach');
  assert.equal(regulatoryState({ value: 1.31, limit: 5, better: 'low' }), 'safe');
  assert.equal(regulatoryState({ value: 5.2, limit: 5, better: 'low' }), 'breach');
});

test('迷你趋势线：点数一致，常数序列不报错', () => {
  assert.equal((sparkPath([1, 2, 3], 60, 20).match(/[ML]/g) || []).length, 3);
  assert.ok(sparkPath([2, 2, 2], 60, 20).startsWith('M'));
  assert.equal(sparkPath([1], 60, 20), '');
});

test('演示数据：监管指标当前都在安全区，趋势序列 12 个月', () => {
  assert.ok(regulatory.every((r) => regulatoryState(r) === 'safe'));
  assert.ok(Object.values(kpiTrend).every((s) => s.length === 12));
});

import { mercator } from '../src/layout.js';
import { cityCoords, HQ, branches, finance } from '../src/data.js';

test('墨卡托：原点为 0，东为正、北为正，纬度越高拉伸越大', () => {
  const [x0, y0] = mercator(104, 35);
  assert.ok(Math.abs(x0) < 1e-12 && Math.abs(y0) < 1e-12);
  const [xe] = mercator(121, 35); assert.ok(xe > 0);
  const [, yn] = mercator(104, 45); assert.ok(yn > 0);
  const dyHigh = mercator(104, 50)[1] - mercator(104, 45)[1];
  const dyLow = mercator(104, 25)[1] - mercator(104, 20)[1];
  assert.ok(dyHigh > dyLow);
});

test('每个分行都有坐标，总行在上海', () => {
  for (const b of branches) assert.ok(cityCoords[b.name.replace('分行', '')], b.name);
  assert.deepEqual([HQ.lon, HQ.lat], cityCoords['上海']);
});

test('经营指标都有 12 个月走势', () => {
  for (const v of Object.values(finance)) assert.equal(v.trend.length, 12);
});
