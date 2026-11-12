// B 区「存款结构」环形图。
// 四类存款占比 + 中心存款合计 + 图例百分比；环形加载时按扇形展开。
// 纯计算函数与渲染分离，测试只 import 纯函数。

/** 四类存款及其大致权重（仅用于生成模拟数据）。 */
export const DEPOSIT_CATEGORIES = [
  { key: 'demand', name: '活期', weight: 0.36 },
  { key: 'time', name: '定期', weight: 0.41 },
  { key: 'cd', name: '大额存单', weight: 0.15 },
  { key: 'structured', name: '结构性存款', weight: 0.08 },
];

/** 按最大余数法把整数份额分给各项，保证合计恰好等于 totalTenths。 */
export function allocateTenths(weights, totalTenths) {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!sum || totalTenths <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (totalTenths * w) / sum);
  const out = exact.map(Math.floor);
  let left = totalTenths - out.reduce((s, n) => s + n, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length) {
    out[order[k].i] += 1;
    left -= 1;
  }
  return out;
}

/** 各项占比（%），保留 1 位小数且合计恰好 100.0。 */
export function percentages(values) {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return values.map(() => 0);
  // 放大到 0.1% 的整数单位，再用最大余数法补齐。
  return allocateTenths(values, 1000).map((t) => t / 10);
}

/** 生成固定种子下可复现的四类存款金额（亿元），合计等于传入总额。 */
export function buildDepositMix(rand = Math.random, total = 0) {
  const weights = DEPOSIT_CATEGORIES.map((c) => c.weight * (1 + (rand() - 0.5) * 0.12));
  const totalTenths = Math.max(0, Math.round(total * 10));
  const tenths = allocateTenths(weights, totalTenths);
  return {
    total: totalTenths / 10,
    items: DEPOSIT_CATEGORIES.map((c, i) => ({
      key: c.key,
      name: c.name,
      value: tenths[i] / 10,
    })),
  };
}

/** 计算每个扇形的起始角与扫过角（度，0° 在正上方、顺时针）。 */
export function donutSlices(items, gapDeg = 2) {
  const total = items.reduce((s, it) => s + it.value, 0);
  if (total <= 0) return items.map(() => ({ startDeg: 0, sweepDeg: 0 }));
  let cursor = 0;
  return items.map((it) => {
    const extent = (it.value / total) * 360;
    const slice = { startDeg: cursor + gapDeg / 2, sweepDeg: Math.max(0, extent - gapDeg) };
    cursor += extent;
    return slice;
  });
}

/**
 * 圆环扇形 path。startDeg/sweepDeg 以顶点为 0°、顺时针为正。
 * 返回可直接写入 SVG path 的 d；扫过角为 0 时返回空串。
 */
export function donutArc(cx, cy, rOuter, rInner, startDeg, sweepDeg) {
  if (!(sweepDeg > 0.001)) return '';
  const sweep = Math.min(360, sweepDeg);
  const pt = (r, deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  };
  const end = startDeg + sweep;
  const o0 = pt(rOuter, startDeg);
  const o1 = pt(rOuter, end);
  const i1 = pt(rInner, end);
  const i0 = pt(rInner, startDeg);

  if (sweep >= 359.999) {
    // 整圆：拆成两段 180° 圆弧，避免起终点重合导致不渲染。
    const mid = startDeg + 180;
    const om = pt(rOuter, mid);
    const im = pt(rInner, mid);
    return `M${o0} A${rOuter},${rOuter} 0 0 1 ${om} A${rOuter},${rOuter} 0 0 1 ${o1} `
      + `L${i1} A${rInner},${rInner} 0 0 0 ${im} A${rInner},${rInner} 0 0 0 ${i0} Z`;
  }
  const large = sweep > 180 ? 1 : 0;
  return `M${o0} A${rOuter},${rOuter} 0 ${large} 1 ${o1} L${i1} A${rInner},${rInner} 0 ${large} 0 ${i0} Z`;
}

