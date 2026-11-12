// 「今日放款笔数」面板：大字展示今日放款笔数与金额，下方按个人贷 / 经营贷 / 消费贷
// 列出三类笔数占比（彩色小条形 + 百分比 + 笔数）。
// 设计画布固定 460 × 236，页面会把整块画布等比缩放进格子，因此这里不读取窗口尺寸、不写 @media。
// 总数与金额为固定模拟口径；三类笔数用固定种子轻微扰动后按最大余数法分配，合计恒等于总笔数。

const STYLE_ID = 'daily-loan-count-style';

/** 固定随机种子：每次打开面板，三类贷款的笔数分配都一致。 */
export const DAILY_LOAN_SEED = 20261112;

/** 今日放款总笔数（固定模拟口径）。 */
export const TOTAL_COUNT = 1286;

/** 今日放款总金额（亿元，固定模拟口径）。 */
export const TOTAL_AMOUNT = 6.84;

/** 三类贷款的基准笔数，只决定相对大小；实际笔数由固定种子抖动后归一到 TOTAL_COUNT。 */
export const LOAN_CATEGORIES = [
  { key: 'personal', name: '个人贷', baseCount: 592 },
  { key: 'business', name: '经营贷', baseCount: 407 },
  { key: 'consumption', name: '消费贷', baseCount: 287 },
];

const round1 = (value) => Math.round(value * 10) / 10;

/** part 占 whole 的比例（%），保留 1 位小数；whole 为 0 时返回 0。 */
export function sharePct(part, whole) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return round1((part / whole) * 100);
}

/**
 * 按权重把整数总量拆到各项，用「最大余数法」分配，保证合计精确等于 total。
 * 权重非法或全为 0 时按均分处理；total 非法时按 0 处理。
 * 返回与 weights 等长的非负整数数组，不修改入参。
 */
export function allocateInt(total, weights) {
  const rawTotal = Number(total);
  const t = Number.isFinite(rawTotal) ? Math.max(0, Math.trunc(rawTotal)) : 0;
  const safe = (Array.isArray(weights) ? weights : []).map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  if (safe.length === 0) return [];
  const sum = safe.reduce((acc, w) => acc + w, 0);
  const normalized = sum > 0 ? safe : safe.map(() => 1);
  const normSum = normalized.reduce((acc, w) => acc + w, 0);
  const raw = normalized.map((w) => (t * w) / normSum);
  const out = raw.map(Math.floor);
  let remain = t - out.reduce((acc, v) => acc + v, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < remain; k += 1) out[order[k % order.length].i] += 1;
  return out;
}

/** 笔均放款金额（万元），保留 1 位小数；笔数为 0 时返回 0。 */
export function avgTicket(amountYi, count) {
  if (!Number.isFinite(amountYi) || !Number.isFinite(count) || count <= 0) return 0;
  return round1((amountYi * 10000) / count);
}

/**
 * 生成今日放款数据：总笔数、总金额固定，三类笔数按基准值抖动后归一到总笔数，
 * 因此「三类笔数之和 = 大字笔数」「三类占比之和 ≈ 100%」始终成立。
 * @param {() => number} random 随机数函数（页面传入 ctx.data.seededRandom(DAILY_LOAN_SEED)）
 */
export function buildDailyLoans(random = Math.random) {
  const r = typeof random === 'function' ? random : Math.random;
  const weights = LOAN_CATEGORIES.map((c) => c.baseCount * (0.92 + r() * 0.16));
  const counts = allocateInt(TOTAL_COUNT, weights);
  const categories = LOAN_CATEGORIES.map((c, i) => ({
    key: c.key,
    name: c.name,
    count: counts[i] ?? 0,
    pct: sharePct(counts[i] ?? 0, TOTAL_COUNT),
  }));

  return {
    count: TOTAL_COUNT,
    amount: TOTAL_AMOUNT,
    avg: avgTicket(TOTAL_AMOUNT, TOTAL_COUNT),
    categories,
  };
}

