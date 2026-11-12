// 「存款结构」面板：四类存款占比环形图 + 右侧图例。
// 固定设计画布 460 × 236，整块由 AI 建设区等比缩放。

const NS = 'http://www.w3.org/2000/svg';
const STYLE_ID = 'deposit-mix-style';

/** 四类存款，顺序与 ctx.colors.series 的 0..3 一一对应。 */
export const DEPOSIT_CATEGORIES = ['活期', '定期', '大额存单', '结构性存款'];

/** 各类存款的基准权重：随机扰动后仍保持活期 > 定期 > 大额存单 > 结构性存款的量级。 */
const BASE_WEIGHTS = [0.46, 0.34, 0.22, 0.14];

const RING = { size: 160, cx: 80, cy: 80, rOuter: 70, rInner: 50 };
const GAP_DEG = 1.4;

/**
 * 把任意一组正数归一成百分比（保留 1 位小数，且合计精确为 100.0）。
 * 采用「最大余数法」分配小数位，避免逐项四舍五入后总和不是 100。
 */
export function normalizeShares(values) {
  const safe = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const sum = safe.reduce((acc, v) => acc + v, 0);
  if (!(sum > 0)) return safe.map(() => 0);

  const tenths = safe.map((v) => (v / sum) * 1000);
  const floors = tenths.map(Math.floor);
  let remain = 1000 - floors.reduce((acc, v) => acc + v, 0);
  const order = tenths
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < remain; k += 1) floors[order[k % order.length].i] += 1;
  return floors.map((v) => v / 10);
}

/**
 * 生成四类存款的占比与金额。
 * @param {number} deposits 存款合计（亿元）
 * @param {() => number} random 随机数函数（页面传入 seededRandom(20261112)）
 */
export function buildDepositMix(deposits, random = Math.random) {
  const total = Number.isFinite(deposits) ? deposits : 0;
  const weights = BASE_WEIGHTS.map((w) => w * (0.7 + random() * 0.6));
  const shares = normalizeShares(weights);
  const items = DEPOSIT_CATEGORIES.map((name, i) => ({
    name,
    share: shares[i],
    value: Math.round(((total * shares[i]) / 100) * 10) / 10,
    seriesIndex: i,
  }));
  return { total, items };
}

