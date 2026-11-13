// 「贷款投放进度」面板：年度计划 2,800 亿元、已投放 2,180 亿元的主进度条，
// 下方三类贷款（对公 / 零售 / 小微）的已投放、计划与完成率小条形。
// 固定设计画布 460 × 236，整块由 AI 建设区等比缩放；纯函数集中在本文件，测试不依赖 DOM。

/** 固定随机种子：每次打开面板，三类贷款的微调数值都一致。 */
export const LOAN_PROGRESS_SEED = 20261112;

/** 年度贷款投放计划（亿元），固定。 */
export const ANNUAL_PLAN = 2800;

/** 已投放（亿元），固定；三类已投放合计必须等于它。 */
export const DEPLOYED = 2180;

/** 时间进度（%）：10 月末 / 全年 = 83.3%。 */
export const TIME_PROGRESS = 83.3;

/** 三类贷款的基准值（亿元）：已投放合计 2,180、计划合计 2,800。 */
export const CATEGORY_BASE = [
  { key: 'corporate', name: '对公贷款', done: 1220, plan: 1600 },
  { key: 'retail', name: '零售贷款', done: 640, plan: 800 },
  { key: 'small', name: '小微贷款', done: 320, plan: 400 },
];

const round1 = (value) => Math.round(value * 10) / 10;

/** 完成率（%），保留 1 位小数；计划为 0 或非法时返回 0。 */
export function progressPct(done, plan) {
  if (!Number.isFinite(done) || !Number.isFinite(plan) || plan <= 0) return 0;
  return round1((done / plan) * 100);
}

/** 单个分类的已完成情况：{ done, plan, pct }。 */
export function categoryProgress(done, plan) {
  return {
    done: Number.isFinite(done) ? done : 0,
    plan: Number.isFinite(plan) ? plan : 0,
    pct: progressPct(done, plan),
  };
}

/**
 * 按权重把整数总额拆到各项，用「最大余数法」分配，保证合计精确等于 total。
 * 权重非法时按均分处理。
 */
function allocate(total, weights) {
  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = safe.reduce((acc, w) => acc + w, 0);
  const normalized = sum > 0 ? safe : safe.map(() => 1);
  const normSum = normalized.reduce((acc, w) => acc + w, 0);
  const raw = normalized.map((w) => (total * w) / normSum);
  const floors = raw.map(Math.floor);
  let remain = total - floors.reduce((acc, v) => acc + v, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < remain; k += 1) floors[order[k % order.length].i] += 1;
  return floors;
}

/**
 * 依据与时间进度的差距给出状态：warn / bad 一定带图标和中文文字，不只靠颜色表达。
 * 差距 = 投放进度 − 时间进度（百分点，正数表示领先）。
 */
export function statusOf(pct, timePct = TIME_PROGRESS) {
  const diff = pct - timePct;
  if (diff >= 1) return { tone: 'good', icon: '▲', text: '快于时间进度' };
  if (diff >= -2) return { tone: 'good', icon: '●', text: '基本符合时间进度' };
  if (diff >= -8) return { tone: 'warn', icon: '▼', text: '略慢于时间进度' };
  return { tone: 'bad', icon: '⚠', text: '明显落后时间进度' };
}

/**
 * 生成年度贷款投放进度：主口径固定，三类贷款金额用固定种子微调，
 * 但三类已投放合计恒为 2,180 亿元、计划合计恒为 2,800 亿元。
 * @param {() => number} random 随机数函数（页面传入 ctx.data.seededRandom(20261112)）
 */
export function buildLoanProgress(random = Math.random) {
  const r = typeof random === 'function' ? random : Math.random;

  // 每类在基准值上下浮动 ±4%，再由最大余数法归一到固定总额。
  const doneWeights = CATEGORY_BASE.map((c) => c.done * (0.96 + r() * 0.08));
  const planWeights = CATEGORY_BASE.map((c) => c.plan * (0.96 + r() * 0.08));
  const doneList = allocate(DEPLOYED, doneWeights);
  const planList = allocate(ANNUAL_PLAN, planWeights);

  const categories = CATEGORY_BASE.map((c, i) => {
    const item = categoryProgress(doneList[i], planList[i]);
    return {
      key: c.key,
      name: c.name,
      done: item.done,
      plan: item.plan,
      pct: item.pct,
      seriesIndex: i,
    };
  });

  const pct = progressPct(DEPLOYED, ANNUAL_PLAN);
  return {
    plan: ANNUAL_PLAN,
    done: DEPLOYED,
    pct,
    timePct: TIME_PROGRESS,
    gap: round1(TIME_PROGRESS - pct), // 落后时间进度 5.4 个百分点
    status: statusOf(pct),
    categories,
  };
}

