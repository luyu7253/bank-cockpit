// 「贵金属行情」面板：黄金、白银的今日价格与较昨收涨跌幅，每 5 秒随机小幅波动。
// 设计画布固定 460 × 236，页面会把整块画布等比缩放进格子，因此这里不读取窗口尺寸、不写 @media。
// 基准价为示意值，首屏的今日走势用固定种子生成（每次打开一致），之后每 5 秒随机小幅波动。
// 颜色遵循中国习惯「涨红跌绿」，但颜色不是唯一信息：涨跌同时显示箭头与带符号数字。

const STYLE_ID = 'precious-metals-style';
export const TICK_MS = 5000;
export const SEED = 20261112;
/** 单 tick 波动上限：±0.06%。 */
export const STEP_LIMIT = 0.0006;
/** 当日价格相对昨收的波动上限：±2.5%，避免长时间随机游走跑飞。 */
export const DAILY_LIMIT = 0.025;
/** 迷你走势保留的点数。 */
export const HISTORY_LEN = 40;

// 基准价（示意）：黄金按元/克报价，白银按元/千克报价。
export const METALS_BASE = [
  { key: 'gold', name: '黄金', code: 'Au99.99', unit: '元/克', digits: 2, price: 618.8, prevClose: 612.4, step: STEP_LIMIT },
  { key: 'silver', name: '白银', code: 'Ag(T+D)', unit: '元/千克', digits: 2, price: 7612, prevClose: 7644, step: STEP_LIMIT },
];

