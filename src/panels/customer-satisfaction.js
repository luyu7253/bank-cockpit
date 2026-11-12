// 「客户满意度」面板：本月满意度 4.7 分（满分 5 分）+ 五颗星 + 3 条模拟客户评价轮播。
// 设计画布固定 460 × 236，页面会把整块画布等比缩放进格子，因此这里不读取窗口尺寸、不写 @media。
// 评价时间与单条评分用固定种子轻微扰动；3 条评分合计锁定为 14，所以本月总分恒为 4.7。

const STYLE_ID = 'customer-satisfaction-style';
const TOTAL_RATING = 14; // 3 条评价合计 14 分 → 平均 4.666… → 4.7 分
const NOW_MIN = 15 * 60 + 54; // 固定为 2026-11-12 15:54，不读系统时间

const REVIEW_BASE = [
  { name: '王女士', text: '手机银行转账很快，体验顺滑。', rating: 5, minutesAgo: 52 },
  { name: '李先生', text: '网点排队时间短，服务耐心。', rating: 4, minutesAgo: 210 },
  { name: '张女士', text: '理财到期提醒及时，很省心。', rating: 5, minutesAgo: 1500 },
];

const STAR_PATH = 'M10 1.6 12.47 7.26 18.58 7.84 13.94 11.94 15.34 17.92 10 14.72 4.66 17.92 6.06 11.94 1.42 7.84 7.53 7.26Z';

const STYLE = `
[data-panel="customer-satisfaction"] .cs-root {
  width: 460px; height: 236px; box-sizing: border-box;
  padding: 9px 12px 8px; display: flex; flex-direction: column; gap: 6px;
  overflow: hidden; white-space: nowrap; color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
[data-panel="customer-satisfaction"] .cs-rating {
  flex: 0 0 104px; display: flex; flex-direction: column; justify-content: space-between;
}
[data-panel="customer-satisfaction"] .cs-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  font-size: 12px; line-height: 16px; color: var(--text-secondary); letter-spacing: 0.04em;
}
[data-panel="customer-satisfaction"] .cs-kicker { min-width: 0; overflow: hidden; }
[data-panel="customer-satisfaction"] .cs-delta {
  flex: 0 0 auto; font-size: 11px; color: var(--text-muted); letter-spacing: 0;
}
[data-panel="customer-satisfaction"] .cs-delta b {
  color: var(--good); font-weight: 700;
}
[data-panel="customer-satisfaction"] .cs-main {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 58px;
}
[data-panel="customer-satisfaction"] .cs-score {
  display: flex; align-items: baseline; gap: 5px; min-width: 0;
}
[data-panel="customer-satisfaction"] .cs-value {
  font-size: 42px; line-height: 1; font-weight: 700; color: var(--text-primary);
  letter-spacing: -0.01em; text-shadow: 0 0 18px rgba(79, 195, 255, 0.32);
}
[data-panel="customer-satisfaction"] .cs-unit {
  font-size: 12px; line-height: 1; color: var(--text-muted);
}
[data-panel="customer-satisfaction"] .cs-stars {
  display: flex; align-items: center; gap: 5px; height: 22px; flex: 0 0 auto;
}
[data-panel="customer-satisfaction"] .cs-star {
  display: block; width: 21px; height: 21px; overflow: visible;
  filter: drop-shadow(0 0 5px rgba(242, 181, 68, 0.26));
}
[data-panel="customer-satisfaction"] .cs-star-base { fill: rgba(255, 255, 255, 0.13); }
[data-panel="customer-satisfaction"] .cs-star-fill {
  transform-box: fill-box; transform-origin: left center;
  animation: cs-star-in 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(var(--i) * 80ms);
}
[data-panel="customer-satisfaction"] .cs-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  font-size: 11px; line-height: 15px; color: var(--text-muted);
}
[data-panel="customer-satisfaction"] .cs-foot > span { min-width: 0; overflow: hidden; }
[data-panel="customer-satisfaction"] .cs-foot b {
  color: var(--text-secondary); font-weight: 600;
}
[data-panel="customer-satisfaction"] .cs-reviews {
  position: relative; flex: 1 1 auto; min-height: 0; box-sizing: border-box;
  border: 1px solid rgba(79, 163, 255, 0.18); border-radius: 9px; overflow: hidden;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012));
}
[data-panel="customer-satisfaction"] .cs-review {
  position: absolute; inset: 0; box-sizing: border-box;
  padding: 9px 14px 22px; display: flex; flex-direction: column; justify-content: center; gap: 7px;
  opacity: 0; transform: translateY(6px); pointer-events: none;
  transition: opacity 0.42s ease, transform 0.42s ease;
}
[data-panel="customer-satisfaction"] .cs-review.active { opacity: 1; transform: none; }
[data-panel="customer-satisfaction"] .cs-quote-mark {
  position: absolute; left: 8px; top: 2px;
  font-size: 30px; line-height: 1; color: rgba(242, 181, 68, 0.34);
}
[data-panel="customer-satisfaction"] .cs-quote {
  margin: 0 0 0 16px; font-size: 13px; line-height: 18px; font-weight: 500;
  color: var(--text-primary); overflow: hidden;
}
[data-panel="customer-satisfaction"] .cs-meta {
  display: flex; align-items: center; gap: 8px; margin-left: 16px;
  font-size: 11px; line-height: 14px; color: var(--text-muted);
}
[data-panel="customer-satisfaction"] .cs-name { color: var(--text-secondary); font-weight: 600; }
[data-panel="customer-satisfaction"] .cs-badge {
  padding: 0 5px; border-radius: 3px; color: var(--gold);
  background: rgba(242, 181, 68, 0.1); border: 1px solid rgba(242, 181, 68, 0.22);
}
[data-panel="customer-satisfaction"] .cs-time { margin-left: auto; }
[data-panel="customer-satisfaction"] .cs-dots {
  position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 6px;
}
[data-panel="customer-satisfaction"] .cs-dot {
  display: block; width: 5px; height: 5px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  transition: width 0.3s ease, background 0.3s ease;
}
[data-panel="customer-satisfaction"] .cs-dot.on {
  width: 14px; border-radius: 3px; background: var(--accent);
  box-shadow: 0 0 8px rgba(79, 195, 255, 0.65);
}
[data-panel="customer-satisfaction"] .cs-root[data-reduce="true"] .cs-star-fill { animation: none; }
[data-panel="customer-satisfaction"] .cs-root[data-reduce="true"] .cs-review { transition: none; }
[data-panel="customer-satisfaction"] .cs-root[data-reduce="true"] .cs-dot { transition: none; }
@keyframes cs-star-in {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
`;