const STYLE_ID = 'loan-progress-style';

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
[data-panel="loan-progress"] .lp-root {
  position: relative;
  width: 460px; height: 236px;
  padding: 10px 16px;
  display: flex; flex-direction: column; gap: 6px;
  overflow: hidden;
  white-space: nowrap;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
[data-panel="loan-progress"] .lp-root * { white-space: nowrap; }
[data-panel="loan-progress"] .lp-head {
  flex: 0 0 auto;
  display: flex; flex-direction: column;
}
[data-panel="loan-progress"] .lp-head-top {
  height: 16px;
  display: flex; align-items: center; justify-content: space-between;
}
[data-panel="loan-progress"] .lp-eyebrow {
  font-size: 11px; color: var(--text-muted); letter-spacing: 0.08em;
}
[data-panel="loan-progress"] .lp-status {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; line-height: 11px;
  padding: 1px 6px; border-radius: 4px;
}
[data-panel="loan-progress"] .lp-status-icon { font-size: 9px; }
[data-panel="loan-progress"] .lp-status-warn {
  color: var(--warn);
  background: rgba(250, 178, 25, 0.12);
  border: 1px solid rgba(250, 178, 25, 0.38);
}
[data-panel="loan-progress"] .lp-status-good {
  color: var(--good);
  background: rgba(12, 163, 12, 0.12);
  border: 1px solid rgba(12, 163, 12, 0.38);
}
[data-panel="loan-progress"] .lp-status-bad {
  color: var(--bad);
  background: rgba(230, 103, 103, 0.12);
  border: 1px solid rgba(230, 103, 103, 0.38);
}
[data-panel="loan-progress"] .lp-main {
  height: 38px;
  display: flex; align-items: flex-end; justify-content: space-between;
}
[data-panel="loan-progress"] .lp-done { display: flex; align-items: baseline; gap: 5px; line-height: 1; }
[data-panel="loan-progress"] .lp-done-num {
  font-size: 30px; font-weight: 700; letter-spacing: 0.01em;
  color: var(--text-primary);
  text-shadow: 0 0 16px rgba(79, 195, 255, 0.32);
}
[data-panel="loan-progress"] .lp-done-unit { font-size: 11px; color: var(--text-muted); }
[data-panel="loan-progress"] .lp-right { text-align: right; line-height: 1.05; }
[data-panel="loan-progress"] .lp-pct-label { font-size: 11px; color: var(--text-muted); }
[data-panel="loan-progress"] .lp-pct {
  font-size: 20px; font-weight: 700; color: var(--accent);
  text-shadow: 0 0 12px rgba(79, 195, 255, 0.35);
}
[data-panel="loan-progress"] .lp-pct small { font-size: 11px; font-weight: 500; margin-left: 1px; }
[data-panel="loan-progress"] .lp-meta {
  height: 15px; margin-top: 2px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 11px;
}
[data-panel="loan-progress"] .lp-plan { color: var(--text-muted); }
[data-panel="loan-progress"] .lp-plan b { color: var(--text-secondary); font-weight: 600; }
[data-panel="loan-progress"] .lp-time {
  display: inline-flex; align-items: center; gap: 5px;
  color: var(--warn); font-weight: 600;
}
[data-panel="loan-progress"] .lp-time-mark {
  width: 6px; height: 6px; border-radius: 1px;
  background: var(--warn);
  transform: rotate(45deg);
  box-shadow: 0 0 6px rgba(250, 178, 25, 0.75);
}
[data-panel="loan-progress"] .lp-bar {
  position: relative;
  height: 12px; margin-top: 5px;
  border-radius: 6px;
  background: var(--grid);
  border: 1px solid var(--border);
}
[data-panel="loan-progress"] .lp-bar-fill {
  position: absolute; left: 0; top: 0; bottom: 0; width: 0;
  border-radius: 6px;
  background: linear-gradient(90deg, rgba(57, 135, 229, 0.55), var(--series-1));
  box-shadow: 0 0 10px rgba(57, 135, 229, 0.45);
  transition: width 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
}
[data-panel="loan-progress"] .lp-bar-marker {
  position: absolute; top: 0; bottom: 0; width: 12px; margin-left: -6px;
  background: transparent;
  pointer-events: none;
}
[data-panel="loan-progress"] .lp-bar-marker::after {
  content: ""; position: absolute; top: 0; bottom: 0; left: 5px; width: 2px;
  background: var(--warn);
  border-radius: 2px;
  box-shadow: 0 0 6px rgba(250, 178, 25, 0.8);
}
[data-panel="loan-progress"] .lp-bar-marker::before {
  content: ""; position: absolute; top: -4px; left: 3px;
  width: 6px; height: 6px; border-radius: 1px;
  background: var(--warn);
  transform: rotate(45deg);
}
[data-panel="loan-progress"] .lp-cats {
  list-style: none; margin: 0; padding: 0;
  flex: 1 1 auto; min-height: 0;
  display: flex; flex-direction: column; gap: 5px;
}
[data-panel="loan-progress"] .lp-cat {
  flex: 0 0 36px; height: 36px;
  display: grid;
  grid-template-columns: 8px 62px minmax(0, 1fr) 48px;
  grid-template-rows: 20px 8px;
  row-gap: 2px; column-gap: 8px;
  align-content: center;
  animation: lp-row-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(var(--i, 0) * 70ms + 80ms);
}
[data-panel="loan-progress"] .lp-static .lp-cat { animation: none; }
[data-panel="loan-progress"] .lp-dot {
  grid-row: 1; grid-column: 1;
  width: 8px; height: 8px; border-radius: 2px;
  align-self: center;
}
[data-panel="loan-progress"] .lp-cat-name {
  grid-row: 1; grid-column: 2;
  font-size: 13px; color: var(--text-secondary);
}
[data-panel="loan-progress"] .lp-cat-nums {
  grid-row: 1; grid-column: 3;
  text-align: right;
  font-size: 12px; color: var(--text-muted);
}
[data-panel="loan-progress"] .lp-cat-nums b { font-size: 13px; font-weight: 600; color: var(--text-primary); }
[data-panel="loan-progress"] .lp-cat-pct {
  grid-row: 1; grid-column: 4;
  text-align: right;
  font-size: 12px; font-weight: 600; color: var(--text-primary);
}
[data-panel="loan-progress"] .lp-cat-bar {
  grid-row: 2; grid-column: 2 / -1;
  position: relative; height: 6px; border-radius: 3px;
  background: var(--grid);
  overflow: hidden;
}
[data-panel="loan-progress"] .lp-cat-fill {
  position: absolute; left: 0; top: 0; bottom: 0; width: 0;
  border-radius: 3px;
  transition: width 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
}
[data-panel="loan-progress"] .lp-static .lp-bar-fill,
[data-panel="loan-progress"] .lp-static .lp-cat-fill { transition: none; }
@keyframes lp-row-in {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: none; }
}`;
  document.head.append(style);
}

function formatInt(value) {
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

export default {
  title: '贷款投放进度',
  unit: '年度计划 · 模拟数据',
  render(el, ctx) {
    ensureStyle();

    const random = ctx?.data?.seededRandom ? ctx.data.seededRandom(LOAN_PROGRESS_SEED) : Math.random;
    const data = buildLoanProgress(random);
    const series = ctx?.colors?.series ?? ['#3987e5', '#d95926', '#199e70'];
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const statusClass = `lp-status lp-status-${data.status.tone}`;

    el.replaceChildren();
    const root = document.createElement('div');
    root.className = `lp-root${reduce ? ' lp-static' : ''}`;
    root.innerHTML = `
      <div class="lp-head">
        <div class="lp-head-top">
          <span class="lp-eyebrow">年度贷款投放</span>
          <span class="${statusClass}"><i class="lp-status-icon">${data.status.icon}</i>${data.status.text}</span>
        </div>
        <div class="lp-main">
          <div class="lp-done">
            <b class="lp-done-num">${formatInt(data.done)}</b>
            <span class="lp-done-unit">亿元</span>
          </div>
          <div class="lp-right">
            <div class="lp-pct-label">投放进度</div>
            <div class="lp-pct">${data.pct.toFixed(1)}<small>%</small></div>
          </div>
        </div>
        <div class="lp-meta">
          <span class="lp-plan">年度计划 <b>${formatInt(data.plan)} 亿元</b></span>
          <span class="lp-time"><i class="lp-time-mark"></i>时间进度 83.3%</span>
        </div>
        <div class="lp-bar">
          <div class="lp-bar-fill"></div>
          <div class="lp-bar-marker" style="left:${data.timePct}%"></div>
        </div>
      </div>
      <ul class="lp-cats"></ul>`;

    const cats = root.querySelector('.lp-cats');
    data.categories.forEach((item, i) => {
      const color = series[item.seriesIndex] ?? 'var(--series-1)';
      const li = document.createElement('li');
      li.className = 'lp-cat';
      li.style.setProperty('--i', String(i));
      li.innerHTML = `
        <i class="lp-dot" style="background:${color};box-shadow:0 0 7px ${color}"></i>
        <span class="lp-cat-name">${item.name}</span>
        <span class="lp-cat-nums"><b>${formatInt(item.done)}</b> / ${formatInt(item.plan)} 亿元</span>
        <span class="lp-cat-pct">${item.pct.toFixed(1)}%</span>
        <span class="lp-cat-bar"><i class="lp-cat-fill" style="background:${color}"></i></span>`;
      cats.append(li);
    });

    el.append(root);

    const barFill = root.querySelector('.lp-bar-fill');
    const catFills = [...root.querySelectorAll('.lp-cat-fill')];
    const paint = () => {
      barFill.style.width = `${data.pct}%`;
      catFills.forEach((fill, i) => {
        fill.style.width = `${data.categories[i].pct}%`;
      });
    };
    if (reduce) paint();
    else requestAnimationFrame(() => requestAnimationFrame(paint));
  },
};