const STYLE = `
[data-panel="precious-metals"] {
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
[data-panel="precious-metals"] .pm-root {
  width: 460px; height: 236px; box-sizing: border-box;
  padding: 7px 10px 6px; display: flex; flex-direction: column; gap: 6px;
  overflow: hidden; white-space: nowrap;
}
[data-panel="precious-metals"] .pm-top {
  flex: 0 0 16px; height: 16px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 10px; line-height: 16px; color: var(--text-muted); letter-spacing: 0.02em;
}
[data-panel="precious-metals"] .pm-update { display: inline-flex; align-items: center; gap: 5px; }
[data-panel="precious-metals"] .pm-update b { color: var(--text-secondary); font-weight: 600; margin-left: 2px; }
[data-panel="precious-metals"] .pm-live {
  width: 5px; height: 5px; border-radius: 50%; background: var(--accent);
  box-shadow: 0 0 6px var(--accent); animation: pm-pulse 2s ease-in-out infinite;
}
[data-panel="precious-metals"] .pm-legend { display: inline-flex; align-items: center; gap: 10px; }
[data-panel="precious-metals"] .pm-legend i { font-style: normal; }
[data-panel="precious-metals"] .pm-legend-up { color: var(--bad); }
[data-panel="precious-metals"] .pm-legend-down { color: var(--good); }
[data-panel="precious-metals"] .pm-cards {
  flex: 1 1 auto; min-height: 0; display: flex; gap: 10px;
}
[data-panel="precious-metals"] .pm-card {
  position: relative; flex: 1 1 0; min-width: 0; box-sizing: border-box;
  padding: 8px 10px 7px; display: flex; flex-direction: column; gap: 3px;
  border: 1px solid rgba(79, 163, 255, 0.16); border-radius: 8px;
  background: linear-gradient(160deg, rgba(79, 163, 255, 0.07), rgba(255, 255, 255, 0.012) 55%, rgba(0, 0, 0, 0) 100%);
  overflow: hidden;
}
[data-panel="precious-metals"] .pm-card::before {
  content: ""; position: absolute; left: 0; top: 0; width: 100%; height: 2px;
  background: linear-gradient(90deg, var(--pm-tone), transparent 72%); opacity: 0.8;
}
[data-panel="precious-metals"] .pm-up { --pm-tone: var(--bad); }
[data-panel="precious-metals"] .pm-down { --pm-tone: var(--good); }
[data-panel="precious-metals"] .pm-flat { --pm-tone: var(--text-muted); }
[data-panel="precious-metals"] .pm-head {
  flex: 0 0 15px; height: 15px; display: flex; align-items: baseline; justify-content: space-between;
}
[data-panel="precious-metals"] .pm-name {
  font-size: 14px; line-height: 15px; font-weight: 700; letter-spacing: 0.04em;
}
[data-panel="precious-metals"] .pm-code {
  font-size: 10px; line-height: 12px; color: var(--text-muted); letter-spacing: 0.02em;
}
[data-panel="precious-metals"] .pm-price {
  flex: 0 0 34px; height: 34px; min-width: 0;
  display: flex; align-items: baseline; gap: 4px;
}
[data-panel="precious-metals"] .pm-price-num {
  font-size: 30px; line-height: 34px; font-weight: 700; letter-spacing: 0.01em;
  color: var(--text-primary); border-radius: 4px;
  text-shadow: 0 0 14px color-mix(in srgb, var(--pm-tone) 28%, transparent);
}
[data-panel="precious-metals"] .pm-unit {
  font-style: normal; font-size: 10px; line-height: 12px; color: var(--text-muted);
}
[data-panel="precious-metals"] .pm-change {
  flex: 0 0 19px; height: 19px; min-width: 0;
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; line-height: 19px; color: var(--text-muted);
}
[data-panel="precious-metals"] .pm-vs { font-size: 10px; color: var(--text-muted); }
[data-panel="precious-metals"] .pm-arrow { font-size: 10px; line-height: 1; color: var(--pm-tone); }
[data-panel="precious-metals"] .pm-amount { font-weight: 600; color: var(--pm-tone); }
[data-panel="precious-metals"] .pm-pct {
  display: inline-flex; align-items: center; height: 17px; padding: 0 6px; box-sizing: border-box;
  border-radius: 999px; border: 1px solid color-mix(in srgb, var(--pm-tone) 42%, transparent);
  background: color-mix(in srgb, var(--pm-tone) 14%, transparent);
  color: var(--pm-tone); font-size: 12px; line-height: 1; font-weight: 700;
}
[data-panel="precious-metals"] .pm-spark {
  position: relative; flex: 1 1 auto; min-height: 0; margin-top: 1px;
}
[data-panel="precious-metals"] .pm-spark svg { display: block; width: 100%; height: 100%; overflow: visible; }
[data-panel="precious-metals"] .pm-spark-area { fill: var(--pm-tone); opacity: 0.1; }
[data-panel="precious-metals"] .pm-spark-line {
  fill: none; stroke: var(--pm-tone); stroke-width: 1.5;
  stroke-linejoin: round; stroke-linecap: round;
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--pm-tone) 55%, transparent));
}
[data-panel="precious-metals"] .pm-spark-base {
  stroke: var(--text-muted); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.45;
}
[data-panel="precious-metals"] .pm-spark-dot {
  fill: var(--pm-tone); stroke: var(--surface-1); stroke-width: 1.5;
  filter: drop-shadow(0 0 4px var(--pm-tone));
}
[data-panel="precious-metals"] .pm-foot {
  flex: 0 0 13px; height: 13px;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  font-size: 10px; line-height: 13px; color: var(--text-muted);
}
[data-panel="precious-metals"] .pm-foot b { color: var(--text-secondary); font-weight: 600; }
[data-panel="precious-metals"] .pm-bump { animation: pm-bump 0.9s ease-out; }
[data-panel="precious-metals"] .pm-no-motion .pm-live,
[data-panel="precious-metals"] .pm-no-motion .pm-bump { animation: none !important; }
@keyframes pm-pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 6px var(--accent); }
  50% { opacity: 0.35; box-shadow: 0 0 2px var(--accent); }
}
@keyframes pm-bump {
  0% { background-color: color-mix(in srgb, var(--pm-tone) 32%, transparent); }
  100% { background-color: transparent; }
}
`;

/** 四舍五入到指定小数位，并把 -0 归一成 0。 */
export function roundTo(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  const p = 10 ** Math.max(0, Math.trunc(Number(digits) || 0));
  const r = Math.round(n * p) / p;
  return r === 0 ? 0 : r;
}

