import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AML_SEED,
  LEVEL_META,
  LEVEL_TOTALS,
  PENDING_COUNT,
  SUSPICIOUS_TYPES,
  TOTAL_SUSPICIOUS,
  buildAmlSummary,
  minutesToTime,
  riskCounts,
  sortByRisk,
} from '../src/panels/aml-monitoring.js';

// 与 src/data.js 的 mulberry32 相同；测试只 import 面板里的纯函数，不依赖 DOM。
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

const summary = buildAmlSummary(seededRandom(AML_SEED));

test('固定种子生成 37 笔，待核查 8 笔、已处置 29 笔，合计一致', () => {
  assert.equal(summary.total, TOTAL_SUSPICIOUS);
  assert.equal(summary.total, 37);
  assert.equal(summary.pending, PENDING_COUNT);
  assert.equal(summary.pending, 8);
  assert.equal(summary.disposed, 29);
  assert.equal(summary.pending + summary.disposed, summary.total, '待核查 + 已处置应等于今日可疑总数');
  assert.equal(summary.transactions.length, 37);
  assert.equal(summary.transactions.filter((tx) => tx.status === 'pending').length, 8);
  assert.equal(summary.transactions.filter((tx) => tx.status === 'disposed').length, 29);
});

test('风险分布固定为高 6 / 中 14 / 低 17，且相加等于总数', () => {
  assert.deepEqual(LEVEL_TOTALS, { high: 6, medium: 14, low: 17 });
  assert.equal(summary.counts.high, 6);
  assert.equal(summary.counts.medium, 14);
  assert.equal(summary.counts.low, 17);
  assert.equal(summary.counts.other, 0);
  assert.equal(summary.counts.total, summary.total);
  assert.equal(
    summary.counts.high + summary.counts.medium + summary.counts.low,
    summary.total,
    '各等级笔数之和应等于今日可疑总数',
  );
  assert.deepEqual(riskCounts(summary.transactions), summary.counts);
});

test('金额与计数一致：各等级金额在合理区间，合计等于逐笔相加', () => {
  const expectedRange = {
    high: [40, 100],
    medium: [8, 40],
    low: [0.5, 8],
  };
  for (const tx of summary.transactions) {
    const [min, max] = expectedRange[tx.level];
    assert.ok(tx.amount >= min && tx.amount <= max, `${tx.level} 金额 ${tx.amount} 应在 ${min} ~ ${max} 万元`);
    assert.equal(tx.amount, Math.round(tx.amount * 10) / 10, '金额保留 1 位小数');
  }
  const sum = Math.round(summary.transactions.reduce((acc, tx) => acc + tx.amount, 0) * 10) / 10;
  assert.equal(summary.amountTotal, sum);

  assert.equal(summary.latest.length, 3);
  assert.equal(
    summary.latestTotal,
    Math.round(summary.latest.reduce((acc, tx) => acc + tx.amount, 0) * 10) / 10,
    '最新 3 笔的合计金额应与逐笔相加一致',
  );
});

test('最新 3 条：时间从近到远、类型为三种典型可疑交易、至少一条高风险', () => {
  const times = summary.latest.map((tx) => tx.time);
  assert.deepEqual(times, ['15:42', '15:33', '15:28']);
  assert.ok(summary.latest[0].at > summary.latest[1].at);
  assert.ok(summary.latest[1].at > summary.latest[2].at);
  assert.deepEqual(
    summary.latest.map((tx) => tx.type),
    SUSPICIOUS_TYPES.slice(0, 3),
  );
  assert.ok(summary.latest.some((tx) => tx.level === 'high'), '最新 3 条中应至少有一条高风险用于闪烁提醒');
  assert.deepEqual(summary.latest.map((tx) => tx.level), ['high', 'medium', 'low']);
  assert.ok(summary.latest.every((tx) => tx.status === 'pending'));
});

test('所有交易时间格式为 HH:MM，且按时间从近到远排列', () => {
  summary.transactions.forEach((tx, i) => {
    assert.match(tx.time, /^\d{2}:\d{2}$/);
    assert.equal(tx.time, minutesToTime(tx.at));
    if (i > 0) assert.ok(summary.transactions[i - 1].at > tx.at, '相邻两笔时间应严格递减');
  });
  assert.equal(minutesToTime(0), '00:00');
  assert.equal(minutesToTime(9 * 60 + 5), '09:05');
  assert.equal(minutesToTime(1440), '00:00');
  assert.equal(minutesToTime(-1), '23:59');
});

test('同一固定种子重复生成结果完全一致，不同种子会产生不同数据', () => {
  const again = buildAmlSummary(seededRandom(AML_SEED));
  assert.deepEqual(again, summary);
  const other = buildAmlSummary(seededRandom(AML_SEED + 1));
  assert.equal(other.counts.high, 6, '风险分布与种子无关');
  assert.equal(other.total, 37);
  assert.notDeepEqual(
    other.transactions.map((tx) => `${tx.time}-${tx.amount}-${tx.level}`),
    summary.transactions.map((tx) => `${tx.time}-${tx.amount}-${tx.level}`),
  );
});

test('riskCounts 统计各等级并保留未知等级，空列表返回全 0', () => {
  const list = [
    { level: 'high' },
    { level: 'medium' },
    { level: 'medium' },
    { level: 'low' },
    { level: 'unknown' },
    {},
  ];
  assert.deepEqual(riskCounts(list), { high: 1, medium: 2, low: 1, other: 2, total: 6 });
  assert.deepEqual(riskCounts([]), { high: 0, medium: 0, low: 0, other: 0, total: 0 });
  assert.deepEqual(riskCounts(), { high: 0, medium: 0, low: 0, other: 0, total: 0 });
});

test('sortByRisk 按高→中→低排序，同级按时间从近到远，且不修改原数组', () => {
  const input = [
    { id: 'a', level: 'low', at: 100 },
    { id: 'b', level: 'high', at: 90 },
    { id: 'c', level: 'medium', at: 95 },
    { id: 'd', level: 'high', at: 120 },
    { id: 'e', level: 'medium', at: 110 },
  ];
  const before = input.map((tx) => tx.id);
  const sorted = sortByRisk(input);
  assert.deepEqual(sorted.map((tx) => tx.id), ['d', 'b', 'e', 'c', 'a']);
  assert.deepEqual(sorted.map((tx) => LEVEL_META[tx.level].rank), [0, 0, 1, 1, 2]);
  assert.deepEqual(input.map((tx) => tx.id), before, '原数组顺序不应被修改');
  assert.notEqual(sorted, input);

  const scrambled = sortByRisk(summary.transactions);
  assert.equal(scrambled.length, 37);
  assert.deepEqual(scrambled.slice(0, 6).map((tx) => tx.level), ['high', 'high', 'high', 'high', 'high', 'high']);
  assert.deepEqual(sortByRisk([]), []);
});

test('风险等级元数据齐全，状态色只用 bad / warn / accent，且都带图标和文字', () => {
  assert.deepEqual(Object.keys(LEVEL_META), ['high', 'medium', 'low']);
  const tones = Object.values(LEVEL_META).map((meta) => meta.tone);
  assert.deepEqual(tones, ['bad', 'warn', 'accent']);
  for (const meta of Object.values(LEVEL_META)) {
    assert.ok(meta.label.length > 0);
    assert.ok(meta.icon.length > 0);
    assert.ok(meta.rank >= 0);
  }
});
