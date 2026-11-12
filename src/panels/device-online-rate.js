// 「设备在线率」面板：全行 ATM 在线率仪表盘 + 离线台数最多的 3 家分行。
// 设计画布固定 460 × 236，页面会把整块画布等比缩放进格子，因此这里不读取窗口尺寸。
// 在线率与离线台数均为固定口径的模拟数据，分行分布用固定种子生成，刷新一致。
//
// 纯函数 buildAtmStatus / offlineCounts / topOfflineBranches 集中在本文件上半部分，
// 测试只 import 它们，不依赖浏览器 DOM。

const STYLE_ID = 'device-online-rate-style';

/** 固定随机种子：每次打开面板，10 家分行的离线分布都一致。 */
export const ATM_SEED = 20261112;

/** 全行 ATM 总台数与离线台数（固定口径：2140 - 30 = 2110 台在线）。 */
export const ATM_TOTAL = 2140;
export const ATM_OFFLINE = 30;

/** 在线率达标目标（%），仅作演示口径。 */
export const ATM_TARGET = 95;

/**
 * 由总台数与离线台数计算在线率（%，保留 1 位小数）。
 * 2140 / 30 → 98.6%，与面板中心大字完全自洽。
 */
export function buildAtmStatus(total = ATM_TOTAL, offline = ATM_OFFLINE) {
  const rawTotal = Number(total);
  const rawOffline = Number(offline);
  const t = Number.isFinite(rawTotal) ? Math.max(0, Math.trunc(rawTotal)) : ATM_TOTAL;
  const o = Number.isFinite(rawOffline) ? Math.min(t, Math.max(0, Math.trunc(rawOffline))) : 0;
  const online = t - o;
  const rate = t > 0 ? Math.round((online / t) * 1000) / 10 : 0;
  return { total: t, offline: o, online, rate, target: ATM_TARGET, reached: rate >= ATM_TARGET };
}

const branchNameOf = (branch) => (typeof branch === 'string' ? branch : branch?.name);

/**
 * 把离线台数分摊到各分行，合计严格等于 total（默认 30 台）。
 * 做法：先按固定种子给每家分行一个「设备故障权重」（0.6–1.8），
 * 再用 total 次加权抽样逐台落到分行；因此结果是整数、合计准确、同一种子可复现。
 * 返回按入参分行顺序排列的 [{ name, offline }]，不修改入参。
 */
export function offlineCounts(random = Math.random, branches = [], { total = ATM_OFFLINE } = {}) {
  const rand = typeof random === 'function' ? random : Math.random;
  const names = (Array.isArray(branches) ? branches : [])
    .map(branchNameOf)
    .filter((name) => typeof name === 'string' && name.length > 0);
  const counts = names.map((name) => ({ name, offline: 0 }));
  const rawTotal = Number(total);
  const draws = Number.isFinite(rawTotal) ? Math.max(0, Math.trunc(rawTotal)) : ATM_OFFLINE;
  if (counts.length === 0 || draws === 0) return counts;

  const weights = counts.map(() => 0.6 + rand() * 1.2);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  for (let d = 0; d < draws; d += 1) {
    let x = rand() * weightSum;
    let k = 0;
    while (k < weights.length - 1 && x >= weights[k]) {
      x -= weights[k];
      k += 1;
    }
    counts[k].offline += 1;
  }
  return counts;
}

/**
 * 按离线台数从多到少取前 count 家分行；台数相同时保持入参顺序，结果稳定。
 * 返回新数组，不修改入参。
 */
export function topOfflineBranches(rows = [], count = 3) {
  const rawCount = Number(count);
  const limit = Number.isFinite(rawCount) ? Math.max(0, Math.trunc(rawCount)) : 3;
  if (!Array.isArray(rows) || limit === 0) return [];
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => (Number(b.row?.offline) || 0) - (Number(a.row?.offline) || 0) || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.row);
}