const STYLE = `
[data-panel="daily-loan-count"] {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
[data-panel="daily-loan-count"] .dl-root {
  width: 460px; height: 236px; box-sizing: border-box;
  padding: 10px 16px 12px;
  display: flex; flex-direction: column; gap: 5px;
  overflow: hidden; white-space: nowrap;
}
[data-panel="daily-loan-count"] .dl-root * { white-space: nowrap; }
[data-panel="daily-loan-count"] .dl-head {
  flex: 0 0 15px; height: 15px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  font-size: 11px; line-height: 15px; color: var(--text-muted);
}
[data-panel="daily-loan-count"] .dl-head b {
  color: var(--text-secondary); font-weight: 600;
}
[data-panel="daily-loan-count"] .dl-hero {
  flex: 0 0 63px; height: 63px;
  display: flex; align-items: flex-end; justify-content: space-between; gap: 20px;
}
[data-panel="daily-loan-count"] .dl-block {
  display: flex; flex-direction: column; gap: 1px; min-width: 0;
}
[data-panel="daily-loan-count"] .dl-block.right { align-items: flex-end; }
[data-panel="daily-loan-count"] .dl-label {
  font-size: 11px; line-height: 13px; letter-spacing: 0.06em; color: var(--text-muted);
}
[data-panel="daily-loan-count"] .dl-number {
  display: flex; align-items: baseline; gap: 4px; line-height: 1.08;
}
[data-panel="daily-loan-count"] .dl-count {
  font-size: 42px; font-weight: 700; letter-spacing: 0.01em;
  color: var(--text-primary);
  text-shadow: 0 0 18px rgba(79, 195, 255, 0.34);
}
[data-panel="daily-loan-count"] .dl-amount {
  font-size: 34px; font-weight: 700; letter-spacing: 0.01em;
  color: var(--accent);
  text-shadow: 0 0 16px rgba(79, 195, 255, 0.42);
}
[data-panel="daily-loan-count"] .dl-unit {
  font-size: 12px; font-weight: 500; color: var(--text-muted);
}
[data-panel="daily-loan-count"] .dl-divider {
  flex: 0 0 1px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(79, 163, 255, 0.32), transparent);
}
[data-panel="daily-loan-count"] .dl-section {
  flex: 0 0 14px; height: 14px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  font-size: 11px; line-height: 14px; color: var(--text-muted);
}
[data-panel="daily-loan-count"] .dl-section-title {
  display: flex; align-items: center; gap: 5px;
  font-weight: 600; color: var(--text-secondary);
}
[data-panel="daily-loan-count"] .dl-section-title::before {
  content: ""; width: 3px; height: 10px; border-radius: 2px;
  background: var(--accent); box-shadow: 0 0 6px var(--accent);
}
[data-panel="daily-loan-count"] .dl-list {
  list-style: none; margin: 0; padding: 0;
  flex: 1 1 auto; min-height: 0;
  display: flex; flex-direction: column; gap: 4px;
}
[data-panel="daily-loan-count"] .dl-row {
  flex: 1 1 0; min-height: 0;
  display: grid;
  grid-template-columns: 8px 44px 58px minmax(0, 1fr) 44px;
  align-items: center; column-gap: 8px;
  padding: 0 10px;
  border: 1px solid rgba(79, 163, 255, 0.14);
  border-radius: 6px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--dl-c) 9%, transparent), rgba(255, 255, 255, 0.012));
  animation: dl-row-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(70ms + var(--i, 0) * 60ms);
}
[data-panel="daily-loan-count"] .dl-dot {
  width: 8px; height: 8px; border-radius: 2px;
  background: var(--dl-c);
  box-shadow: 0 0 7px var(--dl-c);
}
[data-panel="daily-loan-count"] .dl-name {
  font-size: 12.5px; font-weight: 600; line-height: 16px; color: var(--text-primary);
}
[data-panel="daily-loan-count"] .dl-sub {
  text-align: right; font-size: 11px; line-height: 16px; color: var(--text-muted);
}
[data-panel="daily-loan-count"] .dl-sub b {
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
}
[data-panel="daily-loan-count"] .dl-bar {
  position: relative; height: 6px; border-radius: 3px;
  background: rgba(148, 174, 210, 0.15);
  overflow: hidden;
}
[data-panel="daily-loan-count"] .dl-bar i {
  position: absolute; left: 0; top: 0; bottom: 0; width: 0;
  border-radius: 3px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--dl-c) 55%, transparent), var(--dl-c));
  box-shadow: 0 0 8px color-mix(in srgb, var(--dl-c) 65%, transparent);
  transition: width 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
}
[data-panel="daily-loan-count"] .dl-pct {
  text-align: right; font-size: 13px; font-weight: 700; line-height: 16px;
  color: var(--text-primary);
}
[data-panel="daily-loan-count"] .dl-static .dl-bar i { transition: none; }
@keyframes dl-row-in {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: none; }
}
`;

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  doc.head.append(style);
}

