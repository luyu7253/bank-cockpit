// 「网点排队时长」面板：列出 5 家分行当前的平均排队分钟数，超过 15 分钟的整行标红。
// 设计画布固定 460 × 236，页面会把整块画布等比缩放进格子，因此这里不读取窗口尺寸、不写 @media。
// 排队分钟数由固定种子在基准值附近轻微扰动，刷新页面数字一致；基准值特意让 3 家超时、2 家正常，
// 保证「小于等于 15 分钟」和「超过 15 分钟」两种状态在首屏都能看到。
//
// 纯函数 buildQueueRows / isOverQueueTime / averageQueue / queueBarPct / formatQueueMinutes
// 集中在本文件上半部分，测试只 import 它们，不依赖浏览器 DOM。

const STYLE_ID = 'branch-queue-time-style';

/** 固定随机种子：每次打开面板，5 家分行的分钟数都一致。 */
export const QUEUE_SEED = 20261112;

/** 超过该分钟数即视为排队超时（严格大于 15）。 */
export const QUEUE_THRESHOLD = 15;

/** 条形图满格刻度（分钟）：15 分钟阈值正好在条形正中间。 */
export const QUEUE_MAX = 30;

/** 5 家分行的基准分钟数（示意）：上海、北京、深圳、杭州、南京。 */
export const QUEUE_BASE = [18.2, 11.6, 23.4, 8.9, 16.8];

/** 基准值附近的扰动幅度（± 分钟）。 */
const JITTER = 1.2;

// 先加 1e-9 再四舍五入，避免 10.15 / 23.4 这类浮点误差把 1 位小数舍错。
const round1 = (value) => Math.round(value * 10 + 1e-9) / 10;
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

/** 是否超过排队时长阈值；等于 15 分钟不算超时，非法值按正常处理。 */
export function isOverQueueTime(minutes, threshold = QUEUE_THRESHOLD) {
  const value = Number(minutes);
  const limit = Number(threshold);
  return Number.isFinite(value) && Number.isFinite(limit) && value > limit;
}

/** 平均排队分钟数（保留 1 位小数）；空列表或全部非法时返回 0。 */
export function averageQueue(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const values = rows
    .map((row) => Number(row?.minutes))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return 0;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** 条形宽度百分比：以 QUEUE_MAX 为满格，夹在 0–100。 */
export function queueBarPct(minutes, max = QUEUE_MAX) {
  const value = Number(minutes);
  const top = Number(max);
  if (!Number.isFinite(value) || !Number.isFinite(top) || top <= 0) return 0;
  return round1(clamp((value / top) * 100, 0, 100));
}

/** 分钟数格式：保留 1 位小数；非法值返回「—」。 */
export function formatQueueMinutes(minutes) {
  const value = Number(minutes);
  return Number.isFinite(value) ? round1(value).toFixed(1) : '—';
}

/**
 * 生成 5 家分行的排队数据（按分钟数从多到少排列）：
 * 每家以 QUEUE_BASE 对应基准值加固定种子扰动，只消费分行数量个随机数；
 * 返回 [{ name, minutes, over, tone }]，不修改入参。
 */
export function buildQueueRows(rand = Math.random, branches = [], { threshold = QUEUE_THRESHOLD } = {}) {
  const random = typeof rand === 'function' ? rand : Math.random;
  const names = (Array.isArray(branches) ? branches : [])
    .map((branch) => (typeof branch === 'string' ? branch : branch?.name))
    .filter((name) => typeof name === 'string' && name.length > 0)
    .slice(0, QUEUE_BASE.length);
  const limit = Number.isFinite(Number(threshold)) ? Number(threshold) : QUEUE_THRESHOLD;
  return names
    .map((name, index) => {
      const base = QUEUE_BASE[index % QUEUE_BASE.length];
      const minutes = round1(Math.max(0, base + (random() * 2 - 1) * JITTER));
      const over = isOverQueueTime(minutes, limit);
      return { name, minutes, over, tone: over ? 'bad' : 'good' };
    })
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, 'zh-CN'));
}

