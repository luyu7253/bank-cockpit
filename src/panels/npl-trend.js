// 「不良贷款率趋势」：近 12 个月不良率折线 + 监管红线标注。
// 纯函数 buildNplSeries / latestPoint / thresholdStatus 在上半部分，测试只 import 它们，不依赖浏览器 DOM。

/** 固定随机种子：每次打开面板，12 个月的曲线都一致。 */
export const NPL_SEED = 20261112;

/** 监管红线（%）。演示口径，仅作模拟。 */
export const NPL_LIMIT = 1.5;

/** 12 个点（近 12 个月）。 */
export const NPL_MONTHS = 12;

/** 模拟数据取值范围（%）。 */
export const NPL_MIN = 1.18;
export const NPL_MAX = 1.45;

/** 距红线不足 0.05 个百分点时进入「关注」状态。 */
export const WATCH_BAND = 0.05;

/** 状态元数据：图标 + 中文文字，状态不只靠颜色表达。 */
export const STATUS_META = {
  safe: { label: '安全', icon: '●' },
  watch: { label: '关注', icon: '▲' },
  breach: { label: '超红线', icon: '⚠' },
  unknown: { label: '—', icon: '·' },
};

const round2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * 生成近 12 个月不良率（%，两位小数）。
 * 最后一点严格等于当前值 current.nplRatio，前一点比它高 0.02 个百分点，
 * 因此「较上月 -0.02 个百分点」与曲线完全自洽；其余点从 1.44% 缓慢回落到 1.33% 一带，
 * 全部落在 [1.18, 1.45] 区间内。
 * @param {() => number} random 随机函数（页面传 ctx.data.seededRandom(NPL_SEED)）
 * @param {number} current 当前不良率（%）
 * @returns {number[]} 长度 12 的数组，单位 %
 */
export function buildNplSeries(random = Math.random, current = 1.31) {
  const rand = typeof random === 'function' ? random : Math.random;
  const last = Number.isFinite(Number(current)) ? round2(Number(current)) : 1.31;
  const prev = round2(last + 0.02);
  const lead = 10; // 生成前 10 个月，最后两点固定为 prev / last
  const start = NPL_MAX - 0.01; // 1.44
  const values = [];
  for (let i = 0; i < lead; i += 1) {
    // 基准逐月回落，再叠加 ±0.015 的小幅波动。
    const trend = start - (i / (lead - 1)) * (start - prev - 0.01);
    const noise = (rand() * 2 - 1) * 0.015;
    values.push(clamp(round2(trend + noise), NPL_MIN, NPL_MAX));
  }
  values.push(prev, last);
  return values;
}

/**
 * 最新一点及其环比。
 * @param {number[]} series
 * @returns {{index:number,value:number,prev:number|null,delta:number|null}|null}
 */
export function latestPoint(series = []) {
  if (!Array.isArray(series) || series.length === 0) return null;
  const index = series.length - 1;
  const value = series[index];
  const prev = series.length > 1 ? series[index - 1] : null;
  return { index, value, prev, delta: prev === null ? null : round2(value - prev) };
}

/**
 * 相对监管红线的状态：breach 已越线 / watch 距红线不足 WATCH_BAND 个百分点 / safe 安全。
 * @param {number} value 当前值（%）
 * @param {number} limit 监管红线（%）
 * @returns {'safe'|'watch'|'breach'|'unknown'}
 */
export function thresholdStatus(value, limit = NPL_LIMIT) {
  const v = Number(value);
  const l = Number(limit);
  if (!Number.isFinite(v) || !Number.isFinite(l)) return 'unknown';
  if (v >= l) return 'breach';
  return l - v < WATCH_BAND ? 'watch' : 'safe';
}

const STYLE_ID = 'npl-trend-style';