/** 价格格式化：固定小数位 + 千分位；非法值返回「—」。 */
export function formatPrice(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const fixed = roundTo(n, digits).toFixed(digits);
  const [intPart, decPart] = fixed.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const grouped = (sign ? intPart.slice(1) : intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}${decPart ? `.${decPart}` : ''}`;
}

/** 带符号数字：+6.40 / -32.00；0 显示 0.00；非法值返回「—」。 */
export function formatSigned(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const r = roundTo(n, digits);
  if (r === 0) return formatPrice(0, digits);
  return `${r > 0 ? '+' : '-'}${formatPrice(Math.abs(r), digits)}`;
}

/** 涨跌幅文案：+1.05% / -0.42%。 */
export function formatPct(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const r = roundTo(n, digits);
  if (r === 0) return `${formatPrice(0, digits)}%`;
  return `${r > 0 ? '+' : '-'}${formatPrice(Math.abs(r), digits)}%`;
}

/**
 * 由现价与昨收计算涨跌额、涨跌幅与方向。
 * 涨跌幅按 2 位小数取整后再判断方向，保证显示「0.00%」时不会误标红绿。
 */
export function changeOf(price, prevClose) {
  const p = Number(price);
  const base = Number(prevClose);
  if (!Number.isFinite(p) || !Number.isFinite(base) || base <= 0) {
    return { delta: NaN, pct: NaN, trend: 'flat' };
  }
  const delta = roundTo(p - base, 2);
  const pct = roundTo(((p - base) / base) * 100, 2);
  const trend = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return { delta, pct, trend };
}

/**
 * 生成首屏的今日迷你走势：以昨收附近为起点、向现价做带噪声的随机游走，
 * 最后一点严格等于现价，因此走势方向与涨跌颜色自洽。
 */
export function buildHistory(price, prevClose, rand = Math.random, count = HISTORY_LEN) {
  const random = typeof rand === 'function' ? rand : Math.random;
  const target = Number(price);
  const base = Number(prevClose);
  if (!Number.isFinite(target)) return [];
  const rawCount = Number(count);
  const n = Number.isFinite(rawCount) ? Math.max(2, Math.trunc(rawCount)) : HISTORY_LEN;
  const start = Number.isFinite(base) ? base + (target - base) * (0.15 + random() * 0.2) : target;
  const swing = Math.abs(target - start) * 0.7 + Math.abs(target) * 0.0006;
  const values = [];
  for (let i = 0; i < n - 1; i += 1) {
    const t = i / (n - 1);
    const baseline = start + (target - start) * t;
    const noise = (random() * 2 - 1) * swing * (0.4 + 0.6 * Math.sin(Math.PI * t));
    values.push(Math.max(0.01, baseline + noise));
  }
  values.push(target);
  return values.map((v) => roundTo(v, 4));
}

/** 首屏两只金属：价格、昨收固定，走势用传入随机源生成。 */
export function buildMetals(rand = Math.random) {
  const random = typeof rand === 'function' ? rand : Math.random;
  return METALS_BASE.map((item) => {
    const price = roundTo(item.price, item.digits);
    const prevClose = roundTo(item.prevClose, item.digits);
    const history = buildHistory(price, prevClose, random, HISTORY_LEN);
    return {
      ...item,
      price,
      prevClose,
      history,
      open: history[0],
      ...changeOf(price, prevClose),
    };
  });
}

/**
 * 下一个 tick：每只金属在 ±step 内随机波动（默认 ±0.06%），
 * 并限制在昨收 ±2.5% 内。返回新数组，不修改入参。
 */
export function stepMetals(metals, rand = Math.random) {
  if (!Array.isArray(metals)) return [];
  const random = typeof rand === 'function' ? rand : Math.random;
  return metals.map((metal) => {
    const price = Number(metal?.price);
    const prevClose = Number(metal?.prevClose);
    const digits = Number.isFinite(Number(metal?.digits)) ? Math.max(0, Math.trunc(metal.digits)) : 2;
    const step = Number.isFinite(Number(metal?.step)) ? Math.abs(Number(metal.step)) : STEP_LIMIT;
    if (!Number.isFinite(price) || !Number.isFinite(prevClose) || prevClose <= 0) return { ...metal };

    const raw = price * (1 + (random() * 2 - 1) * step);
    const floor = roundTo(prevClose * (1 - DAILY_LIMIT), digits);
    const ceil = roundTo(prevClose * (1 + DAILY_LIMIT), digits);
    const next = Math.min(ceil, Math.max(floor, roundTo(raw, digits)));
    const history = Array.isArray(metal.history) ? [...metal.history, next] : [next];
    while (history.length > HISTORY_LEN) history.shift();

    return { ...metal, price: next, history, ...changeOf(next, prevClose) };
  });
}

/**
 * 迷你走势的 SVG 几何：宽高内留 pad 边距，baseline（昨收）也计入纵轴范围，
 * 这样昨收虚线不会跑出画布。返回折线、面积、末点坐标与昨收 y 值。
 */
export function sparkGeometry(values, { width = 195, height = 78, pad = 4, baseline } = {}) {
  const nums = (Array.isArray(values) ? values : []).map(Number).filter((v) => Number.isFinite(v));
  if (nums.length < 2) return null;
  const base = Number(baseline);
  const all = Number.isFinite(base) ? nums.concat(base) : nums;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const w = Math.max(2, Number(width) || 195);
  const h = Math.max(2, Number(height) || 78);
  const p = Math.min(Math.max(0, Number(pad) || 0), Math.min(w, h) / 2 - 1);
  const innerW = w - p * 2;
  const innerH = h - p * 2;
  const x = (i) => p + (i / (nums.length - 1)) * innerW;
  const y = (v) => h - p - ((v - lo) / span) * innerH;
  const pts = nums.map((v, i) => [x(i), y(v)]);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('');
  const floorY = (h - p).toFixed(1);
  const area = `${line}L${x(nums.length - 1).toFixed(1)},${floorY}L${x(0).toFixed(1)},${floorY}Z`;
  return {
    line,
    area,
    last: { x: pts.at(-1)[0], y: pts.at(-1)[1] },
    baselineY: Number.isFinite(base) ? y(base) : null,
    width: w,
    height: h,
    pad: p,
  };
}

function ensureStyle(doc) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  doc.head.append(style);
}

function clockText(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

const TREND_TEXT = { up: '上涨', down: '下跌', flat: '持平' };

function cardHtml(metal) {
  return `<article class="pm-card" data-metal="${metal.key}">
    <div class="pm-head"><span class="pm-name">${metal.name}</span><span class="pm-code">${metal.code}</span></div>
    <div class="pm-price"><b class="pm-price-num">—</b><i class="pm-unit">${metal.unit}</i></div>
    <div class="pm-change">
      <span class="pm-vs">较昨收</span><span class="pm-arrow"></span>
      <span class="pm-amount"></span><span class="pm-pct"></span>
    </div>
    <div class="pm-spark">
      <svg preserveAspectRatio="none" role="img" aria-label="今日走势，虚线为昨收" focusable="false">
        <path class="pm-spark-area"></path>
        <path class="pm-spark-line"></path>
        <line class="pm-spark-base"></line>
        <circle class="pm-spark-dot" r="2.4"></circle>
      </svg>
    </div>
    <div class="pm-foot"><span>今开 <b class="pm-open"></b></span><span>昨收 <b class="pm-close"></b></span></div>
  </article>`;
}

export default {
  title: '贵金属行情',
  unit: '实时 · 每 5 秒波动',
  render(el, ctx) {
    if (typeof el.__pmCleanup === 'function') el.__pmCleanup();
    const doc = el.ownerDocument;
    ensureStyle(doc);

    const view = doc.defaultView ?? globalThis;
    const reduce = typeof view.matchMedia === 'function'
      && view.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seeded = ctx?.data?.seededRandom ? ctx.data.seededRandom(SEED) : Math.random;
    let metals = buildMetals(seeded);

    el.replaceChildren();
    const root = doc.createElement('div');
    root.className = `pm-root${reduce ? ' pm-no-motion' : ''}`;
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', '贵金属行情：黄金、白银今日价格与涨跌幅');
    root.innerHTML = `
      <div class="pm-top">
        <span class="pm-update"><i class="pm-live" aria-hidden="true"></i>更新时间<b></b></span>
        <span class="pm-legend"><i class="pm-legend-up">▲ 涨</i><i class="pm-legend-down">▼ 跌</i></span>
      </div>
      <div class="pm-cards"></div>`;

    const cardsEl = root.querySelector('.pm-cards');
    cardsEl.innerHTML = metals.map(cardHtml).join('');
    el.append(root);

    const updateEl = root.querySelector('.pm-update b');
    updateEl.textContent = clockText();

    const nodes = new Map();
    for (const metal of metals) {
      const card = cardsEl.querySelector(`.pm-card[data-metal="${metal.key}"]`);
      if (!card) continue;
      nodes.set(metal.key, {
        card,
        price: card.querySelector('.pm-price-num'),
        arrow: card.querySelector('.pm-arrow'),
        amount: card.querySelector('.pm-amount'),
        pct: card.querySelector('.pm-pct'),
        open: card.querySelector('.pm-open'),
        close: card.querySelector('.pm-close'),
        svg: card.querySelector('.pm-spark svg'),
        area: card.querySelector('.pm-spark-area'),
        line: card.querySelector('.pm-spark-line'),
        base: card.querySelector('.pm-spark-base'),
        dot: card.querySelector('.pm-spark-dot'),
      });
    }

    // 走势图尺寸取自卡片实际布局（未缩放的设计像素），避免手写宽高与 flex 布局不一致。
    const firstSpark = cardsEl.querySelector('.pm-spark');
    const sparkW = Math.max(60, Math.round(firstSpark?.clientWidth || 195));
    const sparkH = Math.max(30, Math.round(firstSpark?.clientHeight || 78));
    for (const node of nodes.values()) node.svg.setAttribute('viewBox', `0 0 ${sparkW} ${sparkH}`);

    function paint(metal, animate) {
      const node = nodes.get(metal.key);
      if (!node) return;
      const { trend, delta, pct } = metal;
      node.card.classList.remove('pm-up', 'pm-down', 'pm-flat');
      node.card.classList.add(`pm-${trend}`);
      node.price.textContent = formatPrice(metal.price, metal.digits);
      node.arrow.textContent = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—';
      node.amount.textContent = trend === 'flat' ? formatPrice(0, metal.digits) : formatSigned(delta, metal.digits);
      node.pct.textContent = trend === 'flat' ? `${formatPrice(0, 2)}%` : formatPct(pct);
      node.open.textContent = formatPrice(metal.open, metal.digits);
      node.close.textContent = formatPrice(metal.prevClose, metal.digits);

      const geo = sparkGeometry(metal.history, { width: sparkW, height: sparkH, pad: 4, baseline: metal.prevClose });
      if (geo) {
        node.area.setAttribute('d', geo.area);
        node.line.setAttribute('d', geo.line);
        node.dot.setAttribute('cx', geo.last.x.toFixed(1));
        node.dot.setAttribute('cy', geo.last.y.toFixed(1));
        if (Number.isFinite(geo.baselineY)) {
          node.base.setAttribute('x1', '0');
          node.base.setAttribute('x2', String(sparkW));
          node.base.setAttribute('y1', geo.baselineY.toFixed(1));
          node.base.setAttribute('y2', geo.baselineY.toFixed(1));
          node.base.removeAttribute('display');
        } else {
          node.base.setAttribute('display', 'none');
        }
      }
      node.card.setAttribute(
        'aria-label',
        `${metal.name} ${formatPrice(metal.price, metal.digits)} ${metal.unit}，较昨收${TREND_TEXT[trend]} ${formatPct(pct)}`,
      );

      if (animate && !reduce) {
        node.price.classList.remove('pm-bump');
        void node.price.offsetWidth; // 重启动画
        node.price.classList.add('pm-bump');
      }
    }

    for (const metal of metals) paint(metal, false);

    const timer = setInterval(() => {
      if (!el.isConnected) {
        cleanup();
        return;
      }
      metals = stepMetals(metals);
      updateEl.textContent = clockText();
      for (const metal of metals) paint(metal, true);
    }, TICK_MS);

    const cleanup = () => {
      clearInterval(timer);
      removeEventListener('pagehide', cleanup);
      el.__pmCleanup = null;
      el.replaceChildren();
    };
    addEventListener('pagehide', cleanup);
    el.__pmCleanup = cleanup;
  },
};