function pointOn(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  const x = cx + r * Math.cos(a);
  const y = cy + r * Math.sin(a);
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

function donutSlice(cx, cy, rOuter, rInner, startDeg, endDeg) {
  const sweep = endDeg - startDeg;
  const large = sweep > 180 ? 1 : 0;
  const outerStart = pointOn(cx, cy, rOuter, startDeg);
  const outerEnd = pointOn(cx, cy, rOuter, endDeg);
  const innerEnd = pointOn(cx, cy, rInner, endDeg);
  const innerStart = pointOn(cx, cy, rInner, startDeg);
  return (
    `M${outerStart} A${rOuter},${rOuter} 0 ${large} 1 ${outerEnd} ` +
    `L${innerEnd} A${rInner},${rInner} 0 ${large} 0 ${innerStart} Z`
  );
}

/**
 * 环形扇区 path。角度制，0 度指向右侧、顺时针增加；返回空串表示这个扇区不可见。
 * 整圆会拆成两段 180 度弧，避免 SVG 起终点重合画不出来。
 */
export function arcPathFor(cx, cy, rOuter, rInner, startDeg, endDeg) {
  const outer = Math.max(0, rOuter);
  const inner = Math.max(0, Math.min(rInner, outer));
  const sweep = Math.max(0, Math.min(360, endDeg - startDeg));
  if (outer <= 0 || !(sweep > 0)) return '';
  if (sweep >= 360) {
    return [
      donutSlice(cx, cy, outer, inner, startDeg, startDeg + 180),
      donutSlice(cx, cy, outer, inner, startDeg + 180, startDeg + 360),
    ].join(' ');
  }
  return donutSlice(cx, cy, outer, inner, startDeg, startDeg + sweep);
}

function ensureStyle(host) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
[data-panel="deposit-mix"] .dm-root {
  position: relative;
  width: 460px; height: 236px;
  padding: 12px 16px;
  display: flex; align-items: center; gap: 14px;
  overflow: hidden;
  white-space: nowrap;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
[data-panel="deposit-mix"] .dm-ring {
  position: relative;
  flex: 0 0 160px; width: 160px; height: 160px;
}
[data-panel="deposit-mix"] .dm-ring svg { display: block; width: 160px; height: 160px; overflow: visible; }
[data-panel="deposit-mix"] .dm-track {
  fill: none;
  stroke: var(--border);
  stroke-width: 1;
  stroke-dasharray: 2 5;
}
[data-panel="deposit-mix"] .dm-arcs { filter: drop-shadow(0 0 4px rgba(79, 195, 255, 0.18)); }
[data-panel="deposit-mix"] .dm-center {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 1px;
  pointer-events: none;
  line-height: 1.1;
}
[data-panel="deposit-mix"] .dm-center-label {
  font-size: 11px; color: var(--text-muted); letter-spacing: 0.12em;
}
[data-panel="deposit-mix"] .dm-center-value {
  font-size: 22px; font-weight: 700; letter-spacing: 0.01em;
  color: var(--text-primary);
  text-shadow: 0 0 14px rgba(79, 195, 255, 0.28);
}
[data-panel="deposit-mix"] .dm-center-unit { font-size: 11px; color: var(--text-muted); }
[data-panel="deposit-mix"] .dm-legend-wrap {
  flex: 1 1 auto; min-width: 0;
  display: flex; flex-direction: column; justify-content: center; gap: 3px;
}
[data-panel="deposit-mix"] .dm-legend-head,
[data-panel="deposit-mix"] .dm-row {
  display: grid;
  grid-template-columns: 9px 72px minmax(0, 1fr) 46px;
  align-items: center;
  column-gap: 8px;
}
[data-panel="deposit-mix"] .dm-legend-head {
  padding: 0 8px;
  font-size: 11px; color: var(--text-muted); letter-spacing: 0.04em;
}
[data-panel="deposit-mix"] .dm-legend-head span:nth-child(3),
[data-panel="deposit-mix"] .dm-legend-head span:nth-child(4) { text-align: right; }
[data-panel="deposit-mix"] .dm-legend {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column;
}
[data-panel="deposit-mix"] .dm-row {
  height: 34px; padding: 0 8px;
  border-bottom: 1px solid var(--grid);
  animation: dm-row-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  animation-delay: calc(var(--i, 0) * 70ms + 120ms);
}
[data-panel="deposit-mix"] .dm-row:last-child { border-bottom: 0; }
[data-panel="deposit-mix"] .dm-row:hover { background: var(--surface-2); border-radius: 6px; }
[data-panel="deposit-mix"] .dm-dot {
  width: 9px; height: 9px; border-radius: 3px; display: block;
}
[data-panel="deposit-mix"] .dm-name {
  font-size: 13px; color: var(--text-secondary); white-space: nowrap;
}
[data-panel="deposit-mix"] .dm-amount {
  font-size: 12px; color: var(--text-muted); text-align: right; white-space: nowrap;
}
[data-panel="deposit-mix"] .dm-share {
  font-size: 13px; font-weight: 600; color: var(--text-primary); text-align: right; white-space: nowrap;
}
[data-panel="deposit-mix"] .dm-static .dm-row { animation: none; }
@keyframes dm-row-in {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: none; }
}`;
  document.head.append(style);
}

function formatYi(value, ctx) {
  if (ctx?.metrics?.formatYi) return ctx.metrics.formatYi(value);
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default {
  title: '存款结构',
  unit: '亿元 · 模拟数据',
  render(el, ctx) {
    ensureStyle(el);

    const total = ctx?.data?.current?.deposits ?? 0;
    const random = ctx?.data?.seededRandom ? ctx.data.seededRandom(20261112) : Math.random;
    const mix = buildDepositMix(total, random);
    const colors = ctx?.colors?.series ?? [];
    const tip = ctx?.charts?.tip;
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    el.replaceChildren();
    const root = document.createElement('div');
    root.className = `dm-root${reduce ? ' dm-static' : ''}`;
    root.innerHTML = `
      <div class="dm-ring">
        <svg viewBox="0 0 160 160" role="img" aria-label="四类存款占比环形图">
          <circle class="dm-track" cx="80" cy="80" r="76"></circle>
          <g class="dm-arcs"></g>
        </svg>
        <div class="dm-center">
          <span class="dm-center-label">存款合计</span>
          <b class="dm-center-value">${formatYi(total, ctx)}</b>
          <span class="dm-center-unit">亿元</span>
        </div>
      </div>
      <div class="dm-legend-wrap">
        <div class="dm-legend-head"><span></span><span>类别</span><span>金额（亿元）</span><span>占比</span></div>
        <ul class="dm-legend"></ul>
      </div>`;

    const arcGroup = root.querySelector('.dm-arcs');
    const legend = root.querySelector('.dm-legend');
    const amount = (v) => formatYi(v, ctx);
    const shareText = (v) => `${v.toFixed(1)}%`;

    const paths = mix.items.map((item, i) => {
      const color = colors[item.seriesIndex] ?? 'var(--text-muted)';

      const row = document.createElement('li');
      row.className = 'dm-row';
      row.style.setProperty('--i', String(i));
      row.innerHTML = `
        <i class="dm-dot" style="background:${color};box-shadow:0 0 8px ${color}"></i>
        <span class="dm-name">${item.name}</span>
        <span class="dm-amount">${amount(item.value)}</span>
        <span class="dm-share">${shareText(item.share)}</span>`;
      if (tip) {
        row.addEventListener('pointermove', (e) => {
          tip.show(
            `<b>${item.name}</b><div>占比 ${shareText(item.share)}<span>${amount(item.value)} 亿元</span></div>`,
            e.clientX,
            e.clientY,
          );
        });
        row.addEventListener('pointerleave', () => tip.hide());
      }
      legend.append(row);

      const path = document.createElementNS(NS, 'path');
      path.setAttribute('fill', color);
      path.setAttribute('d', '');
      arcGroup.append(path);
      return path;
    });

    const draw = (progress) => {
      let cursor = 0;
      const gap = GAP_DEG * Math.min(1, progress * 2);
      mix.items.forEach((item, i) => {
        const span = item.share * 3.6 * progress;
        const start = -90 + cursor + gap;
        const end = -90 + cursor + span - gap;
        paths[i].setAttribute('d', end > start ? arcPathFor(RING.cx, RING.cy, RING.rOuter, RING.rInner, start, end) : '');
        cursor += span;
      });
    };

    if (reduce) {
      draw(1);
    } else {
      draw(0);
      let startedAt = 0;
      const step = (now) => {
        if (!startedAt) startedAt = now;
        const t = Math.min(1, (now - startedAt) / 950);
        draw(1 - (1 - t) ** 3);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    el.append(root);
  },
};
