import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ANNUAL_PLAN,
  DEPLOYED,
  TIME_PROGRESS,
  LOAN_PROGRESS_SEED,
  progressPct,
  categoryProgress,
  statusOf,
  buildLoanProgress,
} from '../src/panels/loan-progress.js';

/** 与 src/data.js 一致的 mulberry32，测试里自带一份，避免依赖任何浏览器环境。 */
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

test('progressPct：按已投放占比计算，保留 1 位小数', () => {
  assert.equal(progressPct(DEPLOYED, ANNUAL_PLAN), 77.9);
  assert.equal(progressPct(640, 800), 80);
  assert.equal(progressPct(1, 3), 33.3);
  assert.equal(progressPct(0, 2800), 0);
  assert.equal(progressPct(2180, 0), 0, '计划为 0 时返回 0，不产生 Infinity');
  assert.equal(progressPct(100, -1), 0, '计划为负时返回 0');
  assert.equal(progressPct(Number.NaN, 100), 0);
});

test('categoryProgress：返回该类的已投放、计划与完成率', () => {
  assert.deepEqual(categoryProgress(1220, 1600), { done: 1220, plan: 1600, pct: 76.3 });
  assert.deepEqual(categoryProgress(640, 800), { done: 640, plan: 800, pct: 80 });
  const invalid = categoryProgress(Number.NaN, 0);
  assert.equal(invalid.done, 0);
  assert.equal(invalid.plan, 0);
  assert.equal(invalid.pct, 0);
});

test('statusOf：warn / bad 都带图标与文字，不只靠颜色', () => {
  assert.deepEqual(statusOf(90, TIME_PROGRESS), { tone: 'good', icon: '▲', text: '快于时间进度' });
  assert.deepEqual(statusOf(83.3, TIME_PROGRESS), { tone: 'good', icon: '●', text: '基本符合时间进度' });
  assert.deepEqual(statusOf(77.9, TIME_PROGRESS), { tone: 'warn', icon: '▼', text: '略慢于时间进度' });
  assert.deepEqual(statusOf(70, TIME_PROGRESS), { tone: 'bad', icon: '⚠', text: '明显落后时间进度' });
  for (const tone of ['warn', 'bad']) {
    const s = statusOf(tone === 'warn' ? 77.9 : 70);
    assert.ok(s.icon.length > 0 && s.text.length > 0, `${tone} 状态必须有图标和文字`);
  }
});

test('buildLoanProgress：主口径固定为计划 2,800、已投放 2,180、进度 77.9%', () => {
  const data = buildLoanProgress(seededRandom(LOAN_PROGRESS_SEED));
  assert.equal(data.plan, 2800);
  assert.equal(data.done, 2180);
  assert.equal(data.pct, 77.9);
  assert.equal(data.timePct, 83.3);
  assert.equal(data.gap, 5.4, '落后时间进度 5.4 个百分点');
  assert.equal(data.status.tone, 'warn');
  assert.equal(data.status.text, '略慢于时间进度');
});

test('buildLoanProgress：三类已投放合计恒为 2,180、计划合计恒为 2,800', () => {
  for (const seed of [LOAN_PROGRESS_SEED, 1, 42, 20261113]) {
    const data = buildLoanProgress(seededRandom(seed));
    assert.equal(data.categories.length, 3);
    assert.deepEqual(
      data.categories.map((c) => c.name),
      ['对公贷款', '零售贷款', '小微贷款'],
    );
    assert.equal(data.categories.reduce((sum, c) => sum + c.done, 0), DEPLOYED, `种子 ${seed} 的已投放合计`);
    assert.equal(data.categories.reduce((sum, c) => sum + c.plan, 0), ANNUAL_PLAN, `种子 ${seed} 的计划合计`);
    assert.deepEqual(data.categories.map((c) => c.seriesIndex), [0, 1, 2]);
  }
});

test('buildLoanProgress：各类数值合理（正数、不超计划、完成率在区间内）', () => {
  const data = buildLoanProgress(seededRandom(LOAN_PROGRESS_SEED));
  for (const c of data.categories) {
    assert.ok(Number.isInteger(c.done) && c.done > 0, `${c.name} 已投放应为正整数`);
    assert.ok(Number.isInteger(c.plan) && c.plan > 0, `${c.name} 计划应为正整数`);
    assert.ok(c.done <= c.plan, `${c.name} 已投放不应超过计划`);
    assert.ok(c.pct > 60 && c.pct < 95, `${c.name} 完成率 ${c.pct}% 应在合理区间`);
    assert.equal(c.pct, progressPct(c.done, c.plan));
  }
  // 对公体量最大、小微最小，微调后仍保持这个量级关系
  const [corporate, retail, small] = data.categories;
  assert.ok(corporate.plan > retail.plan && retail.plan > small.plan);
  assert.ok(corporate.done > retail.done && retail.done > small.done);
});

test('buildLoanProgress：固定种子结果一致，不同种子会微调', () => {
  const a = buildLoanProgress(seededRandom(LOAN_PROGRESS_SEED));
  const b = buildLoanProgress(seededRandom(LOAN_PROGRESS_SEED));
  assert.deepEqual(a, b, '同一种子必须生成完全相同的数据');
  const c = buildLoanProgress(seededRandom(20261113));
  assert.notDeepEqual(a.categories, c.categories, '不同种子应产生微调后的差异');
  assert.equal(c.done, DEPLOYED);
});

test('buildLoanProgress：随机函数恒定时也满足总额约束', () => {
  const data = buildLoanProgress(() => 0.5);
  assert.equal(data.categories.reduce((sum, c) => sum + c.done, 0), DEPLOYED);
  assert.equal(data.categories.reduce((sum, c) => sum + c.plan, 0), ANNUAL_PLAN);
  for (const c of data.categories) assert.ok(c.pct > 0 && c.pct < 100);
});