const STYLE = `
[data-panel="branch-queue-time"] {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
[data-panel="branch-queue-time"] .bq-root {
  width: 460px; height: 236px; box-sizing: border-box;
  padding: 7px 10px; display: flex; flex-direction: column; gap: 5px;
  overflow: hidden; white-space: nowrap;
}
[data-panel="branch-queue-time"] .bq-top {
  flex: 0 0 40px; height: 40px; min-width: 0;
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
}
[data-panel="branch-queue-time"] .bq-summary {
  display: flex; flex-direction: column; justify-content: center; gap: 1px; min-width: 0;
}
[data-panel="branch-queue-time"] .bq-summary-label {
  font-size: 11px; line-height: 14px; color: var(--text-muted); letter-spacing: 0.04em;
}
[data-panel="branch-queue-time"] .bq-summary-value {
  display: flex; align-items: baseline; gap: 4px; line-height: 24px;
}
[data-panel="branch-queue-time"] .bq-summary-value b {
  font-size: 24px; line-height: 24px; font-weight: 700; letter-spacing: 0.01em;
  color: var(--text-primary); text-shadow: 0 0 14px color-mix(in srgb, var(--bq-series) 42%, transparent);
}
[data-panel="branch-queue-time"] .bq-summary-value small {
  font-size: 11px; color: var(--text-muted); font-weight: 400;
}
[data-panel="branch-queue-time"] .bq-meta {
  display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 3px; min-width: 0;
}
[data-panel="branch-queue-time"] .bq-alert {
  display: inline-flex; align-items: center; gap: 4px;
  height: 20px; padding: 0 8px; box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--bq-bad) 62%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bq-bad) 13%, transparent);
  color: var(--bq-bad); font-size: 11px; line-height: 1; font-weight: 700;
}
[data-panel="branch-queue-time"] .bq-alert i {
  font-style: normal; font-size: 10px; line-height: 1;
}
[data-panel="branch-queue-time"] .bq-threshold-note {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px; line-height: 12px; color: var(--text-muted);
}
[data-panel="branch-queue-time"] .bq-threshold-note i {
  display: inline-block; width: 1px; height: 9px;
  border-left: 1px dashed rgba(255, 255, 255, 0.48);
}
[data-panel="branch-queue-time"] .bq-list-head {
  flex: 0 0 12px; height: 12px; padding-right: 7px;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  font-size: 10px; line-height: 12px; color: var(--text-muted); letter-spacing: 0.02em;
}
[data-panel="branch-queue-time"] .bq-list-head .bq-col-name { padding-left: 34px; flex: 1 1 auto; min-width: 0; }
[data-panel="branch-queue-time"] .bq-list-head .bq-col-value { flex: 0 0 70px; text-align: right; }
[data-panel="branch-queue-time"] .bq-list-head .bq-col-state { flex: 0 0 48px; text-align: center; }
[data-panel="branch-queue-time"] .bq-list {
  list-style: none; margin: 0; padding: 0;
  flex: 1 1 auto; min-height: 0;
  display: flex; flex-direction: column; gap: 3px;
}
[data-panel="branch-queue-time"] .bq-row {
  --bq-tone: var(--bq-good);
  flex: 1 1 0; min-height: 0;
  display: grid; grid-template-columns: 20px 64px minmax(0, 1fr) 70px 48px;
  align-items: center; gap: 7px; padding: 0 7px;
  border: 1px solid rgba(79, 163, 255, 0.16); border-radius: 6px;
  background: linear-gradient(90deg, rgba(79, 195, 255, 0.045), rgba(255, 255, 255, 0.012) 60%);
  overflow: hidden;
}
[data-panel="branch-queue-time"] .bq-row.is-over {
  --bq-tone: var(--bq-bad);
  border-color: color-mix(in srgb, var(--bq-bad) 42%, transparent);
  background: linear-gradient(90deg, color-mix(in srgb, var(--bq-bad) 15%, transparent), color-mix(in srgb, var(--bq-bad) 3%, transparent) 62%);
}
[data-panel="branch-queue-time"] .bq-rank {
  width: 18px; height: 18px; box-sizing: border-box;
  border: 1px solid rgba(79, 163, 255, 0.32); border-radius: 5px;
  color: var(--text-secondary); font-size: 10px; font-weight: 700;
  line-height: 16px; text-align: center;
}
[data-panel="branch-queue-time"] .bq-row.is-over .bq-rank {
  border-color: color-mix(in srgb, var(--bq-bad) 55%, transparent);
  color: var(--bq-bad);
}
[data-panel="branch-queue-time"] .bq-name {
  min-width: 0; overflow: hidden;
  font-size: 12px; line-height: 14px; font-weight: 600;
  color: var(--text-primary);
}
[data-panel="branch-queue-time"] .bq-bar {
  position: relative; height: 6px; border-radius: 3px;
  background: rgba(148, 174, 210, 0.14);
}
[data-panel="branch-queue-time"] .bq-bar-fill {
  display: block; width: 0; height: 100%; border-radius: 3px;
  background: var(--bq-tone);
  box-shadow: 0 0 7px color-mix(in srgb, var(--bq-tone) 62%, transparent);
  transition: width 0.95s cubic-bezier(0.2, 0.8, 0.2, 1);
}
[data-panel="branch-queue-time"] .bq-bar-mark {
  position: absolute; left: 50%; top: -2px; bottom: -2px; width: 0;
  border-left: 1px dashed rgba(255, 255, 255, 0.5);
  pointer-events: none;
}
[data-panel="branch-queue-time"] .bq-minutes {
  text-align: right; font-size: 13px; line-height: 16px; font-weight: 700;
  color: var(--text-primary);
}
[data-panel="branch-queue-time"] .bq-row.is-over .bq-minutes {
  color: var(--bq-bad); text-shadow: 0 0 9px color-mix(in srgb, var(--bq-bad) 58%, transparent);
}
[data-panel="branch-queue-time"] .bq-state {
  display: inline-flex; align-items: center; justify-content: center; gap: 3px;
  width: 48px; height: 20px; box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--bq-tone) 58%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bq-tone) 12%, transparent);
  color: var(--bq-tone); font-size: 10px; line-height: 1; font-weight: 700;
}
[data-panel="branch-queue-time"] .bq-state i {
  font-style: normal; font-size: 9px; line-height: 1;
}
[data-panel="branch-queue-time"] .bq-root[data-reduce="true"] .bq-bar-fill {
  transition: none;
}
`;

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  doc.head.append(style);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

