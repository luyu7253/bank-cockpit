import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERT_SEED,
  LEVEL_META,
  createAlerts,
  minutesToTime,
  severityRank,
  sortAlerts,
  summaryOf,
  topAlert,
} from '../src/panels/risk-alerts.js';

// 与 src/data.js 的 mulberry32 相同，测试只 import 面板里的纯函数，不 import DOM 相关模块。
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BRANCHES = [{ name: '城北分行' }, { name: '滨江分行' }, { name: '临港分行' }];

test('固定种子生成 4 条预警，严重程度从高到低', () => {
  const alerts = createAlerts(seededRandom(ALERT_SEED), BRANCHES);
  assert.equal(alerts.length, 4);
  assert.deepEqual(alerts.map((a) => a.id), ['npl', 'large-tx', 'outflow', 'top5-loans']);
  assert.deepEqual(alerts.map((a) => a.level), ['critical', 'warning', 'warning', 'info']);
  assert.ok(alerts.every((a) => a.title.length > 0));
  assert.ok(alerts.every((a) => /^\d{2}:\d{2}$/.test(a.time)));
});

test('固定种子下金额、比例、分行名与时间可复现', () => {
  const alerts = createAlerts(seededRandom(ALERT_SEED), BRANCHES);
  assert.deepEqual(alerts.map((a) => a.title), [
    '临港分行不良率 4.86%，逼近 5% 监管红线',
    '单笔大额交易 2,860 万元',
    '存款日间净流出 3.24 亿元',
    '前 5 大客户贷款占比 42.1%',
  ]);
  assert.deepEqual(alerts.map((a) => a.time), ['14:32', '14:20', '13:54', '13:30']);

  const again = createAlerts(seededRandom(ALERT_SEED), BRANCHES);
  assert.deepEqual(alerts, again, '同一固定种子重复生成结果应完全一致');
});

test('数值处于合理区间，且不良率逼近但未越过 5% 红线', () => {
  const alerts = createAlerts(seededRandom(ALERT_SEED), BRANCHES);
  const npl = Number(alerts[0].title.match(/不良率 ([\d.]+)%/)?.[1]);
  assert.ok(npl >= 4.8 && npl < 5, `不良率 ${npl} 应在 4.8% ~ 5% 之间`);

  const tx = Number(alerts[1].title.match(/([\d,]+) 万元/)?.[1].replace(/,/g, ''));
  assert.ok(tx >= 2490 && tx <= 2990, `大额交易 ${tx} 万元应在 2,490 ~ 2,990 万元`);
  assert.equal(tx % 10, 0);

  const outflow = Number(alerts[2].title.match(/净流出 ([\d.]+) 亿元/)?.[1]);
  assert.ok(outflow >= 2.81 && outflow <= 3.41, `净流出 ${outflow} 亿元应在 2.81 ~ 3.41 亿元`);

  const top5 = Number(alerts[3].title.match(/占比 ([\d.]+)%/)?.[1]);
  assert.ok(top5 >= 40.5 && top5 <= 48.5, `前 5 大客户占比 ${top5}% 应在 40.5% ~ 48.5%`);
});

test('分行名来自传入的模拟分行列表', () => {
  const alerts = createAlerts(seededRandom(ALERT_SEED), ['甲分行', '乙分行']);
  assert.match(alerts[0].title, /^(甲分行|乙分行)不良率/);
  assert.doesNotMatch(alerts[0].title, /真实/);
});

test('sortAlerts 按严重程度降序，返回新数组且不修改原数组', () => {
  const alerts = createAlerts(seededRandom(ALERT_SEED), BRANCHES);
  const scrambled = [alerts[3], alerts[1], alerts[2], alerts[0]];
  const sorted = sortAlerts(scrambled);
  assert.deepEqual(sorted.map((a) => a.id), ['npl', 'large-tx', 'outflow', 'top5-loans']);
  assert.deepEqual(sorted.map((a) => severityRank(a.level)), [0, 1, 1, 2]);
  assert.deepEqual(scrambled.map((a) => a.id), ['top5-loans', 'large-tx', 'outflow', 'npl']);
  assert.notEqual(sorted, scrambled);
});

test('同严重程度按时间从近到远排序', () => {
  const alerts = [
    { id: 'b', level: 'warning', at: 800, time: '13:20' },
    { id: 'a', level: 'warning', at: 860, time: '14:20' },
    { id: 'c', level: 'critical', at: 700, time: '11:40' },
  ];
  assert.deepEqual(sortAlerts(alerts).map((a) => a.id), ['c', 'a', 'b']);
});

test('未知严重程度排在最后', () => {
  assert.ok(severityRank('unknown') > severityRank('info'));
  assert.equal(severityRank('critical'), 0);
  assert.equal(severityRank('warning'), 1);
  assert.equal(severityRank('info'), 2);
});

test('topAlert 返回最严重的一条，空列表返回 null', () => {
  const alerts = createAlerts(seededRandom(ALERT_SEED), BRANCHES);
  assert.equal(topAlert(alerts)?.id, 'npl');
  assert.equal(topAlert([]), null);
});

test('summaryOf 统计总数与各严重程度，未知级别计入 other', () => {
  const alerts = createAlerts(seededRandom(ALERT_SEED), BRANCHES);
  assert.deepEqual(summaryOf(alerts), { total: 4, critical: 1, warning: 2, info: 1, other: 0 });

  const withUnknown = [...alerts, { id: 'x', level: 'mystery', title: '未知' }];
  assert.deepEqual(summaryOf(withUnknown), { total: 5, critical: 1, warning: 2, info: 1, other: 1 });
  assert.deepEqual(summaryOf([]), { total: 0, critical: 0, warning: 0, info: 0, other: 0 });
  assert.deepEqual(summaryOf(null), { total: 0, critical: 0, warning: 0, info: 0, other: 0 });
});

test('每种严重程度都有中文文字和图标，不只靠颜色表达', () => {
  for (const level of ['critical', 'warning', 'info']) {
    assert.match(LEVEL_META[level].label, /^[\u4e00-\u9fa5]+$/, `${level} 缺少中文文字`);
    assert.ok(LEVEL_META[level].icon.length > 0, `${level} 缺少图标`);
  }
});

test('minutesToTime 输出 HH:MM 并处理跨天', () => {
  assert.equal(minutesToTime(14 * 60 + 32), '14:32');
  assert.equal(minutesToTime(0), '00:00');
  assert.equal(minutesToTime(1440 + 5), '00:05');
});
