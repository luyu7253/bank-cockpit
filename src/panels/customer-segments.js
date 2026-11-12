// AI 建设区面板：客户分层（AUM 结构 + 四层客户卡片）。
// 纯函数 buildSegments / normalizeShares / formatWan 见文件上半部分，测试见 test/customer-segments.test.js。

const LAYERS = [
  { name: '大众客户', aum: 0.33, customers: 0.7 },
  { name: '潜力客户', aum: 0.27, customers: 0.19 },
  { name: '财富客户', aum: 0.23, customers: 0.085 },
  { name: '私行客户', aum: 0.17, customers: 0.025 },
];

const round1 = (v) => Math.round(v * 10) / 10;

/** 保留 1 位小数、带千分位的数字格式，例如 620.4 / 1,002.6。 */
export function formatWan(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * 把一组绝对数换算成占比（%），保留 1 位小数，合计严格归一到 100.0。
 * 用最大余数法分配四舍五入产生的零头，避免出现 99.9 / 100.1。
 */
export function normalizeShares(values) {
  const total = values.reduce((s, v) => s + v, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 1000); // 千分之一百分点
  const tenths = raw.map((v) => Math.floor(v));
  let remaining = 1000 - tenths.reduce((s, v) => s + v, 0);
  const byFraction = raw
    .map((v, i) => ({ i, frac: v - tenths[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remaining > 0; k += 1) {
    tenths[byFraction[k % byFraction.length].i] += 1;
    remaining -= 1;
  }
  return tenths.map((t) => t / 10);
}

/** 按权重把总额拆成保留 1 位小数的各层金额，合计与总额完全一致。 */
function allocate(total, weights) {
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const values = weights.map((w) => round1((total * w) / weightSum));
  let diff = Math.round((total - values.reduce((s, v) => s + v, 0)) * 10);
  let guard = 0;
  while (diff !== 0 && guard < 1000) {
    const i = guard % values.length;
    if (diff > 0) {
      values[i] = round1(values[i] + 0.1);
      diff -= 1;
    } else if (values[i] > 0.1) {
      values[i] = round1(values[i] - 0.1);
      diff += 1;
    }
    guard += 1;
  }
  return values;
}

/**
 * 生成四层客户数据：AUM 合计 1,200–1,400 亿元，客户数合计约 1,000 万户。
 * @param {() => number} rand 返回 [0,1) 的随机函数（页面传 seededRandom(20261112)）
 * @returns {{name:string,aum:number,customers:number,share:number,delta:number}[]}
 */
export function buildSegments(rand) {
  if (typeof rand !== 'function') throw new TypeError('buildSegments 需要随机函数');
  const totalAum = round1(1200 + rand() * 200);
  const totalCustomers = round1(980 + rand() * 80);
  const jitter = (base) => base * (1 + (rand() * 2 - 1) * 0.04);
  const aums = allocate(totalAum, LAYERS.map((l) => jitter(l.aum)));
  const customers = allocate(totalCustomers, LAYERS.map((l) => jitter(l.customers)));
  const shares = normalizeShares(aums);
  return LAYERS.map((l, i) => ({
    name: l.name,
    aum: aums[i],
    customers: customers[i],
    share: shares[i],
    delta: round1((rand() * 2 - 1) * 4.5), // AUM 较上月变化（%）
  })).sort((a, b) => b.aum - a.aum);
}

const STYLE_ID = 'customer-segments-style';

const CSS = `
[data-panel="customer-segments"] { overflow: hidden; font-variant-numeric: tabular-nums; }
[data-panel="customer-segments"] .cs-root {
  width: 100%; height: 100%; box-sizing: border-box; padding: 6px 8px;
  display: flex; flex-direction: column; gap: 5px; overflow: hidden;
  color: var(--text-primary);
}
[data-panel="customer-segments"] .cs-top {
  flex: none; height: 15px; display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px; white-space: nowrap;
}
[data-panel="customer-segments"] .cs-caption {
  display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-secondary);
  letter-spacing: 0.04em;
}
[data-panel="customer-segments"] .cs-caption::before {
  content: ""; width: 3px; height: 11px; border-radius: 2px;
  background: var(--accent); box-shadow: 0 0 6px var(--accent);
}
[data-panel="customer-segments"] .cs-total { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
[data-panel="customer-segments"] .cs-total b { font-size: 13px; font-weight: 700; color: var(--text-primary); margin: 0 2px; }
[data-panel="customer-segments"] .cs-bar {
  flex: none; height: 14px; display: flex; border-radius: 4px; overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
}
[data-panel="customer-segments"] .cs-seg {
  height: 100%; flex: 0 0 auto; transform-origin: left center;
  animation: cs-seg-grow 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.16);
}
[data-panel="customer-segments"] .cs-seg + .cs-seg { border-left: 2px solid rgba(9, 13, 21, 0.9); }
[data-panel="customer-segments"] .cs-seg:hover { filter: brightness(1.18); }
[data-panel="customer-segments"] .cs-legend {
  list-style: none; margin: 0; padding: 0; flex: none; height: 17px;
  display: flex; align-items: center; justify-content: space-between; gap: 4px;
}
[data-panel="customer-segments"] .cs-legend li {
  display: flex; align-items: center; gap: 4px; white-space: nowrap;
  font-size: 11px; color: var(--text-secondary);
}
[data-panel="customer-segments"] .cs-legend i { width: 8px; height: 8px; border-radius: 2px; flex: none; }
[data-panel="customer-segments"] .cs-legend b { font-size: 11px; font-weight: 600; color: var(--text-primary); }
[data-panel="customer-segments"] .cs-grid {
  flex: 1; min-height: 0; display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
[data-panel="customer-segments"] .cs-card {
  position: relative; min-width: 0; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 5px 8px 5px 9px; border-radius: 7px;
  border: 1px solid rgba(79, 163, 255, 0.14); border-left: 2px solid var(--c);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012));
  animation: cs-card-in 0.5s ease both; animation-delay: calc(var(--i) * 70ms);
}
[data-panel="customer-segments"] .cs-head {
  flex: none; height: 14px; display: flex; align-items: center; justify-content: space-between;
  gap: 6px; white-space: nowrap;
}
[data-panel="customer-segments"] .cs-name {
  display: flex; align-items: center; gap: 4px; min-width: 0;
  font-size: 12px; font-weight: 600; color: var(--text-primary);
}
[data-panel="customer-segments"] .cs-name i {
  width: 6px; height: 6px; border-radius: 50%; flex: none;
  background: var(--c); box-shadow: 0 0 6px var(--c);
}
[data-panel="customer-segments"] .cs-delta { font-size: 11px; font-weight: 600; white-space: nowrap; }
[data-panel="customer-segments"] .cs-delta i { font-style: normal; font-weight: 400; color: var(--text-muted); margin-right: 2px; }
[data-panel="customer-segments"] .cs-delta.good { color: var(--good); }
[data-panel="customer-segments"] .cs-delta.bad { color: var(--bad); }
[data-panel="customer-segments"] .cs-delta.flat { color: var(--text-muted); }
[data-panel="customer-segments"] .cs-metrics {
  flex: none; height: 17px; display: flex; align-items: baseline; justify-content: space-between;
  gap: 6px; white-space: nowrap;
}
[data-panel="customer-segments"] .cs-metric { display: flex; align-items: baseline; gap: 3px; min-width: 0; }
[data-panel="customer-segments"] .cs-metric em { font-style: normal; font-size: 11px; color: var(--text-muted); }
[data-panel="customer-segments"] .cs-metric b { font-size: 13px; font-weight: 700; color: var(--text-primary); }
[data-panel="customer-segments"] .cs-metric small { font-size: 11px; color: var(--text-muted); }
[data-panel="customer-segments"] .cs-share {
  flex: none; height: 13px; display: flex; align-items: center; gap: 5px; white-space: nowrap;
}
[data-panel="customer-segments"] .cs-share em { font-style: normal; font-size: 11px; color: var(--text-muted); }
[data-panel="customer-segments"] .cs-share b { font-size: 12px; font-weight: 700; color: var(--c); }
[data-panel="customer-segments"] .cs-track {
  flex: 1; min-width: 0; height: 4px; border-radius: 2px; overflow: hidden;
  background: rgba(255, 255, 255, 0.07);
}
[data-panel="customer-segments"] .cs-fill {
  display: block; height: 100%; width: 0; border-radius: 2px;
  background: var(--c); box-shadow: 0 0 6px var(--c);
  transition: width 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
}
[data-panel="customer-segments"] .cs-root.cs-no-motion .cs-seg,
[data-panel="customer-segments"] .cs-root.cs-no-motion .cs-card { animation: none; }
[data-panel="customer-segments"] .cs-root.cs-no-motion .cs-fill { transition: none; }
@keyframes cs-seg-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes cs-card-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
`;

function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

export default {
  title: '客户分层',
  unit: 'AUM · 模拟数据',
  render(el, ctx) {
    injectStyle();

    const segments = buildSegments(ctx.data.seededRandom(20261112));
    const totalAum = segments.reduce((sum, s) => sum + s.aum, 0);
    const colors = ctx.colors.series;
    const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.createElement('div');
    root.className = `cs-root${reduceMotion ? ' cs-no-motion' : ''}`;

    const segs = segments
      .map((s, i) => `<span class="cs-seg" style="width:${s.share}%;background:${colors[i % colors.length]}" aria-label="${s.name}占 ${s.share.toFixed(1)}%"></span>`)
      .join('');
    const legend = segments
      .map((s, i) => `<li><i style="background:${colors[i % colors.length]}"></i>${s.name}<b>${s.share.toFixed(1)}%</b></li>`)
      .join('');
    const cards = segments
      .map((s, i) => {
        const color = colors[i % colors.length];
        const arrow = s.delta > 0 ? '▲' : s.delta < 0 ? '▼' : '■';
        const state = s.delta > 0 ? 'good' : s.delta < 0 ? 'bad' : 'flat';
        return `<article class="cs-card" style="--c:${color};--i:${i}" title="${s.name}：AUM ${formatWan(s.aum)} 亿元，客户 ${formatWan(s.customers)} 万户">
          <div class="cs-head">
            <span class="cs-name"><i></i>${s.name}</span>
            <span class="cs-delta ${state}"><i>环比</i>${arrow} ${Math.abs(s.delta).toFixed(1)}%</span>
          </div>
          <div class="cs-metrics">
            <span class="cs-metric"><em>客户</em><b>${formatWan(s.customers)}</b><small>万户</small></span>
            <span class="cs-metric"><em>AUM</em><b>${formatWan(s.aum)}</b><small>亿元</small></span>
          </div>
          <div class="cs-share">
            <em>占比</em><b>${s.share.toFixed(1)}%</b>
            <span class="cs-track"><span class="cs-fill" style="width:${reduceMotion ? s.share : 0}%"></span></span>
          </div>
        </article>`;
      })
      .join('');

    root.innerHTML = `
      <div class="cs-top">
        <span class="cs-caption">AUM 结构</span>
        <span class="cs-total">合计 <b>${formatWan(totalAum)}</b> 亿元</span>
      </div>
      <div class="cs-bar" role="img" aria-label="客户分层 AUM 结构">${segs}</div>
      <ul class="cs-legend">${legend}</ul>
      <div class="cs-grid">${cards}</div>`;
    el.replaceChildren(root);

    // 条形增长：先按 0 宽度布局，再在下一帧展开（减少动效时直接显示最终值）。
    if (!reduceMotion) {
      void root.offsetWidth;
      requestAnimationFrame(() => {
        root.querySelectorAll('.cs-fill').forEach((fill, i) => {
          fill.style.width = `${segments[i].share}%`;
        });
      });
    }

    // 悬停堆叠条给出明细，指针事件用视口坐标，画布缩放后仍然准确。
    if (ctx.charts?.tip) {
      root.querySelectorAll('.cs-seg').forEach((seg, i) => {
        const s = segments[i];
        seg.addEventListener('pointermove', (e) => {
          ctx.charts.tip.show(
            `<b>${s.name}</b><div>AUM<span>${formatWan(s.aum)} 亿元</span></div><div>客户<span>${formatWan(s.customers)} 万户</span></div><div>占比<span>${s.share.toFixed(1)}%</span></div>`,
            e.clientX,
            e.clientY,
          );
        });
        seg.addEventListener('pointerleave', () => ctx.charts.tip.hide());
      });
    }
  },
};
