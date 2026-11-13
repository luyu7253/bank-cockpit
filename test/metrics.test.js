import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yoy, pointDelta, rankBy, shares, formatAmount, signed } from '../src/metrics.js';
import { monthly, seededRandom, branches, channels, nextTransaction } from '../src/data.js';

test('同比：增长、下降、基数为 0', () => {
  assert.equal(yoy(110, 100), 10);
  assert.equal(yoy(95, 100), -5);
  assert.equal(yoy(5, 0), null);
});

test('百分点差保留两位小数', () => {
  assert.equal(pointDelta(1.31, 1.42), -0.11);
});

test('排名按降序且不改原数组', () => {
  const list = [{ n: 'a', v: 1 }, { n: 'b', v: 3 }, { n: 'c', v: 2 }];
  const ranked = rankBy(list, 'v');
  assert.deepEqual(ranked.map((x) => [x.n, x.rank]), [['b', 1], ['c', 2], ['a', 3]]);
  assert.equal(list[0].n, 'a');
});

test('占比合计约为 100%', () => {
  const s = shares([{ v: 1 }, { v: 1 }, { v: 2 }], 'v');
  assert.deepEqual(s.map((x) => x.pct), [25, 25, 50]);
});

test('金额格式：统一用元、千分位、2 位小数', () => {
  assert.equal(formatAmount(860), '860.00 元');
  assert.equal(formatAmount(123_456.7), '123,456.70 元');
  assert.equal(formatAmount(11_189_000), '11,189,000.00 元');
});

test('带符号文字', () => {
  assert.equal(signed(5.2), '+5.2%');
  assert.equal(signed(-0.11, ' pp'), '−0.11 pp');
  assert.equal(signed(null), '—');
});

test('模拟数据可复现：同一种子得到同一序列', () => {
  const a = seededRandom(1), b = seededRandom(1);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('模拟数据形状正确', () => {
  assert.equal(monthly.length, 24);
  assert.ok(monthly.every((m) => m.deposits > m.loans));
  assert.ok(branches.length >= 8);
  const total = channels.reduce((s, c) => s + c.share, 0);
  assert.ok(Math.abs(total - 100) < 0.01);
  const tx = nextTransaction(seededRandom(7));
  assert.ok(tx.amount >= 100 && tx.type && tx.city);
});
