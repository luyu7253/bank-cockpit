import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  averageRating,
  buildReviews,
  formatReviewTime,
  starFill,
} from '../src/panels/customer-satisfaction.js';

// 与 src/data.js 相同的 mulberry32，测试里只用于驱动面板导出的纯函数。
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

test('buildReviews：生成 3 条评价，字段完整，文案单行', () => {
  const reviews = buildReviews(seeded(20261112));
  assert.equal(reviews.length, 3);
  for (const review of reviews) {
    assert.equal(typeof review.name, 'string');
    assert.ok(review.name.length > 0, '必须有客户称呼');
    assert.equal(typeof review.text, 'string');
    assert.ok(review.text.length > 0, '必须有评价文案');
    assert.ok(!/[\r\n]/.test(review.text), '评价文案必须单行');
    assert.equal(typeof review.time, 'string');
    assert.match(review.time, /(今天|昨天|前天) \d{2}:\d{2}|\d+ 天前/);
    assert.ok(Number.isFinite(review.rating));
    assert.ok(review.rating >= 3 && review.rating <= 5, '单条评分应在 3–5 分之间');
  }
  assert.deepEqual(
    reviews.map((r) => r.name).sort(),
    ['张女士', '李先生', '王女士'].sort(),
  );
});

test('buildReviews：按时间从新到旧排序，平均分固定 4.7', () => {
  const reviews = buildReviews(seeded(20261112));
  for (let i = 1; i < reviews.length; i += 1) {
    assert.ok(reviews[i - 1].minutesAgo < reviews[i].minutesAgo, '评价应按时间从新到旧排序');
  }
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  assert.ok(Math.abs(total - 14) < 1e-9, '3 条评价评分合计恒为 14 分');
  assert.equal(averageRating(reviews), 4.7);
});

test('buildReviews：同一种子结果一致，不同种子有轻微差异', () => {
  const a = buildReviews(seeded(20261112));
  const b = buildReviews(seeded(20261112));
  assert.deepEqual(a, b);
  const c = buildReviews(seeded(7));
  assert.ok(
    a.some((review, i) => review.rating !== c[i].rating || review.minutesAgo !== c[i].minutesAgo),
    '不同种子应扰动评分或展示时间',
  );
});

test('buildReviews：任意种子下总分都锁定 4.7，排序与边界稳定', () => {
  for (const seed of [1, 2, 3, 7, 20261112, 20261113]) {
    const reviews = buildReviews(seeded(seed));
    assert.equal(reviews.length, 3);
    assert.equal(averageRating(reviews), 4.7);
    assert.ok(reviews.every((review) => review.rating >= 3 && review.rating <= 5));
    assert.ok(reviews.every((review) => review.minutesAgo >= 1));
    assert.deepEqual(
      [...reviews].sort((x, y) => x.minutesAgo - y.minutesAgo),
      reviews,
    );
  }
});

test('averageRating：空值、非法值与 0–5 边界', () => {
  assert.equal(averageRating([]), 0);
  assert.equal(averageRating(null), 0);
  assert.equal(averageRating(undefined), 0);
  assert.equal(averageRating([{ rating: 5 }, { rating: 4 }, { rating: 5 }]), 4.7);
  assert.equal(averageRating([{ rating: 4 }]), 4);
  assert.equal(averageRating([{ rating: 5 }, { rating: 9 }]), 5);
  assert.equal(averageRating([{ rating: -3 }, { rating: 1 }]), 0);
  assert.equal(averageRating([{ rating: '5' }, { rating: '4' }, { rating: '5' }]), 4.7);
  assert.equal(averageRating([{ rating: NaN }, {}]), 0);
  assert.equal(averageRating([{ rating: 4.66 }]), 4.7);
});

test('starFill：4.7 分为 4 颗满星 + 第 5 颗 70%', () => {
  assert.deepEqual(starFill(4.7), [1, 1, 1, 1, 0.7]);
  assert.deepEqual(starFill(4), [1, 1, 1, 1, 0]);
  assert.deepEqual(starFill(5), [1, 1, 1, 1, 1]);
  assert.deepEqual(starFill(0), [0, 0, 0, 0, 0]);
  assert.deepEqual(starFill(4.25), [1, 1, 1, 1, 0.25]);
});

test('starFill：越界与非法值收拢到 0–1，每颗比例合法', () => {
  assert.deepEqual(starFill(-1), [0, 0, 0, 0, 0]);
  assert.deepEqual(starFill(9), [1, 1, 1, 1, 1]);
  assert.deepEqual(starFill(NaN), [0, 0, 0, 0, 0]);
  assert.deepEqual(starFill('4.7'), [1, 1, 1, 1, 0.7]);
  for (const value of [0, 0.1, 1.5, 2.99, 3.7, 4.7, 5]) {
    const fills = starFill(value);
    assert.equal(fills.length, 5);
    for (const f of fills) {
      assert.ok(f >= 0 && f <= 1, '每颗星的比例必须在 0–1');
    }
  }
});

test('formatReviewTime：固定时刻下的今天 / 昨天 / 前天标签', () => {
  assert.equal(formatReviewTime(52), '今天 15:02');
  assert.equal(formatReviewTime(210), '今天 12:24');
  assert.equal(formatReviewTime(1500), '昨天 14:54');
  assert.equal(formatReviewTime(3000), '前天 13:54');
  assert.equal(formatReviewTime(-10), '今天 15:54');
  assert.equal(formatReviewTime(NaN), '刚刚');
});
