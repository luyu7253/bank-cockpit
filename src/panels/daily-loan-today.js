// 「今日放款笔数」面板（第二版）：大字展示今日放款笔数与金额，下方用一条 100% 堆叠条
// 和三个分类卡片列出个人贷 / 经营贷 / 消费贷的笔数占比与笔数。
// 固定 460 × 236 设计画布，不读取窗口尺寸、不写 @media；纯函数集中在本文件，测试不依赖 DOM。
// 总笔数、总金额与三类分配沿用同一模拟口径（种子 20261112），与已有同名面板数字保持一致。

const STYLE_ID = 'daily-loan-today-style';

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

/** 一组占比的合计（%），保留 1 位小数；用于展示「合计 100.0%」。 */
export function sumPct(list) {
  if (!Array.isArray(list)) return 0;
  return round1(list.reduce((acc, item) => acc + (Number.isFinite(item?.pct) ? item.pct : 0), 0));
}

/**
 * 生成今日放款数据：总笔数、总金额固定，三类笔数按基准值抖动后归一到总笔数。
 * width 为未取整的精确占比（保证堆叠条宽度合计正好 100%），pct 为展示用的 1 位小数占比。
 * @param {() => number} random 随机数函数（页面传入 ctx.data.seededRandom(DAILY_LOAN_SEED)）
 */
export function buildDailyLoans(random = Math.random) {
  const r = typeof random === 'function' ? random : Math.random;
  const weights = LOAN_CATEGORIES.map((c) => c.baseCount * (0.92 + r() * 0.16));
  const counts = allocateInt(TOTAL_COUNT, weights);
  const categories = LOAN_CATEGORIES.map((c, i) => {
    const count = counts[i] ?? 0;
    return {
      key: c.key,
      name: c.name,
      count,
      pct: sharePct(count, TOTAL_COUNT),
      width: TOTAL_COUNT > 0 ? (count / TOTAL_COUNT) * 100 : 0,
    };
  });

  return {
    count: TOTAL_COUNT,
    amount: TOTAL_AMOUNT,
    avg: avgTicket(TOTAL_AMOUNT, TOTAL_COUNT),
    totalPct: sumPct(categories),
    categories,
  };
}