const styleText = `
[data-slot="b"] .deposit-wrap {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 14px 22px; width: 100%; min-width: 0; padding: 2px 0 4px;
}
[data-slot="b"] .deposit-donut {
  position: relative; flex: 0 0 220px; width: 220px; max-width: 100%; aspect-ratio: 1;
}
[data-slot="b"] .deposit-svg { display: block; width: 100%; height: 100%; overflow: visible; }
[data-slot="b"] .deposit-track { fill: none; stroke: rgba(255, 255, 255, 0.06); stroke-width: 36; }
[data-slot="b"] .deposit-seg {
  cursor: default; transition: opacity 0.18s ease, filter 0.18s ease;
  filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.45));
}
[data-slot="b"] .deposit-wrap[data-active] .deposit-seg:not(.is-active) { opacity: 0.34; }
[data-slot="b"] .deposit-seg.is-active { filter: drop-shadow(0 0 7px currentColor); }
[data-slot="b"] .deposit-center {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; pointer-events: none; gap: 1px;
}
[data-slot="b"] .deposit-center-label {
  font-size: 12px; color: var(--text-muted); letter-spacing: 0.16em;
}
[data-slot="b"] .deposit-center-value {
  font-size: 27px; font-weight: 700; line-height: 1.1; color: var(--text-primary);
  font-variant-numeric: tabular-nums; text-shadow: 0 0 16px rgba(79, 195, 255, 0.35);
}
[data-slot="b"] .deposit-center-unit { font-size: 11px; color: var(--text-muted); }
[data-slot="b"] .deposit-legend {
  list-style: none; margin: 0; padding: 0; flex: 1 1 176px; min-width: 0;
  display: flex; flex-direction: column; gap: 5px;
}
[data-slot="b"] .deposit-legend li {
  padding: 5px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.025);
  border: 1px solid transparent; cursor: default;
  transition: opacity 0.18s ease, border-color 0.18s ease, background 0.18s ease;
  animation: b-deposit-in 0.45s ease both; animation-delay: calc(180ms + var(--i) * 70ms);
}
[data-slot="b"] .deposit-legend li.is-active {
  border-color: var(--border-strong); background: rgba(79, 195, 255, 0.08);
}
[data-slot="b"] .deposit-wrap[data-active] .deposit-legend li:not(.is-active) { opacity: 0.42; }
[data-slot="b"] .deposit-legend .lg-top {
  display: flex; align-items: center; gap: 7px; font-size: 12px;
}
[data-slot="b"] .deposit-legend i {
  width: 9px; height: 9px; border-radius: 3px; flex: none; display: inline-block;
}
[data-slot="b"] .deposit-legend .lg-name {
  color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
[data-slot="b"] .deposit-legend .lg-pct {
  margin-left: auto; padding-left: 8px; color: var(--text-primary);
  font-weight: 600; font-variant-numeric: tabular-nums;
}
[data-slot="b"] .deposit-legend .lg-amount {
  margin: 2px 0 0 16px; font-size: 11px; color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
@keyframes b-deposit-in {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: none; }
}
@media (max-width: 520px) {
  [data-slot="b"] .deposit-donut { flex-basis: 200px; width: 200px; }
  [data-slot="b"] .deposit-center-value { font-size: 24px; }
  [data-slot="b"] .deposit-legend { flex-basis: 100%; }
}
`;

const fmtYi = (v) => v.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent?.append(el);
  return el;
}

