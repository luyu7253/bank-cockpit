import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUEUE_BASE,
  QUEUE_MAX,
  QUEUE_SEED,
  QUEUE_THRESHOLD,
  averageQueue,
  buildQueueRows,
  formatQueueMinutes,
  isOverQueueTime,
  queueBarPct,
} from '../src/panels/branch-queue-time.js';

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

test('isOverQueueTime：严格大于 15 分钟才算超时', () => {
  assert.equal(QUEUE_THRESHOLD, 15);
  assert.equal(isOverQueueTime(15), false, '正好 15 分钟不算超时');
  assert.equal(isOverQueueTime(15.01), true);
  assert.equal(isOverQueueTime(15.1), true);
  assert.equal(isOverQueueTime(8.4), false);
  assert.equal(isOverQueueTime(NaN), false, '非法值按正常处理');
  assert.equal(isOverQueueTime('16.2'), true, '数字字符串按数值处理');
  assert.equal(isOverQueueTime(20, 18), true);
  assert.equal(isOverQueueTime(17, 18), false);
});

test('buildQueueRows：只取前 5 家、每家都有分钟数与状态，按分钟数降序', () => {
  const rows = buildQueueRows(seeded(QUEUE_SEED), BRANCH_NAMES);

  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((row) => row.name).sort(), BRANCH_NAMES.slice(0, 5).sort());
  assert.equal(new Set(rows.map((row) => row.name)).size, 5);
  for (const row of rows) {
    assert.equal(typeof row.minutes, 'number');
    assert.ok(row.minutes >= 0 && row.minutes < 60, `${row.name} 的分钟数应在合理范围`);
    assert.equal(Math.round(row.minutes * 10) / 10, row.minutes, '分钟数保留 1 位小数');
    assert.equal(row.over, row.minutes > QUEUE_THRESHOLD, '超时状态必须与分钟数一致');
    assert.equal(row.tone, row.over ? 'bad' : 'good');
  }
  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(rows[i - 1].minutes >= rows[i].minutes, '必须按排队分钟数从多到少排列');
  }
});

test('buildQueueRows：首屏同时有超时与正常两家，红色标记有实际对象', () => {
  const rows = buildQueueRows(seeded(QUEUE_SEED), BRANCH_NAMES);
  const over = rows.filter((row) => row.over);
  const normal = rows.filter((row) => !row.over);
  assert.ok(over.length >= 1, '至少要有 1 家超过 15 分钟');
  assert.ok(normal.length >= 1, '至少要有 1 家不超过 15 分钟');
  assert.ok(over.every((row) => row.minutes > 15));
  assert.ok(normal.every((row) => row.minutes <= 15));
});

test('buildQueueRows：同一种子结果一致，且不修改分行入参', () => {
  const branches = BRANCH_NAMES.map((name) => ({ name }));
  const snapshot = JSON.stringify(branches);
  const a = buildQueueRows(seeded(QUEUE_SEED), branches);
  const b = buildQueueRows(seeded(QUEUE_SEED), branches);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(branches), snapshot, '纯函数不应修改入参');
});

test('buildQueueRows：兼容字符串/对象分行、空列表与非法随机源', () => {
  const fromStrings = buildQueueRows(seeded(QUEUE_SEED), BRANCH_NAMES, { threshold: 12 });
  assert.equal(fromStrings.length, 5);
  assert.ok(fromStrings.every((row) => row.over === (row.minutes > 12)));

  assert.deepEqual(buildQueueRows(seeded(QUEUE_SEED), []), []);
  assert.deepEqual(buildQueueRows(seeded(QUEUE_SEED), null), []);

  const fallback = buildQueueRows(undefined, BRANCH_NAMES);
  assert.equal(fallback.length, 5);
  assert.ok(fallback.every((row) => Number.isFinite(row.minutes)));
});

test('averageQueue：5 家平均保留 1 位小数，空列表为 0', () => {
  assert.equal(averageQueue([{ minutes: 10 }, { minutes: 20 }]), 15);
  assert.equal(averageQueue([{ minutes: 10 }, { minutes: 11 }, { minutes: 12 }]), 11);
  assert.equal(averageQueue([{ minutes: 10.1 }, { minutes: 10.2 }]), 10.2, '四舍五入到 1 位小数');
  assert.equal(averageQueue([]), 0);
  assert.equal(averageQueue(null), 0);
  assert.equal(averageQueue([{ minutes: NaN }, { minutes: 8 }]), 8, '忽略非法值');
  assert.equal(averageQueue([{ minutes: NaN }]), 0);

  const rows = buildQueueRows(seeded(QUEUE_SEED), BRANCH_NAMES);
  const expected = Math.round((rows.reduce((sum, row) => sum + row.minutes, 0) / rows.length) * 10) / 10;
  assert.equal(averageQueue(rows), expected);
});

test('queueBarPct：15 分钟在 30 分钟满格刻度上正好 50%，越界被夹住', () => {
  assert.equal(QUEUE_MAX, 30);
  assert.equal(queueBarPct(0), 0);
  assert.equal(queueBarPct(15), 50);
  assert.equal(queueBarPct(23.4), 78);
  assert.equal(queueBarPct(30), 100);
  assert.equal(queueBarPct(45), 100, '超过满格仍夹在 100%');
  assert.equal(queueBarPct(-2), 0);
  assert.equal(queueBarPct(NaN), 0);
  assert.equal(queueBarPct(10, 20), 50, '可自定义满格刻度');
  assert.equal(queueBarPct(10, 0), 0, '满格刻度为 0 时不能除零');
});

test('formatQueueMinutes：固定 1 位小数，非法值显示破折号', () => {
  assert.equal(formatQueueMinutes(12.34), '12.3');
  assert.equal(formatQueueMinutes(15), '15.0');
  assert.equal(formatQueueMinutes(0), '0.0');
  assert.equal(formatQueueMinutes('18.26'), '18.3');
  assert.equal(formatQueueMinutes(NaN), '—');
  assert.equal(formatQueueMinutes(undefined), '—');
});

test('QUEUE_BASE：固定 5 家分行的基准值让首屏必有超时和正常', () => {
  assert.equal(QUEUE_BASE.length, 5);
  assert.ok(QUEUE_BASE.some((base) => base > QUEUE_THRESHOLD), '基准值里要有超时的分行');
  assert.ok(QUEUE_BASE.some((base) => base < QUEUE_THRESHOLD), '基准值里要有正常的分行');
  // 扰动幅度 ±1.2 分钟内，基准值不能贴着阈值，否则同一家分行的状态可能因种子而抖动。
  assert.ok(QUEUE_BASE.every((base) => Math.abs(base - QUEUE_THRESHOLD) > 1.2), '基准值不能贴着 15 分钟阈值');
});