const round1 = (v) => Math.round(v * 10) / 10;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 五颗星的填充比例（0–1），第 5 颗对 4.7 分返回 0.7；越界值自动收拢到 0–5。 */
export function starFill(rating) {
  const value = Number(rating);
  const safe = Number.isFinite(value) ? clamp(value, 0, 5) : 0;
  return Array.from({ length: 5 }, (_, i) => Math.round(clamp(safe - i, 0, 1) * 100) / 100);
}

/** 平均分：保留 1 位小数并限制在 0–5；空数组或非法评分返回 0。 */
export function averageRating(reviews) {
  if (!Array.isArray(reviews) || reviews.length === 0) return 0;
  const values = reviews
    .map((review) => Number(review?.rating))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(clamp(avg, 0, 5) * 10) / 10;
}

/** 相对固定时刻 2026-11-12 15:54 的短时间标签，保证单行、不读系统时间。 */
export function formatReviewTime(minutesAgo, nowMinutes = NOW_MIN) {
  const minutes = Number(minutesAgo);
  const now = Number(nowMinutes);
  if (!Number.isFinite(minutes) || !Number.isFinite(now)) return '刚刚';
  const ago = Math.max(0, Math.round(minutes));
  const dayShift = Math.floor((now - ago) / 1440);
  const tod = ((now - ago) % 1440 + 1440) % 1440;
  const hh = String(Math.floor(tod / 60)).padStart(2, '0');
  const mm = String(tod % 60).padStart(2, '0');
  if (dayShift === 0) return `今天 ${hh}:${mm}`;
  if (dayShift === -1) return `昨天 ${hh}:${mm}`;
  if (dayShift === -2) return `前天 ${hh}:${mm}`;
  return `${Math.abs(dayShift)} 天前`;
}

/**
 * 生成 3 条模拟评价（按时间从新到旧）：
 * 单条评分在基准分附近轻微扰动，但合计锁定为 14 分，本月总分始终是 4.7；
 * 展示时间也由随机源轻微扰动。随机源只消费固定数量的随机数。
 */
export function buildReviews(rand = Math.random) {
  const random = typeof rand === 'function' ? rand : Math.random;
  const ratings = REVIEW_BASE.map((item) => clamp(round1(item.rating + (random() * 2 - 1) * 0.2), 3, 5));
  const delta = round1(TOTAL_RATING - ratings.reduce((sum, value) => sum + value, 0));
  ratings[1] = clamp(round1(ratings[1] + delta), 3, 5);

  return REVIEW_BASE
    .map((item, i) => {
      const minutesAgo = Math.max(1, item.minutesAgo + Math.floor(random() * 11) - 5);
      return {
        id: `review-${i + 1}`,
        name: item.name,
        text: item.text,
        rating: ratings[i],
        minutesAgo,
        time: formatReviewTime(minutesAgo),
      };
    })
    .sort((a, b) => a.minutesAgo - b.minutesAgo);
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.append(style);
}

