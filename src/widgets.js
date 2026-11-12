// 大屏小部件：数字滚动、指标卡、监管仪表盘。
import { svg, tip } from './charts.js';
import { sparkPath, gaugeArc, regulatoryState } from './layout.js';

const ease = (t) => 1 - (1 - t) ** 3;

/** 数字从 0（或当前值）滚动到目标值。decimals 小数位。 */
export function countUp(el, to, { decimals = 0, duration = 1400, from = 0 } = {}) {
  const fmt = (v) => v.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    el.textContent = fmt(from + (to - from) * ease(t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * 指标卡。k: { name, value, decimals, unit, delta, deltaText, good: 'up'|'down', trend: number[], color }
 */
export function kpiCard(k) {
  const el = document.createElement('article');
  el.className = 'kpi';
  const better = k.delta === 0 ? null : (k.delta > 0) === (k.good === 'up');
  const state = better === null ? 'flat' : better ? 'good' : 'bad';
  const arrow = k.delta > 0 ? '▲' : k.delta < 0 ? '▼' : '■';
  el.innerHTML = `
    <h3>${k.name}</h3>
    <p class="kpi-value"><b>0</b><small>${k.unit}</small></p>
    <p class="kpi-delta ${state}"><span aria-hidden="true">${arrow}</span> 同比 ${k.deltaText}</p>`;
  const s = svg('svg', { viewBox: '0 0 120 32', class: 'spark', preserveAspectRatio: 'none' }, el);
  const d = sparkPath(k.trend, 120, 32, 3);
  svg('path', { d: `${d}L117,32L3,32Z`, class: 'spark-area', style: `fill:${k.color}` }, s);
  svg('path', { d, class: 'spark-line', style: `stroke:${k.color}` }, s);
  countUp(el.querySelector('b'), k.value, { decimals: k.decimals ?? 0 });
  return el;
}

const STATE_TEXT = { safe: '✓ 安全', watch: '! 关注', breach: '✕ 突破红线' };

/** 监管指标仪表盘（2×2）。items 见 data.js 的 regulatory。 */
export function gauges(host, items) {
  host.replaceChildren();
  for (const g of items) {
    const state = regulatoryState(g);
    const card = document.createElement('div');
    card.className = `gauge ${state}`;
    const s = svg('svg', { viewBox: '0 0 120 104', class: 'gauge-svg' }, card);
    svg('path', { d: gaugeArc(60, 58, 44, 1), class: 'gauge-track' }, s);
    const val = svg('path', { d: gaugeArc(60, 58, 44, 0), class: 'gauge-value' }, s);
    // 红线刻度
    const a = ((135 + 270 * (g.limit / g.max)) * Math.PI) / 180;
    svg('line', {
      x1: 60 + 36 * Math.cos(a), y1: 58 + 36 * Math.sin(a), x2: 60 + 52 * Math.cos(a), y2: 58 + 52 * Math.sin(a), class: 'gauge-limit',
    }, s);
    const num = svg('text', { x: 60, y: 62, class: 'gauge-num', 'text-anchor': 'middle' }, s);
    svg('text', { x: 60, y: 78, class: 'gauge-unit', 'text-anchor': 'middle' }, s).textContent = g.unit;
    card.insertAdjacentHTML('beforeend', `
      <p class="gauge-name">${g.name}</p>
      <p class="gauge-state">${STATE_TEXT[state]} · 红线 ${g.better === 'high' ? '≥' : '≤'} ${g.limit}${g.unit}</p>`);
    card.addEventListener('pointermove', (e) => tip.show(`<b>${g.name}</b><div>当前<span>${g.value}${g.unit}</span></div><div>监管红线<span>${g.limit}${g.unit}</span></div>`, e.clientX, e.clientY));
    card.addEventListener('pointerleave', tip.hide);
    host.append(card);
    // 动画：弧和数字一起走
    const t0 = performance.now();
    const step = (now) => {
      const t = ease(Math.min(1, (now - t0) / 1400));
      val.setAttribute('d', gaugeArc(60, 58, 44, (g.value / g.max) * t));
      num.textContent = (g.value * t).toFixed(g.value < 10 ? 2 : 1);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
