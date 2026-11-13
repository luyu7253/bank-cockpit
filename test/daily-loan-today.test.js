import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seededRandom } from '../src/data.js';
import {
  allocateInt,
  avgTicket,
  buildDailyLoans,
  sharePct,
  sumPct,
  DAILY_LOAN_SEED,
  LOAN_CATEGORIES,
  TOTAL_AMOUNT,
  TOTAL_COUNT,
} from '../src/panels/daily-loan-today.js';

const sum = (list) => list.reduce((acc, v) => acc + v, 0);

test('allocateInt：最大余数法分配，合计精确等于总数', () => {
  assert.deepEqual(allocateInt(100, [1, 1, 1]), [34, 33, 33]);
  assert.equal(sum(allocateInt(TOTAL_COUNT, [592, 407, 287])), TOTAL_COUNT);
  assert.equal(sum(allocateInt(7, [1, 1, 1, 1])), 7);
});

test('allocateInt：权重非法时均分、总数为 0 时全为 0', () => {
  assert.equal(sum(allocateInt(9, [0, -1, Number.NaN])), 9);
  assert.deepEqual(allocateInt(0, [3, 2, 1]), [0, 0, 0]);
  assert.deepEqual(allocateInt(5, []), []);
});

test('sharePct：占比保留 1 位小数，分母为 0 时返回 0', () => {
  assert.equal(sharePct(1, 8), 12.5);
  assert.equal(sharePct(592, TOTAL_COUNT), 46.0);
  assert.equal(sharePct(5, 0), 0);
});

test('sumPct：忽略非法项并保留 1 位小数', () => {
  assert.equal(sumPct([{ pct: 47.7 }, { pct: 29.9 }, { pct: 22.4 }]), 100);
  assert.equal(sumPct([{ pct: 1.25 }, { pct: 2.25 }, { pct: Number.NaN }]), 3.5);
  assert.equal(sumPct(null), 0);
});

test('avgTicket：笔均金额（万元）由总金额与总笔数计算', () => {
  assert.equal(avgTicket(TOTAL_AMOUNT, TOTAL_COUNT), 53.2);
  assert.equal(avgTicket(1, 0), 0);
});

test('buildDailyLoans：三类齐全、笔数合计等于总笔数、占比合计约 100%', () => {
  const data = buildDailyLoans(seededRandom(DAILY_LOAN_SEED));
  assert.equal(data.count, TOTAL_COUNT);
  assert.equal(data.amount, TOTAL_AMOUNT);
  assert.equal(data.avg, 53.2);
  assert.equal(data.categories.length, 3);
  assert.deepEqual(
    data.categories.map((c) => c.name),
    LOAN_CATEGORIES.map((c) => c.name),
  );
  assert.equal(sum(data.categories.map((c) => c.count)), TOTAL_COUNT);
  const widthTotal = sum(data.categories.map((c) => c.width));
  assert.ok(Math.abs(widthTotal - 100) < 1e-9, `堆叠条宽度合计 ${widthTotal}`);
  assert.ok(Math.abs(data.totalPct - 100) <= 0.2, `占比合计 ${data.totalPct}`);
  for (const item of data.categories) {
    assert.ok(item.count >= 0, `${item.name} 笔数非负`);
    assert.ok(item.pct > 0 && item.pct < 100, `${item.name} 占比在 0–100 之间`);
    assert.equal(item.pct, Math.round(item.pct * 10) / 10);
  }
});

test('buildDailyLoans：固定种子每次结果一致', () => {
  const a = buildDailyLoans(seededRandom(DAILY_LOAN_SEED));
  const b = buildDailyLoans(seededRandom(DAILY_LOAN_SEED));
  assert.deepEqual(a, b);
});