const formatInt = (value) => Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const formatAmount = (value) => Number(value).toLocaleString('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 数字滚动：从 0 平滑到目标值，返回取消函数。 */
function animateNumber(node, target, decimals, reduceMotion) {
  const finalText = decimals > 0
    ? Number(target).toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : formatInt(target);
  if (reduceMotion || typeof requestAnimationFrame !== 'function') {
    node.textContent = finalText;
    return () => {};
  }
  const started = performance.now();
  const duration = 760;
  let frame = 0;
  const tick = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - (1 - progress) ** 3;
    const value = target * eased;
    node.textContent = decimals > 0
      ? value.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : formatInt(Math.round(value));
    if (progress < 1) frame = requestAnimationFrame(tick);
    else node.textContent = finalText;
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export default {
  title: '今日放款笔数',
  unit: '今日 · 模拟数据',
  render(el, ctx) {
    if (typeof el.__dlCleanup === 'function') el.__dlCleanup();
    const doc = el.ownerDocument;
    ensureStyle(doc);

    const random = ctx?.data?.seededRandom
      ? ctx.data.seededRandom(DAILY_LOAN_SEED)
      : Math.random;
    const data = buildDailyLoans(random);
    const colors = ctx?.colors?.series ?? ['#3987e5', '#d95926', '#199e70'];
    const reduceMotion = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;

    const root = doc.createElement('div');
    root.className = `dl-root${reduceMotion ? ' dl-static' : ''}`;
    root.setAttribute(
      'aria-label',
      `今日放款 ${formatInt(data.count)} 笔，金额 ${formatAmount(data.amount)} 亿元；`
        + data.categories.map((c) => `${c.name} ${c.pct.toFixed(1)}%`).join('，'),
    );

    root.innerHTML = `
      <div class="dl-head">
        <span>今日放款 · 截至 16:30</span>
        <span>笔均 <b>${data.avg.toFixed(1)} 万元</b></span>
      </div>
      <div class="dl-hero">
        <div class="dl-block">
          <span class="dl-label">放款笔数</span>
          <span class="dl-number"><b class="dl-count">0</b><span class="dl-unit">笔</span></span>
        </div>
        <div class="dl-block right">
          <span class="dl-label">放款金额</span>
          <span class="dl-number"><b class="dl-amount">0.00</b><span class="dl-unit">亿元</span></span>
        </div>
      </div>
      <div class="dl-divider"></div>
      <div class="dl-section">
        <span class="dl-section-title">三类笔数占比</span>
        <span>单位：笔</span>
      </div>
      <ul class="dl-list" aria-label="三类贷款笔数占比">
        ${data.categories.map((item, i) => {
          const color = colors[i] ?? `var(--series-${i + 1})`;
          return `<li class="dl-row" style="--dl-c:${color};--i:${i}" aria-label="${item.name} ${item.count} 笔，占 ${item.pct.toFixed(1)}%">
            <i class="dl-dot" aria-hidden="true"></i>
            <span class="dl-name">${item.name}</span>
            <span class="dl-sub"><b>${formatInt(item.count)}</b> 笔</span>
            <span class="dl-bar"><i aria-hidden="true"></i></span>
            <span class="dl-pct">${item.pct.toFixed(1)}%</span>
          </li>`;
        }).join('')}
      </ul>`;

    el.replaceChildren(root);

    const cancelCount = animateNumber(root.querySelector('.dl-count'), data.count, 0, reduceMotion);
    const cancelAmount = animateNumber(root.querySelector('.dl-amount'), data.amount, 2, reduceMotion);
    const cancels = [cancelCount, cancelAmount];

    const fills = [...root.querySelectorAll('.dl-bar i')];
    const paint = () => {
      fills.forEach((fill, i) => { fill.style.width = `${data.categories[i].pct}%`; });
    };
    if (reduceMotion) paint();
    else requestAnimationFrame(() => requestAnimationFrame(paint));

    el.__dlCleanup = () => {
      cancels.forEach((cancel) => cancel());
      el.replaceChildren();
    };
  },
};