const CSS = `
[data-panel="npl-trend"] {
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
[data-panel="npl-trend"] .nt-root {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 7px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
  white-space: nowrap;
}
[data-panel="npl-trend"] .nt-top {
  flex: none;
  height: 50px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
}
[data-panel="npl-trend"] .nt-main {
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 1px;
}
[data-panel="npl-trend"] .nt-caption {
  font-size: 11px;
  line-height: 13px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
[data-panel="npl-trend"] .nt-value {
  font-size: 30px;
  line-height: 30px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--nt-series);
  text-shadow: 0 0 14px color-mix(in srgb, var(--nt-series) 45%, transparent);
}
[data-panel="npl-trend"] .nt-value small {
  margin-left: 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-shadow: none;
}
[data-panel="npl-trend"] .nt-side {
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
  gap: 3px;
}
[data-panel="npl-trend"] .nt-delta {
  font-size: 12px;
  line-height: 14px;
  font-weight: 600;
  white-space: nowrap;
}
[data-panel="npl-trend"] .nt-delta i {
  font-style: normal;
  font-weight: 400;
  color: var(--text-muted);
  margin-right: 4px;
}
[data-panel="npl-trend"] .nt-delta.good { color: var(--nt-good); }
[data-panel="npl-trend"] .nt-delta.warn { color: var(--nt-warn); }
[data-panel="npl-trend"] .nt-delta.bad { color: var(--nt-bad); }
[data-panel="npl-trend"] .nt-delta.flat { color: var(--text-muted); }
[data-panel="npl-trend"] .nt-state {
  font-size: 11px;
  line-height: 13px;
  font-weight: 500;
  white-space: nowrap;
}
[data-panel="npl-trend"] .nt-state i {
  font-style: normal;
  margin-right: 3px;
}
[data-panel="npl-trend"] .nt-state.good { color: var(--nt-good); }
[data-panel="npl-trend"] .nt-state.warn { color: var(--nt-warn); }
[data-panel="npl-trend"] .nt-state.bad { color: var(--nt-bad); }
[data-panel="npl-trend"] .nt-state.unknown { color: var(--text-muted); }
[data-panel="npl-trend"] .nt-chart {
  position: relative;
  flex: 1;
  min-height: 0;
}
[data-panel="npl-trend"] .nt-svg {
  display: block;
  width: 100%;
  height: 100%;
}
[data-panel="npl-trend"] .nt-grid-line {
  stroke: rgba(79, 163, 255, 0.1);
  stroke-width: 1;
}
[data-panel="npl-trend"] .nt-axis-label,
[data-panel="npl-trend"] .nt-month-label {
  fill: var(--text-muted);
  font-size: 10px;
}
[data-panel="npl-trend"] .nt-unit {
  fill: var(--text-muted);
  font-size: 9px;
}
[data-panel="npl-trend"] .nt-threshold {
  stroke: var(--nt-bad);
  stroke-width: 1.3;
  stroke-dasharray: 5 4;
  opacity: 0.9;
}
[data-panel="npl-trend"] .nt-threshold-label {
  fill: var(--nt-bad);
  font-size: 10.5px;
  font-weight: 600;
}
[data-panel="npl-trend"] .nt-area {
  animation: nt-fade 0.9s ease-out both;
}
[data-panel="npl-trend"] .nt-line {
  fill: none;
  stroke: var(--nt-series);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
  filter: drop-shadow(0 0 5px color-mix(in srgb, var(--nt-series) 65%, transparent));
  animation: nt-draw 1.15s cubic-bezier(0.25, 0.8, 0.25, 1) both;
}
[data-panel="npl-trend"] .nt-dot {
  fill: var(--nt-series);
  stroke: var(--surface-1);
  stroke-width: 2;
}
[data-panel="npl-trend"] .nt-halo {
  fill: var(--nt-series);
  opacity: 0.16;
}
[data-panel="npl-trend"] .nt-cross {
  stroke: var(--axis);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
[data-panel="npl-trend"] .nt-root.nt-no-motion .nt-line,
[data-panel="npl-trend"] .nt-root.nt-no-motion .nt-area {
  animation: none;
}
@keyframes nt-draw {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}
@keyframes nt-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

function injectStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.append(style);
}

/** 月度标签：2026-10 → 26.10。 */
function shortMonth(month) {
  return typeof month === 'string' && month.length >= 7 ? `${month.slice(2, 4)}.${month.slice(5, 7)}` : '';
}

let gradSeq = 0;

export default {
  title: '不良贷款率趋势',
  unit: '近 12 个月 · 模拟数据',
  render(el, ctx) {
    const doc = el.ownerDocument;
    const colors = ctx.colors ?? {};
    const seriesColor = colors.series?.[0] ?? 'var(--series-1)';
    const goodColor = colors.good ?? 'var(--good)';
    const warnColor = colors.warn ?? 'var(--warn)';
    const badColor = colors.bad ?? 'var(--bad)';
    injectStyle(doc);

    const current = ctx.data?.current?.nplRatio;
    const series = buildNplSeries(ctx.data.seededRandom(NPL_SEED), current);
    const latest = latestPoint(series);
    const status = thresholdStatus(latest.value, NPL_LIMIT);
    const meta = STATUS_META[status];
    const margin = round2(NPL_LIMIT - latest.value);

    // ---- 顶部：当前值 + 环比 + 红线状态 ----
    let deltaClass = 'flat';
    let deltaArrow = '■';
    let deltaText = '较上月 持平';
    if (latest.delta !== null && latest.delta !== 0) {
      const down = latest.delta < 0;
      deltaClass = down ? 'good' : 'warn'; // 不良率下降是好事；上升用警告色，且都配箭头文字
      deltaArrow = down ? '▼' : '▲';
      deltaText = `较上月 ${deltaArrow} ${Math.abs(latest.delta).toFixed(2)} 个百分点`;
    }
    const stateText = status === 'breach'
      ? `${meta.icon} ${meta.label} ${Math.abs(margin).toFixed(2)} 个百分点`
      : `${meta.icon} ${meta.label} · 距红线 ${Math.abs(margin).toFixed(2)} 个百分点`;

    // ---- 折线图几何：固定 436×168 设计尺寸，不读窗口 ----
    const W = 436;
    const H = 168;
    const PAD = { t: 12, r: 10, b: 24, l: 34 };
    const plotBottom = H - PAD.b;
    const values = series;
    const lo = Math.min(...values, NPL_LIMIT);
    const hi = Math.max(...values, NPL_LIMIT);
    const yMin = Math.floor((lo - 0.03) * 20) / 20;
    const yMax = Math.ceil((hi + 0.03) * 20) / 20;
    const x = (i) => PAD.l + (i / (values.length - 1)) * (W - PAD.l - PAD.r);
    const y = (v) => plotBottom - ((v - yMin) / (yMax - yMin)) * (plotBottom - PAD.t);
    const yText = (v) => (y(v) + 3.2).toFixed(1);
    const tickValues = [];
    for (let v = Math.ceil(yMin * 10) / 10; v <= yMax + 1e-9; v += 0.1) tickValues.push(round2(v));

    const grid = tickValues.map((v) => `<line class="nt-grid-line" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`).join('');
    const ticks = tickValues
      .map((v) => `<text class="nt-axis-label" x="${PAD.l - 8}" y="${yText(v)}" text-anchor="end">${v.toFixed(2)}</text>`)
      .join('');

    const rawMonths = (ctx.data.monthly ?? []).slice(-values.length).map((m) => m.month);
    const months = values.map((_, i) => rawMonths[i] ?? '');
    const monthLabels = months
      .map((m, i) => {
        if (i % 2 !== 1) return ''; // 隔月显示，避免 12 个标签挤在一起
        const text = shortMonth(m);
        if (!text) return '';
        const anchor = i === values.length - 1 ? 'end' : 'middle';
        return `<text class="nt-month-label" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${anchor}">${text}</text>`;
      })
      .join('');

    const linePath = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const areaPath = `${linePath}L${x(values.length - 1).toFixed(1)},${plotBottom}L${x(0).toFixed(1)},${plotBottom}Z`;
    const gradId = `nt-grad-${(gradSeq += 1)}`;
    const thresholdY = y(NPL_LIMIT);
    const lastX = x(values.length - 1);
    const lastY = y(latest.value);

    const chart = doc.createElement('div');
    chart.className = 'nt-chart';
    chart.innerHTML = `<svg class="nt-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="近 12 个月不良贷款率折线，当前 ${latest.value.toFixed(2)}%，监管红线 ${NPL_LIMIT.toFixed(1)}%">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${seriesColor}" stop-opacity="0.34"/>
          <stop offset="100%" stop-color="${seriesColor}" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      ${grid}
      <path class="nt-area" d="${areaPath}" fill="url(#${gradId})"/>
      <line class="nt-threshold" x1="${PAD.l}" x2="${W - PAD.r}" y1="${thresholdY.toFixed(1)}" y2="${thresholdY.toFixed(1)}"/>
      <text class="nt-threshold-label" x="${W - PAD.r}" y="${(thresholdY - 6).toFixed(1)}" text-anchor="end">监管红线 1.5%</text>
      <path class="nt-line" d="${linePath}" pathLength="1"/>
      <line class="nt-cross" x1="0" x2="0" y1="${PAD.t}" y2="${plotBottom}" visibility="hidden"/>
      <circle class="nt-halo" cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="7"/>
      <circle class="nt-dot" cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3.6"/>
      <circle class="nt-dot nt-hover-dot" cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3.6" visibility="hidden"/>
      <rect class="nt-hit" x="${PAD.l}" y="${PAD.t}" width="${W - PAD.l - PAD.r}" height="${plotBottom - PAD.t}" fill="transparent"/>
      <text class="nt-unit" x="2" y="11">单位 %</text>
      ${ticks}
      ${monthLabels}
    </svg>`;

    const root = doc.createElement('div');
    root.className = 'nt-root';
    root.style.setProperty('--nt-series', seriesColor);
    root.style.setProperty('--nt-good', goodColor);
    root.style.setProperty('--nt-warn', warnColor);
    root.style.setProperty('--nt-bad', badColor);
    const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) root.classList.add('nt-no-motion');

    const top = doc.createElement('div');
    top.className = 'nt-top';
    top.innerHTML = `
      <div class="nt-main">
        <span class="nt-caption">当前不良贷款率</span>
        <b class="nt-value">${latest.value.toFixed(2)}<small>%</small></b>
      </div>
      <div class="nt-side">
        <span class="nt-delta ${deltaClass}"><i>较上月</i>${deltaText.replace('较上月 ', '')}</span>
        <span class="nt-state ${status}"><i aria-hidden="true">${meta.icon}</i>${stateText.replace(meta.icon + ' ', '')}</span>
      </div>`;
    root.append(top, chart);
    el.replaceChildren(root);

    // 悬停查看逐月数值；坐标按固定 viewBox 换算，画布缩放后仍然准确。
    if (ctx.charts?.tip) {
      const svgEl = chart.querySelector('.nt-svg');
      const cross = chart.querySelector('.nt-cross');
      const hoverDot = chart.querySelector('.nt-hover-dot');
      const hit = chart.querySelector('.nt-hit');
      hit?.addEventListener('pointermove', (e) => {
        const box = svgEl.getBoundingClientRect();
        if (!box.width) return;
        const px = ((e.clientX - box.left) / box.width) * W;
        const i = Math.max(0, Math.min(values.length - 1, Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (values.length - 1))));
        const cx = x(i).toFixed(1);
        const cy = y(values[i]).toFixed(1);
        cross.setAttribute('x1', cx);
        cross.setAttribute('x2', cx);
        cross.setAttribute('visibility', 'visible');
        hoverDot.setAttribute('cx', cx);
        hoverDot.setAttribute('cy', cy);
        hoverDot.setAttribute('visibility', 'visible');
        ctx.charts.tip.show(
          `<b>${months[i] || '近 12 个月'}</b><div><i style="background:${seriesColor}"></i>不良率<span>${values[i].toFixed(2)}%</span></div>`,
          e.clientX,
          e.clientY,
        );
      });
      hit?.addEventListener('pointerleave', () => {
        cross.setAttribute('visibility', 'hidden');
        hoverDot.setAttribute('visibility', 'hidden');
        ctx.charts.tip.hide();
      });
    }
  },
};
