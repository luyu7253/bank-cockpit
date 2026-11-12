import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERT_SEED,
  SEVERITY_META,
  createAlerts,
  severityRank,
  sortAlerts,
  topAlert,
} from '../src/panels/slot-a.js';
import { seededRandom } from '../src/data.js';

test('A 区风险预警：固定种子生成 4 条模拟预警', () => {
  const alerts = createAlerts(seededRandom(ALERT_SEED));
  assert.equal(alerts.length, 4);
  assert.deepEqual(alerts.map((a) => a.id), ['concentration', 'npl', 'outflow', 'large-tx']);
  assert.ok(alerts.every((a) => a.title && a.detail && a.meta && a.level));
  assert.ok(alerts.every((a) => Number.isFinite(a.score)));
});

test('同一固定种子重复生成结果一致', () => {
  const a = createAlerts(seededRandom(ALERT_SEED));
  const b = createAlerts(seededRandom(ALERT_SEED));
  assert.deepEqual(a, b);
});

test('按严重程度排序，返回新数组且不改原数组', () => {
  const alerts = createAlerts(seededRandom(ALERT_SEED));
  const scrambled = [alerts[3], alerts[2], alerts[1], alerts[0]];
  const sorted = sortAlerts(scrambled);
  assert.deepEqual(sorted.map((a) => a.id), ['concentration', 'npl', 'outflow', 'large-tx']);
  assert.deepEqual(sorted.map((a) => severityRank(a.level)), [0, 1, 2, 3]);
  assert.equal(scrambled[0].id, 'large-tx', '原数组不应被排序修改');
});

test('最严重的一条是客户集中度预警，空列表返回 null', () => {
  const alerts = createAlerts(seededRandom(ALERT_SEED));
  assert.equal(topAlert(alerts)?.id, 'concentration');
  assert.equal(topAlert([]), null);
});

test('未知严重级别排在最后', () => {
  assert.ok(severityRank('unknown') > severityRank('low'));
  assert.equal(severityRank('critical'), 0);
});

test('每个严重程度都同时有图标和中文文字', () => {
  for (const level of ['critical', 'high', 'medium', 'low']) {
    assert.ok(SEVERITY_META[level].icon.length > 0, `${level} 缺少图标`);
    assert.match(SEVERITY_META[level].label, /^[\u4e00-\u9fa5]+$/, `${level} 缺少中文文字`);
  }
});

test('模拟数值处于预警文案描述的合理区间', () => {
  const alerts = createAlerts(seededRandom(ALERT_SEED));
  const byId = Object.fromEntries(alerts.map((a) => [a.id, a]));

  const npl = Number(byId.npl.detail.match(/不良率 ([\d.]+)%/)?.[1]);
  assert.ok(npl >= 4.72 && npl < 5, `不良率 ${npl} 应逼近但低于 5%`);

  const outflow = Number(byId.outflow.detail.match(/净流出 ([\d.]+) 亿元/)?.[1]);
  assert.ok(outflow >= 3.4 && outflow <= 3.9, `流出 ${outflow} 亿元应在 3.4~3.9 亿元`);

  const concentration = Number(byId.concentration.detail.match(/集中度 ([\d.]+)%/)?.[1]);
  assert.ok(concentration > 30 && concentration < 36, `集中度 ${concentration}% 应超过 30% 限额`);

  assert.match(byId['large-tx'].detail, /单笔转账 [\d,]+ 万元/);
});