function animateNumber(el, to, { duration = 900, reduced = false } = {}) {
  if (reduced) {
    el.textContent = fmtYi(to);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = fmtYi(to * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export default {
  title: '存款结构',
  unit: '亿元 · 模拟数据',
  render(el, ctx) {
    const { total, items } = buildDepositMix(ctx.data.seededRandom(20261112), ctx.data.current.deposits);
    const pcts = percentages(items.map((it) => it.value));
    const colors = items.map((_, i) => ctx.colors.series[i]);
    const slices = donutSlices(items);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const totalPct = pcts.reduce((s, p) => s + p, 0);

    const style = document.createElement('style');
    style.textContent = styleText;

    const wrap = document.createElement('div');
    wrap.className = 'deposit-wrap';
    wrap.innerHTML = `
      <div class="deposit-donut">
        <svg class="deposit-svg" viewBox="0 0 240 240" role="img"
          aria-label="存款结构环形图：${items.map((it, i) => `${it.name} ${pcts[i]}%`).join('，')}；存款合计 ${fmtYi(total)} 亿元">
          <circle class="deposit-track" cx="120" cy="120" r="82"></circle>
          <g class="deposit-segments"></g>
        </svg>
        <div class="deposit-center">
          <span class="deposit-center-label">存款合计</span>
          <strong class="deposit-center-value">0.0</strong>
          <span class="deposit-center-unit">亿元</span>
        </div>
      </div>
      <ul class="deposit-legend" aria-label="存款结构图例">
        ${items.map((it, i) => `
          <li data-key="${it.key}" style="--i:${i}">
            <div class="lg-top">
              <i style="background:${colors[i]}" aria-hidden="true"></i>
              <span class="lg-name">${it.name}</span>
              <b class="lg-pct">${pcts[i].toFixed(1)}%</b>
            </div>
            <div class="lg-amount">${fmtYi(it.value)} 亿元</div>
          </li>`).join('')}
      </ul>`;
    el.replaceChildren(style, wrap);

    const group = wrap.querySelector('.deposit-segments');
    const segments = slices.map((slice, i) => svgEl('path', {
      d: '', fill: colors[i], class: 'deposit-seg', 'data-key': items[i].key,
    }, group));
    const segByKey = new Map(items.map((it, i) => [it.key, { seg: segments[i], slice: slices[i], item: it, pct: pcts[i], color: colors[i] }]));
    const valueEl = wrap.querySelector('.deposit-center-value');

    const draw = (progress) => {
      slices.forEach((slice, i) => {
        const sweep = slice.sweepDeg * progress;
        const d = donutArc(120, 120, 100, 64, slice.startDeg, sweep);
        if (segments[i].getAttribute('d') !== d) segments[i].setAttribute('d', d);
      });
    };

    // 悬浮联动：扇形高亮时图例同步高亮，并显示数值提示。
    let activeKey = '';
    const activate = (key) => {
      if (activeKey === key) return;
      activeKey = key;
      wrap.dataset.active = key;
      for (const [k, v] of segByKey) {
        v.seg.classList.toggle('is-active', k === key);
      }
      for (const li of wrap.querySelectorAll('.deposit-legend li')) {
        li.classList.toggle('is-active', li.dataset.key === key);
      }
    };
    const clear = () => {
      activeKey = '';
      delete wrap.dataset.active;
      for (const v of segByKey.values()) v.seg.classList.remove('is-active');
      for (const li of wrap.querySelectorAll('.deposit-legend li')) li.classList.remove('is-active');
      ctx.charts.tip.hide();
    };
    for (const [key, v] of segByKey) {
      const tipText = `<b>${v.item.name}</b><div>占比<span>${v.pct.toFixed(1)}%</span></div><div>余额<span>${fmtYi(v.item.value)} 亿元</span></div>`;
      v.seg.addEventListener('pointerenter', () => activate(key));
      v.seg.addEventListener('pointermove', (e) => {
        activate(key);
        ctx.charts.tip.show(tipText, e.clientX, e.clientY);
      });
      v.seg.addEventListener('pointerleave', clear);
      const li = wrap.querySelector(`.deposit-legend li[data-key="${key}"]`);
      li.addEventListener('pointerenter', () => activate(key));
      li.addEventListener('pointermove', (e) => {
        activate(key);
        ctx.charts.tip.show(tipText, e.clientX, e.clientY);
      });
      li.addEventListener('pointerleave', clear);
    }

    if (reduced) {
      draw(1);
      valueEl.textContent = fmtYi(total);
    } else {
      const t0 = performance.now();
      const duration = 1000;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const eased = 1 - (1 - t) ** 3;
        draw(eased);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      animateNumber(valueEl, total);
    }

    // 便于自检：图例百分比合计应为 100.0。
    wrap.dataset.pctTotal = totalPct.toFixed(1);
    wrap.dataset.total = total.toFixed(1);
  },
};
