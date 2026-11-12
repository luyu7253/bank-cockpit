import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATM_OFFLINE,
  ATM_SEED,
  ATM_TARGET,
  ATM_TOTAL,
  buildAtmStatus,
  offlineCounts,
  topOfflineBranches,
} from '../src/panels/device-online-rate.js';

// 与 src/data.js 相同的 mulberry32，测试里只用于驱动面板导出的纯函数（不引入 DOM）。
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

const BRANCH_NAMES = [
  '上海分行', '北京分行', '深圳分行', '杭州分行', '南京分行',
  '成都分行', '武汉分行', '西安分行', '苏州分行', '重庆分行',
];

test('buildAtmStatus：2140 台、离线 30 台 → 在线率 98.6% 且达标', () => {
  const status = buildAtmStatus(ATM_TOTAL, ATM_OFFLINE);
  assert.equal(status.total, 2140);
  assert.equal(status.offline, 30);
  assert.equal(status.online, 2110);
  assert.equal(status.rate, 98.6);
  assert.equal(status.rate.toFixed(1), '98.6');
  assert.equal(status.target, ATM_TARGET);
  assert.equal(status.reached, true);
});

test('buildAtmStatus：默认参数与自定义口径自洽，非法离线数被收敛', () => {
  assert.deepEqual(buildAtmStatus(), buildAtmStatus(2140, 30));

  const half = buildAtmStatus(100, 12);
  assert.equal(half.online, 88);
  assert.equal(half.rate, 88);
  assert.equal(half.reached, false);

  const over = buildAtmStatus(100, 130);
  assert.equal(over.offline, 100);
  assert.equal(over.online, 0);
  assert.equal(over.rate, 0);

  assert.equal(buildAtmStatus(0, 0).rate, 0, '总数为 0 时不能除零');
  assert.equal(buildAtmStatus(NaN, 10).total, 2140, '非法总数回落到默认口径');
});

test('offlineCounts：10 家分行合计正好 30 台，且都是合法整数', () => {
  const rows = offlineCounts(seeded(ATM_SEED), BRANCH_NAMES, { total: ATM_OFFLINE });
  assert.equal(rows.length, 10);
  assert.equal(new Set(rows.map((row) => row.name)).size, 10);
  assert.deepEqual(rows.map((row) => row.name), BRANCH_NAMES, '保持入参分行顺序');

  let sum = 0;
  for (const row of rows) {
    assert.equal(Number.isInteger(row.offline), true, `${row.name} 的台数必须是整数`);
    assert.ok(row.offline >= 0 && row.offline <= ATM_OFFLINE, `${row.name} 的台数应在 0–30 之间`);
    sum += row.offline;
  }
  assert.equal(sum, ATM_OFFLINE, '合计必须正好 30 台');
});

test('offlineCounts：同一种子结果一致，且不修改分行入参', () => {
  const branches = BRANCH_NAMES.map((name) => ({ name }));
  const snapshot = JSON.stringify(branches);
  const a = offlineCounts(seeded(ATM_SEED), branches, { total: ATM_OFFLINE });
  const b = offlineCounts(seeded(ATM_SEED), branches, { total: ATM_OFFLINE });
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(branches), snapshot, '纯函数不应修改入参');

  const total = a.reduce((sum, row) => sum + row.offline, 0);
  assert.equal(total, ATM_OFFLINE);
});

test('offlineCounts：边界 total 与空分行列表', () => {
  assert.deepEqual(offlineCounts(seeded(ATM_SEED), [], { total: 30 }), []);
  const zero = offlineCounts(seeded(ATM_SEED), BRANCH_NAMES, { total: 0 });
  assert.equal(zero.every((row) => row.offline === 0), true);
  assert.equal(zero.reduce((sum, row) => sum + row.offline, 0), 0);
});

test('topOfflineBranches：取前 3 家，按离线台数降序', () => {
  const rows = offlineCounts(seeded(ATM_SEED), BRANCH_NAMES, { total: ATM_OFFLINE });
  const top = topOfflineBranches(rows, 3);

  assert.equal(top.length, 3);
  assert.equal(new Set(top.map((row) => row.name)).size, 3);
  assert.ok(top.every((row) => BRANCH_NAMES.includes(row.name)), '前 3 名必须来自分行列表');
  for (let i = 1; i < top.length; i += 1) {
    assert.ok(top[i - 1].offline >= top[i].offline, '必须按离线台数从多到少排列');
  }

  const expected = [...rows].sort((a, b) => b.offline - a.offline);
  assert.deepEqual(top.map((row) => row.offline), expected.slice(0, 3).map((row) => row.offline));
});

test('topOfflineBranches：台数相同时保持入参顺序、不修改入参', () => {
  const rows = [
    { name: '甲分行', offline: 4 },
    { name: '乙分行', offline: 7 },
    { name: '丙分行', offline: 4 },
    { name: '丁分行', offline: 1 },
  ];
  const snapshot = JSON.stringify(rows);
  const top = topOfflineBranches(rows, 3);
  assert.deepEqual(top.map((row) => row.name), ['乙分行', '甲分行', '丙分行'], '同台数时先出现的排前面');
  assert.equal(JSON.stringify(rows), snapshot, '纯函数不应修改入参');
  assert.deepEqual(topOfflineBranches([], 3), []);
});