const STYLE = `
[data-panel="daily-loan-today"] {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
[data-panel="daily-loan-today"] .dlt-root {
  position: relative;
  width: 460px; height: 236px; box-sizing: border-box;
  padding: 11px 16px 12px;
  display: flex; flex-direction: column; gap: 7px;
  overflow: hidden; white-space: nowrap;
  background: radial-gradient(120% 90% at 50% 0%, rgba(79, 195, 255, 0.06), transparent 62%);
}
[data-panel="daily-loan-today"] .dlt-root * { white-space: nowrap; }
[data-panel="daily-loan-today"] .dlt-head {
  flex: 0 0 15px; height: 15px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  font-size: 11px; line-height: 15px; color: var(--text-muted);
}
[data-panel="daily-loan-today"] .dlt-head b { color: var(--text-secondary); font-weight: 600; }
[data-panel="daily-loan-today"] .dlt-hero {
  flex: 0 0 66px; height: 66px;
  display: flex; align-items: flex-end; justify-content: space-between; gap: 18px;
}
[data-panel="daily-loan-today"] .dlt-block { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
[data-panel="daily-loan-today"] .dlt-block.right { align-items: flex-end; }
[data-panel="daily-loan-today"] .dlt-label {
  font-size: 11px; line-height: 13px; letter-spacing: 0.08em; color: var(--text-muted);
}
[data-panel="daily-loan-today"] .dlt-line { display: flex; align-items: baseline; gap: 5px; line-height: 1.08; }
[data-panel="daily-loan-today"] .dlt-count {
  font-size: 44px; font-weight: 700; letter-spacing: 0.01em;
  color: var(--text-primary);
  text-shadow: 0 0 20px rgba(79, 195, 255, 0.36);
}
[data-panel="daily-loan-today"] .dlt-amount {
  font-size: 33px; font-weight: 700; letter-spacing: 0.01em;
  color: var(--accent);
  text-shadow: 0 0 18px rgba(79, 195, 255, 0.44);
}
[data-panel="daily-loan-today"] .dlt-unit { font-size: 12px; font-weight: 500; color: var(--text-muted); }
[data-panel="daily-loan-today"] .dlt-sec {
  flex: 0 0 15px; height: 15px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  font-size: 11px; line-height: 15px; color: var(--text-muted);
}
[data-panel="daily-loan-today"] .dlt-sec b { color: var(--text-secondary); font-weight: 600; }
[data-panel="daily-loan-today"] .dlt-sec-title {
  display: flex; align-items: center; gap: 5px;
  font-weight: 600; color: var(--text-secondary);
}
[data-panel="daily-loan-today"] .dlt-sec-title::before {
  content: ""; width: 3px; height: 10px; border-radius: 2px;
  background: var(--accent); box-shadow: 0 0 6px var(--accent);
}
[data-panel="daily-loan-today"] .dlt-bar {
  position: relative; flex: 0 0 20px; height: 20px;
  border-radius: 10px; overflow: hidden;
  background: rgba(148, 174, 210, 0.12);
  box-shadow: inset 0 0 0 1px rgba(79, 163, 255, 0.12);
  display: flex;
}
[data-panel="daily-loan-today"] .dlt-seg {
  position: relative; flex: 0 0 auto; width: 0; height: 100%;
  box-sizing: border-box; border: 0; border-right: 3px solid transparent;
  background: linear-gradient(90deg, color-mix(in srgb, var(--dlt-c) 58%, transparent), var(--dlt-c));
  background-clip: padding-box;
  display: flex; align-items: center; overflow: hidden;
  transition: width 0.85s cubic-bezier(0.2, 0.8, 0.2, 1);
}
[data-panel="daily-loan-today"] .dlt-seg:last-child { border-right: 0; }
[data-panel="daily-loan-today"] .dlt-seg:first-child { border-radius: 10px 0 0 10px; }
[data-panel="daily-loan-today"] .dlt-seg:last-child { border-radius: 0 10px 10px 0; }
[data-panel="daily-loan-today"] .dlt-seg::after {
  content: ""; position: absolute; inset: 0;
  box-shadow: inset 0 0 12px color-mix(in srgb, var(--dlt-c) 70%, transparent);
  pointer-events: none;
}
[data-panel="daily-loan-today"] .dlt-seg-label {
  position: relative; z-index: 1;
  padding-left: 8px; font-size: 10.5px; font-weight: 600; line-height: 20px;
  color: #f4f8ff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
[data-panel="daily-loan-today"] .dlt-legend {
  list-style: none; margin: 0; padding: 0;
  flex: 1 1 auto; min-height: 0;
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;
}
[data-panel="daily-loan-today"] .dlt-card {
  display: flex; flex-direction: column; justify-content: center; gap: 2px;
  padding: 5px 9px; min-width: 0;
  border: 1px solid rgba(79, 163, 255, 0.16); border-radius: 7px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--dlt-c) 10%, transparent), rgba(255, 255, 255, 0.012));
  animation: dlt-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(90ms + var(--i, 0) * 70ms);
}
[data-panel="daily-loan-today"] .dlt-card-top { display: flex; align-items: center; gap: 6px; }
[data-panel="daily-loan-today"] .dlt-dot {
  width: 7px; height: 7px; border-radius: 2px; flex: 0 0 auto;
  background: var(--dlt-c);
  box-shadow: 0 0 7px var(--dlt-c);
}
[data-panel="daily-loan-today"] .dlt-name {
  font-size: 12px; font-weight: 600; line-height: 15px; color: var(--text-primary);
}
[data-panel="daily-loan-today"] .dlt-foot { display: flex; align-items: baseline; gap: 5px; }
[data-panel="daily-loan-today"] .dlt-pct {
  font-size: 21px; font-weight: 700; line-height: 23px; color: var(--text-primary);
}
[data-panel="daily-loan-today"] .dlt-sub { font-size: 10.5px; line-height: 14px; color: var(--text-muted); }
[data-panel="daily-loan-today"] .dlt-sub b { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
[data-panel="daily-loan-today"] .dlt-static .dlt-seg { transition: none; }
[data-panel="daily-loan-today"] .dlt-static .dlt-card { animation: none; }
@keyframes dlt-in {
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
  unit: '今日 · 三类占比',
  render(el, ctx) {
    if (typeof el.__dltCleanup === 'function') el.__dltCleanup();
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
    root.className = `dlt-root${reduceMotion ? ' dlt-static' : ''}`;
    root.setAttribute(
      'aria-label',
      `今日放款 ${formatInt(data.count)} 笔，金额 ${data.amount.toFixed(2)} 亿元；`
        + data.categories.map((c) => `${c.name} ${c.pct.toFixed(1)}%，${c.count} 笔`).join('；'),
    );

    root.innerHTML = `
      <div class="dlt-head">
        <span>今日放款 · 截至 16:30</span>
        <span>笔均 <b>${data.avg.toFixed(1)} 万元</b></span>
      </div>
      <div class="dlt-hero">
        <div class="dlt-block">
          <span class="dlt-label">放款笔数</span>
          <span class="dlt-line"><b class="dlt-count">0</b><span class="dlt-unit">笔</span></span>
        </div>
        <div class="dlt-block right">
          <span class="dlt-label">放款金额</span>
          <span class="dlt-line"><b class="dlt-amount">0.00</b><span class="dlt-unit">亿元</span></span>
        </div>
      </div>
      <div class="dlt-sec">
        <span class="dlt-sec-title">三类笔数占比</span>
        <span>合计 <b>${data.totalPct.toFixed(1)}%</b></span>
      </div>
      <div class="dlt-bar" role="img" aria-label="三类贷款笔数占比">
        ${data.categories.map((item, i) => `
          <span class="dlt-seg" data-width="${item.width}" style="--dlt-c:${colors[i] ?? `var(--series-${i + 1})`}">
            <span class="dlt-seg-label">${item.name} ${item.pct.toFixed(1)}%</span>
          </span>`).join('')}
      </div>
      <ul class="dlt-legend" aria-label="三类贷款笔数明细">
        ${data.categories.map((item, i) => `
          <li class="dlt-card" style="--dlt-c:${colors[i] ?? `var(--series-${i + 1})`};--i:${i}"
              aria-label="${item.name} ${item.pct.toFixed(1)}%，${item.count} 笔">
            <span class="dlt-card-top">
              <i class="dlt-dot" aria-hidden="true"></i>
              <span class="dlt-name">${item.name}</span>
            </span>
            <span class="dlt-foot">
              <span class="dlt-pct">${item.pct.toFixed(1)}%</span>
              <span class="dlt-sub"><b>${formatInt(item.count)}</b> 笔</span>
            </span>
          </li>`).join('')}
      </ul>`;

    el.replaceChildren(root);

    const cancelCount = animateNumber(root.querySelector('.dlt-count'), data.count, 0, reduceMotion);
    const cancelAmount = animateNumber(root.querySelector('.dlt-amount'), data.amount, 2, reduceMotion);
    const cancels = [cancelCount, cancelAmount];

    const segments = [...root.querySelectorAll('.dlt-seg')];
    const paint = () => {
      segments.forEach((seg) => {
        seg.style.width = `${Number(seg.dataset.width)}%`;
      });
    };
    if (reduceMotion) paint();
    else requestAnimationFrame(() => requestAnimationFrame(paint));

    el.__dltCleanup = () => {
      cancels.forEach((cancel) => cancel());
      el.replaceChildren();
    };
  },
};
