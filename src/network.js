// 分行网络拓扑：总行居中，分行环绕；交易沿连线实时流向总行。
import { svg, tip } from './charts.js';
import { ringLayout, scale, arcPath } from './layout.js';
import { formatYi } from './metrics.js';

/**
 * 画网络图，返回 { pulse(city, amount) }，每来一笔交易调用一次。
 * branches: [{ name, loans }]
 */
export function branchNetwork(host, { branches, hqName = '总行' }) {
  host.replaceChildren();
  const W = 800, H = 500, cx = W / 2, cy = H / 2 + 6;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'network', role: 'img', 'aria-label': '分行网络与实时交易流向' }, host);
  const defs = svg('defs', {}, root);
  const glow = svg('radialGradient', { id: 'hq-glow' }, defs);
  svg('stop', { offset: '0%', 'stop-color': 'var(--accent)', 'stop-opacity': 0.55 }, glow);
  svg('stop', { offset: '100%', 'stop-color': 'var(--accent)', 'stop-opacity': 0 }, glow);

  // 背景同心环 + 雷达扫描
  for (const r of [90, 160, 230]) svg('ellipse', { cx, cy, rx: r * 1.45, ry: r * 0.86, class: 'orbit' }, root);
  const sweep = svg('g', { class: 'radar' }, root);
  svg('path', { d: `M${cx},${cy} L${cx + 340},${cy} A340,340 0 0 0 ${cx + 340 * Math.cos(-0.5)},${cy + 340 * Math.sin(-0.5)} Z`, class: 'radar-beam' }, sweep);
  sweep.style.transformOrigin = `${cx}px ${cy}px`;

  const lo = Math.min(...branches.map((b) => b.loans)), hi = Math.max(...branches.map((b) => b.loans));
  const pts = ringLayout(branches.length, cx, cy, 330, 196);
  const links = svg('g', {}, root);
  const nodes = svg('g', {}, root);
  const particles = svg('g', {}, root);
  const byCity = new Map();

  branches.forEach((b, i) => {
    const p = pts[i];
    const path = svg('path', { d: arcPath(p.x, p.y, cx, cy), class: 'link' }, links);
    svg('path', { d: arcPath(p.x, p.y, cx, cy), class: 'link-flow' }, links);
    const r = scale(b.loans, lo, hi, 6, 15);
    const g = svg('g', { class: 'node', transform: `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})` }, nodes);
    svg('circle', { r: r + 8, class: 'node-halo' }, g);
    const dot = svg('circle', { r, class: 'node-dot' }, g);
    const below = p.y > cy;
    const t1 = svg('text', { y: below ? r + 18 : -r - 20, class: 'node-name', 'text-anchor': 'middle' }, g);
    t1.textContent = b.name.replace('分行', '');
    const t2 = svg('text', { y: below ? r + 32 : -r - 7, class: 'node-val', 'text-anchor': 'middle' }, g);
    t2.textContent = `${formatYi(b.loans)} 亿`;
    g.addEventListener('pointermove', (e) => tip.show(`<b>${b.name}</b><div>贷款余额<span>${formatYi(b.loans)} 亿元</span></div>`, e.clientX, e.clientY));
    g.addEventListener('pointerleave', tip.hide);
    byCity.set(b.name.replace('分行', ''), { path, dot, g });
  });

  // 总行
  const hq = svg('g', { class: 'hq', transform: `translate(${cx},${cy})` }, root);
  svg('circle', { r: 70, fill: 'url(#hq-glow)' }, hq);
  const ring = svg('circle', { r: 30, class: 'hq-ring' }, hq);
  svg('circle', { r: 20, class: 'hq-core' }, hq);
  svg('text', { y: 5, class: 'hq-name', 'text-anchor': 'middle' }, hq).textContent = hqName;

  /** 一笔交易：粒子从分行沿弧线飞到总行，大额交易金色并在总行激起波纹。 */
  function pulse(city, amount) {
    const target = byCity.get(city);
    if (!target) return;
    const big = amount >= 10_000_000;
    const len = target.path.getTotalLength();
    const dot = svg('circle', { r: big ? 5 : 3, class: big ? 'particle big' : 'particle' }, particles);
    target.g.classList.add('hit');
    setTimeout(() => target.g.classList.remove('hit'), 500);
    const t0 = performance.now(), dur = big ? 1600 : 1100;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const pt = target.path.getPointAtLength(len * t);
      dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
      if (t < 1) return requestAnimationFrame(step);
      dot.remove();
      if (big) {
        const wave = svg('circle', { cx, cy, r: 30, class: 'ripple' }, particles);
        wave.addEventListener('animationend', () => wave.remove());
      }
      ring.classList.remove('beat'); void ring.getBBox(); ring.classList.add('beat');
    };
    requestAnimationFrame(step);
  }
  return { pulse };
}
