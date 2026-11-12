// 「手机银行活跃用户」面板：三张 KPI（日活 / 月活 / 活跃渗透率）+ 近 7 日日活趋势面积图。
// 设计画布固定 460 × 236，页面会把整块画布等比缩放进格子，因此这里不读取窗口尺寸。
// 趋势用固定种子生成，刷新一致；日活末值固定 128.6 万户。

const STYLE_ID = 'mobile-active-users-style';
const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
// 一周形状（相对周一的涨幅，单位：万户）：工作日走高、周五见顶、周末回落。
const WEEK_SHAPE = [0, 0.9, 1.8, 3.2, 8.6, 3.2, 6.1];
const TREND_END = 128.6;

// 月活由日活推算：日活 / 月活 ≈ 26.45%；渗透率 = 月活 / 注册用户基数。
const DAU_MAU_RATIO = 0.2645;
const PREV_DAU_MAU_RATIO = 0.271;
const BASE_USERS = 672; // 万户
const PREV_BASE_USERS = 668; // 万户

const STYLE = `
[data-panel="mobile-active-users"] .mau-root {
  width: 460px; height: 236px; box-sizing: border-box;
  padding: 8px 10px 7px; display: flex; flex-direction: column; gap: 6px;
  overflow: hidden; white-space: nowrap; color: var(--text-primary);
}
[data-panel="mobile-active-users"] .mau-kpis {
  flex: 0 0 78px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px;
}
[data-panel="mobile-active-users"] .mau-kpi {
  position: relative; min-width: 0; overflow: hidden;
  padding: 6px 9px 6px 12px; border-radius: 8px;
  border: 1px solid rgba(79, 163, 255, 0.16);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012));
  display: flex; flex-direction: column; justify-content: center;
}
[data-panel="mobile-active-users"] .mau-kpi::before {
  content: ""; position: absolute; left: 5px; top: 10px; bottom: 10px; width: 2px;
  border-radius: 2px; background: var(--accent); box-shadow: 0 0 8px var(--accent);
}
[data-panel="mobile-active-users"] .mau-kpi-name {
  font-size: 11px; line-height: 14px; color: var(--text-secondary); letter-spacing: 0.04em;
}
[data-panel="mobile-active-users"] .mau-kpi-value {
  display: flex; align-items: baseline; gap: 3px; margin: 1px 0 2px;
  font-size: 21px; line-height: 24px; font-weight: 700;
  font-variant-numeric: tabular-nums; text-shadow: 0 0 12px rgba(79, 195, 255, 0.28);
}
[data-panel="mobile-active-users"] .mau-kpi-value em {
  font-size: 10px; line-height: 1; font-style: normal; font-weight: 500; color: var(--text-muted);
}
[data-panel="mobile-active-users"] .mau-kpi-delta {
  font-size: 11px; line-height: 14px; color: var(--text-muted); font-variant-numeric: tabular-nums;
}
[data-panel="mobile-active-users"] .mau-kpi-delta b { font-weight: 700; }
[data-panel="mobile-active-users"] .mau-kpi-delta.good b { color: var(--good); }
[data-panel="mobile-active-users"] .mau-kpi-delta.bad b { color: var(--bad); }
[data-panel="mobile-active-users"] .mau-kpi-delta.flat b { color: var(--warn); }
[data-panel="mobile-active-users"] .mau-chart { flex: 1 1 auto; min-height: 0; }
[data-panel="mobile-active-users"] .mau-chart-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
  height: 16px; padding: 0 2px; font-size: 11px; line-height: 16px; color: var(--text-muted);
}
[data-panel="mobile-active-users"] .mau-chart-head > * { min-width: 0; overflow: hidden; }
[data-panel="mobile-active-users"] .mau-chart-title { flex: 0 0 auto; color: var(--text-secondary); }
[data-panel="mobile-active-users"] .mau-chart-peak { flex: 0 1 auto; text-align: right; }
[data-panel="mobile-active-users"] .mau-chart-peak b {
  color: var(--text-primary); font-weight: 600; font-variant-numeric: tabular-nums;
}
[data-panel="mobile-active-users"] .mau-svg {
  display: block; width: 440px; height: 121px; flex: 0 0 121px;
}
[data-panel="mobile-active-users"] .mau-grid { stroke: var(--grid); stroke-width: 1; }
[data-panel="mobile-active-users"] .mau-axis { stroke: var(--axis); stroke-width: 1; }
[data-panel="mobile-active-users"] .mau-tick {
  fill: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums;
}
[data-panel="mobile-active-users"] .mau-line {
  fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
[data-panel="mobile-active-users"] .mau-peak-line {
  stroke: var(--accent); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.55;
}
[data-panel="mobile-active-users"] .mau-peak-dot { fill: var(--accent); stroke: var(--surface-1); stroke-width: 2; }
[data-panel="mobile-active-users"] .mau-peak-text {
  fill: var(--text-primary); font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums;
  stroke: var(--surface-1); stroke-width: 3; paint-order: stroke;
}
[data-panel="mobile-active-users"] .mau-last-dot { fill: var(--accent); stroke: var(--surface-1); stroke-width: 2; }
[data-panel="mobile-active-users"] .mau-today {
  fill: var(--text-secondary); font-size: 11px; font-weight: 600;
}
[data-panel="mobile-active-users"] .mau-reveal {
  transform-box: view-box; transform-origin: 0 0;
  animation: mau-grow 1.15s cubic-bezier(.2, .8, .2, 1) both;
}
@keyframes mau-grow {
  from { transform: scaleX(0); opacity: 0.35; }
  to { transform: scaleX(1); opacity: 1; }
}
`;