let gradientSeq = 0;

function starsMarkup(fills, label) {
  const gradId = `cs-star-grad-${++gradientSeq}`;
  const stars = fills.map((fraction, i) => {
    const clipId = `${gradId}-clip-${i}`;
    const filled = fraction > 0
      ? `<clipPath id="${clipId}"><rect x="0" y="0" width="${(fraction * 20).toFixed(2)}" height="20"></rect></clipPath>
         <g clip-path="url(#${clipId})"><path class="cs-star-fill" style="--i:${i}" d="${STAR_PATH}" fill="url(#${gradId})"></path></g>`
      : '';
    return `<svg class="cs-star" viewBox="0 0 20 20" width="21" height="21" aria-hidden="true">
      <path class="cs-star-base" d="${STAR_PATH}"></path>${filled}
    </svg>`;
  }).join('');
  return `<svg class="cs-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="var(--gold)"></stop>
        <stop offset="55%" stop-color="var(--gold)"></stop>
        <stop offset="100%" stop-color="var(--warn)"></stop>
      </linearGradient>
    </defs></svg>
    <span class="cs-stars" role="img" aria-label="${label}">${stars}</span>`;
}

export default {
  title: '客户满意度',
  unit: '本月 · 模拟数据',
  render(el, ctx) {
    if (typeof el.__csCleanup === 'function') el.__csCleanup();
    ensureStyle();

    const rand = typeof ctx?.data?.seededRandom === 'function'
      ? ctx.data.seededRandom(20261112)
      : Math.random;
    const reviews = buildReviews(rand);
    const score = averageRating(reviews);
    const reduce = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;

    el.replaceChildren();
    const root = document.createElement('div');
    root.className = 'cs-root';
    root.dataset.reduce = String(reduce);
    root.innerHTML = `
      <div class="cs-rating">
        <div class="cs-head">
          <span class="cs-kicker">本月客户满意度</span>
          <span class="cs-delta">较上月 <b>▲ +0.1</b></span>
        </div>
        <div class="cs-main">
          <span class="cs-score"><span class="cs-value">${score.toFixed(1)}</span><span class="cs-unit">/ 5 分</span></span>
          ${starsMarkup(starFill(score), `${score.toFixed(1)} 分，满分 5 分`)}
        </div>
        <div class="cs-foot">
          <span>共 <b>1,286</b> 份有效评价</span>
          <span>好评率 <b>96.8%</b></span>
        </div>
      </div>
      <div class="cs-reviews">
        ${reviews.map((review, i) => `
          <div class="cs-review${i === 0 ? ' active' : ''}" data-index="${i}" aria-hidden="${i !== 0}">
            <span class="cs-quote-mark" aria-hidden="true">“</span>
            <p class="cs-quote">${review.text}</p>
            <div class="cs-meta">
              <span class="cs-name">${review.name}</span>
              <span class="cs-badge">${review.rating.toFixed(1)} 分</span>
              <span class="cs-time">${review.time}</span>
            </div>
          </div>`).join('')}
        <div class="cs-dots" aria-hidden="true">
          ${reviews.map((_, i) => `<i class="cs-dot${i === 0 ? ' on' : ''}"></i>`).join('')}
        </div>
      </div>`;
    el.append(root);

    const items = [...root.querySelectorAll('.cs-review')];
    const dots = [...root.querySelectorAll('.cs-dot')];
    let index = 0;
    let intervalId = 0;
    let startId = 0;

    const show = (next) => {
      if (next === index) return;
      index = (next + items.length) % items.length;
      items.forEach((item, i) => {
        item.classList.toggle('active', i === index);
        item.setAttribute('aria-hidden', String(i !== index));
      });
      dots.forEach((dot, i) => dot.classList.toggle('on', i === index));
    };

    // 4 秒切换一条；末尾留一点起始停顿，让第一条评价先被读到。
    if (!reduce && items.length > 1) {
      startId = setTimeout(() => {
        show(index + 1);
        intervalId = setInterval(() => show(index + 1), 4000);
      }, 4900);
    }

    el.__csCleanup = () => {
      clearTimeout(startId);
      clearInterval(intervalId);
      el.replaceChildren();
    };
  },
};
