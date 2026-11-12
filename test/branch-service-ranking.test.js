import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRanking, sortByScore, barWidth } from '../src/panels/branch-service-ranking.js';

const BRANCHES = [
  ['上海分行', 486], ['北京分行', 412], ['深圳分行', 377], ['杭州分行', 298],
  ['南京分行', 251], ['成都分行', 214], ['武汉分行', 188], ['西安分行', 152],
  ['苏州分行', 143], ['重庆分行', 129],
].map(([name, loans]) => ({ name, loans }));

/** 测试用的确定性随机数（不依赖浏览器与 data.js）。 */
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

test('sortByScore：按评分降序且不修改原数组', () => {
  const rows = [
    { name: '甲', score: 91.2 },
    { name: '乙', score: 97.4 },
    { name: '丙', score: 94.8 },
  ];
  const sorted = sortByScore(rows);
  assert.notEqual(sorted, rows);
  assert.deepEqual(sorted.map((r) => r.name), ['乙', '丙', '甲']);
  assert.deepEqual(rows.map((r) => r.name), ['甲', '乙', '丙']);
});

test('buildRanking：取前 5 名、评分降序、名次连续', () => {
  const rows = buildRanking(BRANCHES, seeded(20261112), 5);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3, 4, 5]);
  for (let i = 1; i < rows.length; i += 1) assert.ok(rows[i - 1].score >= rows[i].score);
  for (const row of rows) assert.ok(BRANCHES.some((b) => b.name === row.name));
  assert.equal(new Set(rows.map((r) => r.name)).size, 5);
});

test('buildRanking：评分在 88–99、等候在 1.8–6.5 分钟', () => {
  const rows = buildRanking(BRANCHES, seeded(7), 5);
  for (const row of rows) {
    assert.ok(row.score >= 88 && row.score <= 99, `评分越界：${row.score}`);
    assert.equal(Math.round(row.score * 10) / 10, row.score, '评分保留一位小数');
    assert.ok(row.wait >= 1.8 && row.wait <= 6.5, `等候越界：${row.wait}`);
    assert.equal(Math.round(row.wait * 10) / 10, row.wait, '等候保留一位小数');
  }
});

test('buildRanking：随机数两端都收在评分范围内', () => {
  const low = buildRanking(BRANCHES, () => 0, 5);
  const high = buildRanking(BRANCHES, () => 0.999999, 5);
  assert.ok(low.every((r) => r.score === 88));
  assert.ok(high.every((r) => r.score === 99));
});

test('buildRanking：固定种子结果可复现', () => {
  const a = buildRanking(BRANCHES, seeded(20261112), 5);
  const b = buildRanking(BRANCHES, seeded(20261112), 5);
  const c = buildRanking(BRANCHES, seeded(20261113), 5);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.map((r) => r.score), c.map((r) => r.score));
});

test('buildRanking：首名标服务之星、末名标需关注', () => {
  const rows = buildRanking(BRANCHES, seeded(20261112), 5);
  assert.equal(rows[0].tag, 'star');
  assert.equal(rows[rows.length - 1].tag, 'watch');
  assert.deepEqual(rows.slice(1, -1).map((r) => r.tag), ['', '', '']);
});

test('buildRanking：limit 与空数据边界', () => {
  assert.deepEqual(buildRanking([], seeded(1), 5), []);
  const three = buildRanking(BRANCHES, seeded(1), 3);
  assert.equal(three.length, 3);
  assert.equal(three[0].tag, 'star');
  assert.equal(three[2].tag, 'watch');
  const one = buildRanking(BRANCHES, seeded(1), 1);
  assert.equal(one.length, 1);
  assert.equal(one[0].tag, 'star');
});

test('barWidth：88→0%，99→100%，中点与越界收拢', () => {
  assert.equal(barWidth(88), 0);
  assert.equal(barWidth(99), 100);
  assert.equal(barWidth(93.5), 50);
  assert.equal(barWidth(80), 0);
  assert.equal(barWidth(105), 100);
  assert.equal(barWidth(Number.NaN), 0);
  assert.equal(barWidth(5, 0, 10), 50);
});

test('barWidth：限定范围内始终落在 0–100', () => {
  for (let score = 80; score <= 105; score += 0.5) {
    const width = barWidth(score);
    assert.ok(width >= 0 && width <= 100, `条宽越界：${score} → ${width}`);
  }
});