const round1 = (v) => Math.round(v * 10) / 10;

/** 万户数值格式化：保留 1 位小数、千分位；非法值返回“—”。 */
export function formatWan(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 10) / 10;
  return (rounded === 0 ? 0 : rounded).toLocaleString('zh-CN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** 环比增长率（%），保留 1 位小数；基数为 0 或非法时返回 null。 */
export function growthPct(now, prev) {
  const a = Number(now);
  const b = Number(prev);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return Math.round(((a - b) / b) * 1000) / 10;
}

/**
 * 用给定随机函数生成近 7 日日活趋势（万户），末值固定 128.6。
 * 只消费 6 个随机数；同一个种子得到同一条趋势。
 */
export function buildMobileTrend(rand = Math.random, { end = TREND_END } = {}) {
  const last = round1(Number.isFinite(Number(end)) ? Number(end) : TREND_END);
  const start = round1(last - WEEK_SHAPE[WEEK_SHAPE.length - 1]);
  const values = WEEK_SHAPE.map((offset, i) => {
    if (i === WEEK_SHAPE.length - 1) return last;
    const noise = (rand() * 2 - 1) * 0.7;
    return round1(start + offset + noise);
  });
  return values;
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.append(style);
}

/** 三张 KPI：当前值固定，较上周变化由趋势与用户基数推算。 */
function buildKpis(trend) {
  const dauNow = trend[trend.length - 1];
  const dauPrev = trend[0];
  const mauNow = round1(dauNow / DAU_MAU_RATIO);
  const mauPrev = round1(dauPrev / PREV_DAU_MAU_RATIO);
  const penNow = round1((mauNow / BASE_USERS) * 100);
  const penPrev = round1((mauPrev / PREV_BASE_USERS) * 100);
  return [
    { name: '日活用户', value: formatWan(dauNow), unit: '万户', delta: growthPct(dauNow, dauPrev) },
    { name: '月活用户', value: formatWan(mauNow), unit: '万户', delta: growthPct(mauNow, mauPrev) },
    { name: '活跃渗透率', value: formatWan(penNow), unit: '%', delta: growthPct(penNow, penPrev) },
  ];
}

function deltaMarkup(delta) {
  if (delta === null) return '<span class="mau-kpi-delta flat">较上周 <b>—</b></span>';
  const up = delta > 0;
  const down = delta < 0;
  const cls = up ? 'good' : down ? 'bad' : 'flat';
  const arrow = up ? '▲' : down ? '▼' : '＝';
  return `<span class="mau-kpi-delta ${cls}">较上周 <b>${arrow} ${Math.abs(delta).toFixed(1)}%</b></span>`;
}

function chartMarkup(ctx, trend, color) {
  const svg = ctx.charts.svg;
  const W = 440;
  const H = 121;
  const left = 16;
  const right = 16;
  const top = 22;
  const bottom = 106;
  const span = W - left - right;
  const x = (i) => left + (i / (trend.length - 1)) * span;
  const lo = Math.min(...trend) - 0.6;
  const hi = Math.max(...trend) + 0.6;
  const y = (v) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  const peakIndex = trend.indexOf(Math.max(...trend));
  const peakValue = trend[peakIndex];
  const peakX = x(peakIndex);
  const peakY = y(peakValue);
  const gradId = `mau-area-grad-${++chartMarkup.seq}`;

  const root = svg('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'mau-svg', role: 'img',
    'aria-label': `近 7 日日活趋势，峰值 ${formatWan(peakValue)} 万户，${WEEK_DAYS[peakIndex]}`,
  });

  const defs = svg('defs', {}, root);
  const grad = svg('linearGradient', { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  svg('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.38 }, grad);
  svg('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }, grad);

  for (const gy of [top, (top + bottom) / 2, bottom]) {
    svg('line', { x1: left, x2: W - right, y1: gy, y2: gy, class: 'mau-grid' }, root);
  }
  svg('line', { x1: left, x2: W - right, y1: bottom, y2: bottom, class: 'mau-axis' }, root);

  const linePath = trend
    .map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join('');
  const areaPath = `${linePath}L${x(trend.length - 1).toFixed(1)},${bottom}L${x(0).toFixed(1)},${bottom}Z`;
  const reveal = svg('g', { class: 'mau-reveal' }, root);
  svg('path', { d: areaPath, fill: `url(#${gradId})` }, reveal);
  svg('path', { d: linePath, class: 'mau-line', style: `stroke:${color}` }, reveal);

  svg('line', { x1: peakX, x2: peakX, y1: peakY + 7, y2: bottom, class: 'mau-peak-line' }, root);
  svg('circle', { cx: peakX, cy: peakY, r: 4, class: 'mau-peak-dot' }, root);
  svg('text', { x: peakX, y: peakY - 8, 'text-anchor': 'middle', class: 'mau-peak-text' }, root)
    .textContent = formatWan(peakValue);
  svg('circle', {
    cx: x(trend.length - 1), cy: y(trend[trend.length - 1]), r: 2.8, class: 'mau-last-dot',
  }, root);

  trend.forEach((v, i) => {
    const isToday = i === trend.length - 1;
    const tick = svg('text', {
      x: x(i), y: 118, 'text-anchor': 'middle', class: `mau-tick${isToday ? ' mau-today' : ''}`,
    }, root);
    tick.textContent = WEEK_DAYS[i].slice(1);
  });

  return { node: root, peakIndex, peakValue };
}

chartMarkup.seq = 0;

export default {
  title: '手机银行活跃用户',
  unit: '近 7 日 · 模拟数据',
  render(el, ctx) {
    if (typeof el.__mauCleanup === 'function') el.__mauCleanup();
    ensureStyle();

    const reduce = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const color = ctx?.colors?.series?.[0] ?? '#3987e5';
    const trend = buildMobileTrend(ctx.data.seededRandom(20261112));
    const kpis = buildKpis(trend);

    el.replaceChildren();
    const root = document.createElement('div');
    root.className = 'mau-root';

    const kpiRow = document.createElement('div');
    kpiRow.className = 'mau-kpis';
    for (const kpi of kpis) {
      const cell = document.createElement('div');
      cell.className = 'mau-kpi';
      cell.innerHTML = `
        <span class="mau-kpi-name">${kpi.name}</span>
        <span class="mau-kpi-value">${kpi.value}<em>${kpi.unit}</em></span>
        ${deltaMarkup(kpi.delta)}`;
      kpiRow.append(cell);
    }

    const chart = document.createElement('div');
    chart.className = 'mau-chart';
    const { node, peakIndex, peakValue } = chartMarkup(ctx, trend, color);
    if (reduce) node.querySelector('.mau-reveal')?.removeAttribute('class');
    const head = document.createElement('div');
    head.className = 'mau-chart-head';
    head.innerHTML = `
      <span class="mau-chart-title">近 7 日日活趋势</span>
      <span class="mau-chart-peak">峰值 <b>${formatWan(peakValue)}</b> 万户 · ${WEEK_DAYS[peakIndex]}</span>`;
    chart.append(head, node);

    root.append(kpiRow, chart);
    el.append(root);

    el.__mauCleanup = () => { el.replaceChildren(); };
  },
};
