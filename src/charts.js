// 图表组件：原生 SVG / HTML，无第三方依赖。
// 颜色一律取 CSS 变量（--series-1 … --series-5），见 styles.css。

const NS = 'http://www.w3.org/2000/svg';

/** 共享悬浮提示框。 */
export const tip = (() => {
  const el = document.createElement('div');
  el.className = 'tooltip';
  el.hidden = true;
  document.body.append(el);
  return {
    show(html, x, y) {
      el.innerHTML = html;
      el.hidden = false;
      const r = el.getBoundingClientRect();
      const left = Math.min(x + 14, window.innerWidth - r.width - 8);
      const top = Math.max(8, y - r.height - 12);
      el.style.transform = `translate(${left}px, ${top}px)`;
    },
    hide() { el.hidden = true; },
  };
})();

export function svg(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent?.append(el);
  return el;
}

function niceTicks(min, max, count = 4) {
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(v);
  return ticks;
}

let gradId = 0;

/**
 * 多序列折线图（同一单位、同一纵轴），可选面积渐变。
 * series: [{ key, name, color }]；rows: [{ month, [key]: number }]
 */
export function lineChart(host, { rows, series, unit, format, area = false, height = 240 }) {
  host.replaceChildren();
  const W = 640, H = height, m = { t: 12, r: 16, b: 26, l: 50 };
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' }, host);
  const defs = svg('defs', {}, root);
  const values = rows.flatMap((r) => series.map((s) => r[s.key]));
  const ticks = niceTicks(Math.min(...values) * 0.97, Math.max(...values) * 1.01);
  const y0 = ticks[0], y1 = ticks.at(-1);
  const x = (i) => m.l + (i / (rows.length - 1)) * (W - m.l - m.r);
  const y = (v) => H - m.b - ((v - y0) / (y1 - y0)) * (H - m.t - m.b);

  for (const t of ticks) {
    svg('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'grid' }, root);
    svg('text', { x: m.l - 8, y: y(t) + 4, class: 'tick', 'text-anchor': 'end' }, root).textContent = t.toLocaleString('zh-CN');
  }
  rows.forEach((r, i) => {
    if (i % 4 !== 0 && i !== rows.length - 1) return;
    svg('text', { x: x(i), y: H - 6, class: 'tick', 'text-anchor': 'middle' }, root).textContent = r.month.slice(2).replace('-', '.');
  });

  for (const s of series) {
    const d = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[s.key]).toFixed(1)}`).join('');
    if (area) {
      const id = `g${++gradId}`;
      const g = svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      svg('stop', { offset: '0%', 'stop-color': s.color, 'stop-opacity': 0.32 }, g);
      svg('stop', { offset: '100%', 'stop-color': s.color, 'stop-opacity': 0 }, g);
      svg('path', { d: `${d}L${x(rows.length - 1)},${H - m.b}L${x(0)},${H - m.b}Z`, fill: `url(#${id})` }, root);
    }
    svg('path', { d, class: 'line glow', style: `stroke:${s.color}` }, root);
    const last = rows.at(-1)[s.key];
    svg('circle', { cx: x(rows.length - 1), cy: y(last), r: 4, class: 'dot', style: `fill:${s.color}` }, root);
  }

  const cross = svg('line', { y1: m.t, y2: H - m.b, class: 'crosshair', visibility: 'hidden' }, root);
  const hit = svg('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, root);
  hit.addEventListener('pointermove', (e) => {
    const box = root.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.max(0, Math.min(rows.length - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (rows.length - 1))));
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
    cross.setAttribute('visibility', 'visible');
    const r = rows[i];
    tip.show(
      `<b>${r.month}</b>` + series.map((s) => `<div><i style="background:${s.color}"></i>${s.name}<span>${format(r[s.key])} ${unit}</span></div>`).join(''),
      e.clientX, e.clientY,
    );
  });
  hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); tip.hide(); });
}

/** 横向条形图（单序列，HTML 实现，标签清晰）。items: [{ name, value, label? }] */
export function barList(host, { items, color, unit, format, max }) {
  host.replaceChildren();
  const top = max ?? Math.max(...items.map((i) => i.value));
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span class="bar-label">${item.label ?? item.name}</span>
      <span class="bar-track"><span class="bar-fill" style="width:0;background:${color};box-shadow:0 0 10px ${color}"></span></span>
      <span class="bar-value">${format(item.value)}</span>`;
    row.addEventListener('pointermove', (e) => tip.show(`<b>${item.name}</b><div>${format(item.value)} ${unit}</div>`, e.clientX, e.clientY));
    row.addEventListener('pointerleave', tip.hide);
    host.append(row);
    requestAnimationFrame(() => { row.querySelector('.bar-fill').style.width = `${(item.value / top) * 100}%`; });
  }
}

/** 分段占比条 + 图例。items: [{ name, share }]，colors 与 items 一一对应。 */
export function segmentBar(host, { items, colors }) {
  host.replaceChildren();
  const bar = document.createElement('div');
  bar.className = 'seg-bar';
  const legend = document.createElement('ul');
  legend.className = 'legend';
  items.forEach((item, i) => {
    const seg = document.createElement('span');
    seg.className = 'seg';
    seg.style.cssText = `flex:${item.share};background:${colors[i]}`;
    seg.addEventListener('pointermove', (e) => tip.show(`<b>${item.name}</b><div>${item.share}%</div>`, e.clientX, e.clientY));
    seg.addEventListener('pointerleave', tip.hide);
    bar.append(seg);
    const li = document.createElement('li');
    li.innerHTML = `<i style="background:${colors[i]}"></i>${item.name}<b>${item.share}%</b>`;
    legend.append(li);
  });
  host.append(bar, legend);
}