const STYLE = `
[data-panel="device-online-rate"] {
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
[data-panel="device-online-rate"] .db-root {
  width: 460px; height: 236px; box-sizing: border-box;
  padding: 6px 10px 7px; display: flex; flex-direction: column;
  overflow: hidden; white-space: nowrap;
}
[data-panel="device-online-rate"] .db-top {
  flex: 0 0 124px; height: 124px; min-width: 0;
  display: flex; align-items: stretch; gap: 8px;
}
[data-panel="device-online-rate"] .db-gauge {
  position: relative; flex: 0 0 232px; width: 232px; height: 124px;
}
[data-panel="device-online-rate"] .db-gauge-svg {
  display: block; width: 232px; height: 124px; overflow: visible;
}
[data-panel="device-online-rate"] .db-gauge-track {
  fill: none; stroke: rgba(148, 174, 210, 0.17);
  stroke-width: 11; stroke-linecap: round;
}
[data-panel="device-online-rate"] .db-gauge-progress {
  fill: none; stroke: var(--db-series); stroke-width: 11; stroke-linecap: round;
  stroke-dasharray: 1; stroke-dashoffset: 0;
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--db-series) 70%, transparent));
  animation: db-gauge-draw 1.05s cubic-bezier(0.25, 0.8, 0.25, 1) both;
}
[data-panel="device-online-rate"] .db-gauge-dot {
  fill: var(--db-series); stroke: var(--surface-1); stroke-width: 2;
  filter: drop-shadow(0 0 5px var(--db-series));
}
[data-panel="device-online-rate"] .db-gauge-scale {
  fill: var(--text-muted); font-size: 9px; letter-spacing: 0.02em;
}
[data-panel="device-online-rate"] .db-gauge-center {
  position: absolute; left: 0; right: 0; top: 46px;
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  pointer-events: none;
}
[data-panel="device-online-rate"] .db-rate {
  display: flex; align-items: baseline; justify-content: center; gap: 1px;
  font-size: 28px; line-height: 30px; font-weight: 700; letter-spacing: 0.01em;
  color: var(--text-primary);
  text-shadow: 0 0 16px color-mix(in srgb, var(--db-series) 42%, transparent);
  white-space: nowrap;
}
[data-panel="device-online-rate"] .db-rate em {
  font-style: normal; font-size: 13px; line-height: 1; font-weight: 600;
  color: var(--text-secondary);
}
[data-panel="device-online-rate"] .db-gauge-label {
  font-size: 11px; line-height: 13px; letter-spacing: 0.08em;
  color: var(--text-muted); white-space: nowrap;
}
[data-panel="device-online-rate"] .db-summary {
  flex: 1 1 auto; min-width: 0;
  display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
  gap: 2px; padding-top: 2px;
}
[data-panel="device-online-rate"] .db-status {
  align-self: flex-end;
  display: inline-flex; align-items: center; gap: 4px;
  height: 20px; padding: 0 8px; box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--db-good) 62%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--db-good) 13%, transparent);
  color: var(--db-good); font-size: 11px; font-weight: 700; line-height: 1;
}
[data-panel="device-online-rate"] .db-status i {
  font-style: normal; font-size: 10px; line-height: 1;
}
[data-panel="device-online-rate"] .db-stat {
  width: 100%; min-width: 0;
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
}
[data-panel="device-online-rate"] .db-stat-label {
  font-size: 11px; line-height: 14px; color: var(--text-muted);
}
[data-panel="device-online-rate"] .db-stat-value {
  font-size: 20px; line-height: 24px; font-weight: 700;
  color: var(--text-primary); white-space: nowrap;
}
[data-panel="device-online-rate"] .db-stat-value small {
  margin-left: 2px; font-size: 10px; font-weight: 400; color: var(--text-muted);
}
[data-panel="device-online-rate"] .db-stat.is-offline .db-stat-value {
  color: var(--db-warn);
}
[data-panel="device-online-rate"] .db-target {
  font-size: 10px; line-height: 12px; color: var(--text-muted); white-space: nowrap;
}
[data-panel="device-online-rate"] .db-target b {
  font-weight: 600; color: var(--text-secondary);
}
[data-panel="device-online-rate"] .db-bottom {
  flex: 1 1 auto; min-height: 0;
  margin-top: 2px; padding-top: 3px;
  border-top: 1px solid rgba(79, 163, 255, 0.12);
  display: flex; flex-direction: column; gap: 2px;
}
[data-panel="device-online-rate"] .db-list-head {
  flex: 0 0 13px; height: 13px; min-width: 0;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
[data-panel="device-online-rate"] .db-list-title {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; line-height: 13px; font-weight: 600; color: var(--text-secondary);
}
[data-panel="device-online-rate"] .db-list-title::before {
  content: ""; width: 3px; height: 10px; border-radius: 2px;
  background: var(--db-series); box-shadow: 0 0 6px var(--db-series);
}
[data-panel="device-online-rate"] .db-list-meta {
  font-size: 10px; line-height: 12px; color: var(--text-muted); white-space: nowrap;
}
[data-panel="device-online-rate"] .db-list {
  list-style: none; margin: 0; padding: 0;
  flex: 1 1 auto; min-height: 0;
  display: flex; flex-direction: column; gap: 2px;
}
[data-panel="device-online-rate"] .db-row {
  flex: 1 1 0; min-height: 0;
  display: grid; grid-template-columns: 18px 66px minmax(0, 1fr) 66px;
  align-items: center; gap: 8px; padding: 0 8px;
  border: 1px solid rgba(79, 163, 255, 0.15); border-radius: 6px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--db-tone) 9%, transparent), rgba(255, 255, 255, 0.012));
  overflow: hidden; white-space: nowrap;
}
[data-panel="device-online-rate"] .db-row.tone-bad { --db-tone: var(--db-bad); }
[data-panel="device-online-rate"] .db-row.tone-warn { --db-tone: var(--db-warn); }
[data-panel="device-online-rate"] .db-rank {
  width: 18px; height: 18px; box-sizing: border-box;
  border: 1px solid var(--db-tone); border-radius: 5px;
  color: var(--db-tone); font-size: 10px; font-weight: 700;
  line-height: 16px; text-align: center;
}
[data-panel="device-online-rate"] .db-name {
  min-width: 0; overflow: hidden;
  font-size: 12px; line-height: 14px; font-weight: 600;
  color: var(--text-primary); white-space: nowrap;
}
[data-panel="device-online-rate"] .db-bar {
  height: 5px; border-radius: 3px; overflow: hidden;
  background: rgba(148, 174, 210, 0.14);
}
[data-panel="device-online-rate"] .db-bar i {
  display: block; height: 100%; border-radius: 3px;
  background: var(--db-tone);
  box-shadow: 0 0 6px color-mix(in srgb, var(--db-tone) 60%, transparent);
}
[data-panel="device-online-rate"] .db-count {
  text-align: right; font-size: 11px; line-height: 14px;
  font-weight: 600; color: var(--db-tone); white-space: nowrap;
}
[data-panel="device-online-rate"] .db-count b {
  font-size: 13px; font-weight: 700;
}
[data-panel="device-online-rate"] .db-no-motion .db-gauge-progress {
  animation: none;
}
@keyframes db-gauge-draw {
  from { stroke-dashoffset: 1; opacity: 0.5; }
  to { stroke-dashoffset: 0; opacity: 1; }
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

const formatInt = (value) => Number(value).toLocaleString('zh-CN');

/** 数字滚动：从 0 平滑到目标在线率；返回取消函数。 */
function animateRate(node, target, reduceMotion) {
  const finalText = target.toFixed(1);
  if (reduceMotion || typeof requestAnimationFrame !== 'function') {
    node.textContent = finalText;
    return () => {};
  }
  const started = performance.now();
  const duration = 820;
  let frame = 0;
  const tick = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - (1 - progress) ** 3;
    node.textContent = (target * eased).toFixed(1);
    if (progress < 1) frame = requestAnimationFrame(tick);
    else node.textContent = finalText;
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export default {
  title: '设备在线率',
  unit: '全行 ATM · 模拟数据',
  render(el, ctx) {
    if (typeof el.__dbCleanup === 'function') el.__dbCleanup();
    const doc = el.ownerDocument;
    ensureStyle(doc);

    const colors = ctx?.colors ?? {};
    const seriesColor = colors.series?.[0] ?? '#3987e5';
    const goodColor = colors.good ?? '#0ca30c';
    const warnColor = colors.warn ?? '#fab219';
    const badColor = colors.bad ?? '#e66767';

    const status = buildAtmStatus(ATM_TOTAL, ATM_OFFLINE);
    const rows = offlineCounts(ctx.data.seededRandom(ATM_SEED), ctx.data.branches, {
      total: status.offline,
    });
    const top = topOfflineBranches(rows, 3);
    const maxOffline = Math.max(1, ...top.map((row) => row.offline));
    const branchCount = Array.isArray(ctx.data.branches) ? ctx.data.branches.length : rows.length;

    const reduceMotion = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;

    const gaugeArc = ctx.layout.gaugeArc;
    const G = { w: 232, h: 124, cx: 116, cy: 68, r: 53, start: 135, sweep: 270 };
    const rateRatio = Math.min(1, Math.max(0, status.rate / 100));
    const trackPath = gaugeArc(G.cx, G.cy, G.r, 1, G.start, G.sweep);
    const progressPath = gaugeArc(G.cx, G.cy, G.r, rateRatio, G.start, G.sweep);
    const endAngle = ((G.start + G.sweep * rateRatio) * Math.PI) / 180;
    const endX = (G.cx + G.r * Math.cos(endAngle)).toFixed(2);
    const endY = (G.cy + G.r * Math.sin(endAngle)).toFixed(2);
    const rateText = status.rate.toFixed(1);

    // ---- DOM ----
    const root = doc.createElement('div');
    root.className = `db-root${reduceMotion ? ' db-no-motion' : ''}`;
    root.style.setProperty('--db-series', seriesColor);
    root.style.setProperty('--db-good', goodColor);
    root.style.setProperty('--db-warn', warnColor);
    root.style.setProperty('--db-bad', badColor);
    root.setAttribute(
      'aria-label',
      `全行 ATM 在线率 ${rateText}%，${status.reached ? '达标' : '未达标'}，离线 ${status.offline} 台，共 ${status.total} 台`,
    );

    const topEl = doc.createElement('div');
    topEl.className = 'db-top';
    topEl.innerHTML = `
      <div class="db-gauge">
        <svg class="db-gauge-svg" viewBox="0 0 ${G.w} ${G.h}" role="img"
          aria-label="ATM 在线率仪表盘，${rateText}%，${status.reached ? '达标' : '未达标'}">
          <path class="db-gauge-track" d="${trackPath}"/>
          <path class="db-gauge-progress" d="${progressPath}" pathLength="1"/>
          <circle class="db-gauge-dot" cx="${endX}" cy="${endY}" r="3.2"/>
          <text class="db-gauge-scale" x="72" y="120" text-anchor="middle">0%</text>
          <text class="db-gauge-scale" x="160" y="120" text-anchor="middle">100%</text>
        </svg>
        <div class="db-gauge-center">
          <b class="db-rate"><span class="db-rate-num">0.0</span><em>%</em></b>
          <span class="db-gauge-label">ATM 在线率</span>
        </div>
      </div>
      <div class="db-summary">
        <span class="db-status"><i aria-hidden="true">✓</i>${status.reached ? '达标' : '未达标'}</span>
        <div class="db-stat">
          <span class="db-stat-label">全行 ATM</span>
          <span class="db-stat-value">${formatInt(status.total)}<small>台</small></span>
        </div>
        <div class="db-stat is-offline">
          <span class="db-stat-label">离线</span>
          <span class="db-stat-value">${formatInt(status.offline)}<small>台</small></span>
        </div>
        <span class="db-target">目标 <b>≥ ${status.target}%</b></span>
      </div>`;

    const bottom = doc.createElement('div');
    bottom.className = 'db-bottom';
    bottom.innerHTML = `
      <div class="db-list-head">
        <span class="db-list-title">离线最多分行</span>
        <span class="db-list-meta">全行 ${branchCount} 家分行 · 共 ${status.offline} 台</span>
      </div>
      <ul class="db-list" aria-label="离线台数最多的 3 家分行">
        ${top.map((row, index) => {
          const tone = index === 0 ? 'tone-bad' : 'tone-warn';
          const width = Math.max(6, Math.round((row.offline / maxOffline) * 100));
          return `<li class="db-row ${tone}" aria-label="第 ${index + 1} 名，${escapeHtml(row.name)}，离线 ${row.offline} 台">
            <span class="db-rank">${index + 1}</span>
            <span class="db-name">${escapeHtml(row.name)}</span>
            <span class="db-bar"><i style="width:${width}%"></i></span>
            <span class="db-count">离线 <b>${row.offline}</b> 台</span>
          </li>`;
        }).join('')}
      </ul>`;

    root.append(topEl, bottom);
    el.replaceChildren(root);

    const rateNode = root.querySelector('.db-rate-num');
    const cancelRate = animateRate(rateNode, status.rate, reduceMotion);
    el.__dbCleanup = () => {
      cancelRate();
      el.replaceChildren();
    };
  },
};