export default {
  title: '网点排队时长',
  unit: '当前 · 模拟数据',
  render(el, ctx) {
    if (typeof el.__bqCleanup === 'function') el.__bqCleanup();
    const doc = el.ownerDocument ?? document;
    ensureStyle(doc);

    const colors = ctx?.colors ?? {};
    const seriesColor = colors.series?.[0] ?? '#3987e5';
    const goodColor = colors.good ?? '#0ca30c';
    const badColor = colors.bad ?? '#e66767';

    const branchList = Array.isArray(ctx?.data?.branches) ? ctx.data.branches.slice(0, QUEUE_BASE.length) : [];
    const spawn = typeof ctx?.data?.seededRandom === 'function'
      ? ctx.data.seededRandom(QUEUE_SEED)
      : Math.random;
    const rows = buildQueueRows(spawn, branchList);
    const average = averageQueue(rows);
    const overCount = rows.filter((row) => row.over).length;
    const reduceMotion = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;

    el.replaceChildren();
    const root = doc.createElement('div');
    root.className = 'bq-root';
    root.dataset.reduce = String(reduceMotion);
    root.style.setProperty('--bq-series', seriesColor);
    root.style.setProperty('--bq-good', goodColor);
    root.style.setProperty('--bq-bad', badColor);
    root.setAttribute(
      'aria-label',
      `${rows.length} 家分行平均排队 ${formatQueueMinutes(average)} 分钟，其中 ${overCount} 家超过 ${QUEUE_THRESHOLD} 分钟`,
    );

    const rowHtml = rows.map((row, index) => {
      const width = queueBarPct(row.minutes).toFixed(1);
      return `<li class="bq-row${row.over ? ' is-over' : ''}"
        aria-label="第 ${index + 1} 名，${escapeHtml(row.name)}，平均排队 ${formatQueueMinutes(row.minutes)} 分钟，${row.over ? '超时' : '正常'}">
        <span class="bq-rank">${index + 1}</span>
        <span class="bq-name">${escapeHtml(row.name)}</span>
        <span class="bq-bar"><i class="bq-bar-fill" data-width="${width}"></i><i class="bq-bar-mark" title="15 分钟阈值" aria-hidden="true"></i></span>
        <span class="bq-minutes">${formatQueueMinutes(row.minutes)}</span>
        <span class="bq-state"><i aria-hidden="true">${row.over ? '!' : '✓'}</i>${row.over ? '超时' : '正常'}</span>
      </li>`;
    }).join('');

    root.innerHTML = `
      <div class="bq-top">
        <div class="bq-summary">
          <span class="bq-summary-label">当前平均排队</span>
          <span class="bq-summary-value"><b>${formatQueueMinutes(average)}</b><small>分钟</small></span>
        </div>
        <div class="bq-meta">
          <span class="bq-alert"><i aria-hidden="true">!</i>${overCount} 家超时</span>
          <span class="bq-threshold-note"><i aria-hidden="true"></i>阈值 15 分钟，超过标红</span>
        </div>
      </div>
      <div class="bq-list-head">
        <span class="bq-col-name">分行</span>
        <span class="bq-col-value">排队分钟</span>
        <span class="bq-col-state">状态</span>
      </div>
      <ul class="bq-list" aria-label="5 家分行当前平均排队分钟数">${rowHtml}</ul>`;
    el.append(root);

    // 条形从 0 增长到目标宽度；减少动效时直接显示最终宽度。
    const fills = [...root.querySelectorAll('.bq-bar-fill')];
    if (reduceMotion) {
      fills.forEach((fill) => { fill.style.width = `${fill.dataset.width}%`; });
    } else {
      const frame = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (fn) => setTimeout(fn, 16);
      frame(() => fills.forEach((fill) => { fill.style.width = `${fill.dataset.width}%`; }));
    }

    el.__bqCleanup = () => {
      el.replaceChildren();
    };
  },
};
