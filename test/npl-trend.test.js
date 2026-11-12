import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNplSeries,
  latestPoint,
  thresholdStatus,
  STATUS_META,
  NPL_SEED,
  NPL_LIMIT,
  NPL_MONTHS,
  NPL_MIN,
  NPL_MAX,
} from '../src/panels/npl-trend.js';
import { current, seededRandom } from '../src/data.js';

test('近 12 个月序列：长度 12、全部落在 1.18–1.45、末值等于当前不良率', () => {
  const series = buildNplSeries(seededRandom(NPL_SEED), current.nplRatio);
  assert.equal(series.length, NPL_MONTHS);
  assert.equal(series.length, 12);
  for (const value of series) {
    assert.ok(value >= NPL_MIN && value <= NPL_MAX, `${value} 超出 ${NPL_MIN}–${NPL_MAX}`);
  }
  assert.equal(series.at(-1), current.nplRatio);
  // 倒数第二个月比当前高 0.02 个百分点，保证「较上月 -0.02」与曲线一致
  assert.equal(series.at(-2), 1.33);
});

test('固定种子下两次生成完全一致（刷新不跳数）', () => {
  const a = buildNplSeries(seededRandom(NPL_SEED), current.nplRatio);
  const b = buildNplSeries(seededRandom(NPL_SEED), current.nplRatio);
  assert.deepEqual(a, b);
});

test('latestPoint：末点、上月与环比', () => {
  const series = buildNplSeries(seededRandom(NPL_SEED), current.nplRatio);
  const latest = latestPoint(series);
  assert.equal(latest.index, 11);
  assert.equal(latest.value, 1.31);
  assert.equal(latest.prev, 1.33);
  assert.equal(latest.delta, -0.02);
  assert.equal(latestPoint([]), null);
});

test('thresholdStatus：安全 / 关注 / 超红线', () => {
  assert.equal(thresholdStatus(1.31, NPL_LIMIT), 'safe');
  assert.equal(thresholdStatus(1.42, NPL_LIMIT), 'safe');
  assert.equal(thresholdStatus(1.47, NPL_LIMIT), 'watch');
  assert.equal(thresholdStatus(1.5, NPL_LIMIT), 'breach');
  assert.equal(thresholdStatus(1.62, NPL_LIMIT), 'breach');
  assert.equal(thresholdStatus(Number.NaN, NPL_LIMIT), 'unknown');
});

test('状态元数据都带中文文字与图标，不只靠颜色表达', () => {
  for (const key of ['safe', 'watch', 'breach']) {
    assert.match(STATUS_META[key].label, /^[\u4e00-\u9fa5]+$/);
    assert.ok(STATUS_META[key].icon.length > 0);
  }
});
