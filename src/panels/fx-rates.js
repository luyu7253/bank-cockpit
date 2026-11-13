// 「外汇牌价」面板：美元、欧元、日元、港币、英镑的现汇买入 / 卖出价，每 5 秒小幅波动。
// 设计画布固定 460 × 236，页面会把整块画布等比缩放进格子，因此这里不读取窗口尺寸、不写 @media。
// 初始牌价为示意值；首屏的「涨跌」用固定种子生成（有涨有跌），之后每 5 秒随机小幅波动。
// 颜色遵循中国习惯「涨红跌绿」，但颜色不是唯一信息：涨跌列同时显示箭头与带符号数字。

const STYLE_ID = 'fx-rates-style';
const TICK_MS = 5000;
const SEED = 20261112;
// 单边波动上限：±0.02%。
export const STEP_LIMIT = 0.0002;
const MIN_DELTA = 0.0004;
const MAX_DELTA = 0.002;

// 基准牌价（示意，4 位小数）。日元按 100 日元报价。
export const FX_BASE = [
  { code: 'USD', name: '美元', buy: 7.1234, sell: 7.1562 },
  { code: 'EUR', name: '欧元', buy: 7.7412, sell: 7.789 },
  { code: 'JPY', name: '日元', buy: 4.7231, sell: 4.7586, note: '100 日元' },
  { code: 'HKD', name: '港币', buy: 0.9123, sell: 0.9158 },
  { code: 'GBP', name: '英镑', buy: 9.0123, sell: 9.0567 },
];

const STYLE = `
[data-panel="fx-rates"] .fx-root {
  width: 460px; height: 236px; box-sizing: border-box;
  padding: 7px 10px 6px; display: flex; flex-direction: column; gap: 2px;
  overflow: hidden; white-space: nowrap; color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
[data-panel="fx-rates"] .fx-top {
  flex: 0 0 16px; height: 16px; display: flex; align-items: center; justify-content: space-between;
  font-size: 10px; line-height: 16px; color: var(--text-muted); letter-spacing: 0.02em;
}
[data-panel="fx-rates"] .fx-update b { color: var(--text-secondary); font-weight: 600; margin-left: 2px; }
[data-panel="fx-rates"] .fx-legend { display: inline-flex; align-items: center; gap: 9px; }
[data-panel="fx-rates"] .fx-legend i { font-style: normal; }
[data-panel="fx-rates"] .fx-grid {
  display: grid; grid-template-columns: 104px minmax(0, 1fr) minmax(0, 1fr) 96px; align-items: center;
}
[data-panel="fx-rates"] .fx-head {
  flex: 0 0 20px; height: 20px; font-size: 11px; line-height: 20px; color: var(--text-muted);
  border-bottom: 1px solid var(--grid);
}
[data-panel="fx-rates"] .fx-head > span { padding: 0 6px; overflow: hidden; }
[data-panel="fx-rates"] .fx-head .fx-num { text-align: right; }
[data-panel="fx-rates"] .fx-rows {
  flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;
}
[data-panel="fx-rates"] .fx-row {
  flex: 0 0 36px; height: 36px;
  border-bottom: 1px solid rgba(79, 163, 255, 0.10);
  background: linear-gradient(90deg, rgba(79, 195, 255, 0.035), rgba(79, 195, 255, 0) 62%);
}
[data-panel="fx-rates"] .fx-row:last-child { border-bottom: none; }
[data-panel="fx-rates"] .fx-cur {
  display: flex; align-items: baseline; gap: 5px; min-width: 0; overflow: hidden; padding: 0 6px;
}
[data-panel="fx-rates"] .fx-cur b {
  font-size: 13px; line-height: 18px; font-weight: 600; color: var(--text-primary); letter-spacing: 0.02em;
}
[data-panel="fx-rates"] .fx-cur i {
  font-style: normal; font-size: 10px; line-height: 14px; color: var(--text-muted);
}
[data-panel="fx-rates"] .fx-price {
  padding: 0 6px; text-align: right; font-size: 13px; line-height: 18px; font-weight: 600;
  color: var(--text-primary); border-radius: 4px;
}
[data-panel="fx-rates"] .fx-delta {
  padding: 0 6px; text-align: right; font-size: 12px; line-height: 18px; font-weight: 600;
  border-radius: 4px;
}
[data-panel="fx-rates"] .fx-up { color: var(--bad); }
[data-panel="fx-rates"] .fx-down { color: var(--good); }
[data-panel="fx-rates"] .fx-flat { color: var(--text-muted); }
[data-panel="fx-rates"] .fx-bump-up { animation: fx-bump-up 0.9s ease-out; }
[data-panel="fx-rates"] .fx-bump-down { animation: fx-bump-down 0.9s ease-out; }
@keyframes fx-bump-up {
  0% { background-color: rgba(230, 103, 103, 0.32); }
  100% { background-color: transparent; }
}
@keyframes fx-bump-down {
  0% { background-color: rgba(12, 163, 12, 0.30); }
  100% { background-color: transparent; }
}
`;

/** 四舍五入到 4 位小数，并把 -0 归一成 0。 */
const round4 = (value) => {
  const n = Math.round(Number(value) * 1e4) / 1e4;
  return n === 0 ? 0 : n;
};

/** 牌价格式化：固定 4 位小数；非法值返回「—」。 */
export function formatRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return round4(n).toFixed(4);
}

/** 涨跌方向：up / down / flat（不足 4 位小数可显示的幅度视为持平）。 */
export function trendOf(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n) || Math.abs(n) < 0.00005) return 'flat';
  return n > 0 ? 'up' : 'down';
}

/**
 * 生成首屏牌价：基准价固定，「较上一 tick」的涨跌用传入随机源生成。
 * 按行序正负交替，保证首屏红绿都有；只消费 5 个随机数。
 */
export function buildFxRates(rand = Math.random) {
  const random = typeof rand === 'function' ? rand : Math.random;
  return FX_BASE.map((item, i) => {
    const mag = round4(MIN_DELTA + random() * (MAX_DELTA - MIN_DELTA));
    const delta = (i % 2 === 0 ? 1 : -1) * mag;
    return {
      ...item,
      prevBuy: round4(item.buy - delta),
      prevSell: round4(item.sell - delta),
      delta: round4(delta),
      trend: trendOf(delta),
    };
  });
}

/**
 * 下一个 tick：买入价、卖出价各自做 ±0.02% 内的随机波动，保留 4 位小数。
 * 返回新数组，不修改入参；delta 为买入价相对上一 tick 的变化。
 */
export function stepRates(rates, rand = Math.random) {
  if (!Array.isArray(rates)) return [];
  const random = typeof rand === 'function' ? rand : Math.random;
  return rates.map((rate) => {
    const buy = Number(rate?.buy);
    const sell = Number(rate?.sell);
    if (!Number.isFinite(buy) || !Number.isFinite(sell)) return { ...rate };
    const nextBuy = round4(buy * (1 + (random() * 2 - 1) * STEP_LIMIT));
    let nextSell = round4(sell * (1 + (random() * 2 - 1) * STEP_LIMIT));
    if (nextSell <= nextBuy) nextSell = round4(nextBuy + 0.0001); // 长时间随机游走后仍保证价差为正
    const delta = round4(nextBuy - buy);
    return {
      ...rate,
      buy: nextBuy,
      sell: nextSell,
      prevBuy: buy,
      prevSell: sell,
      delta,
      trend: trendOf(delta),
    };
  });
}

/** 涨跌列文案：箭头 + 带符号数字；持平时显示「—」。 */
export function formatDelta(delta) {
  const trend = trendOf(delta);
  if (trend === 'flat') return { trend, text: '—' };
  const sign = trend === 'up' ? '+' : '-';
  return { trend, text: `${trend === 'up' ? '▲' : '▼'} ${sign}${formatRate(Math.abs(delta))}` };
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.append(style);
}

function clockText(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function applyTrend(node, trend) {
  node.classList.remove('fx-up', 'fx-down', 'fx-flat', 'fx-bump-up', 'fx-bump-down');
  node.classList.add(`fx-${trend}`);
}

function bump(node, trend) {
  if (trend === 'flat') return;
  node.classList.remove('fx-bump-up', 'fx-bump-down');
  void node.offsetWidth; // 重启动画
  node.classList.add(trend === 'up' ? 'fx-bump-up' : 'fx-bump-down');
}

export default {
  title: '外汇牌价',
  unit: '现汇 · 每 5 秒更新',
  render(el, ctx) {
    if (typeof el.__fxCleanup === 'function') el.__fxCleanup();
    ensureStyle();

    const reduce = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seeded = ctx?.data?.seededRandom ? ctx.data.seededRandom(SEED) : Math.random;
    let rates = buildFxRates(seeded);

    el.replaceChildren();
    const root = document.createElement('div');
    root.className = 'fx-root';
    root.innerHTML = `
      <div class="fx-top">
        <span class="fx-update">更新时间<b></b></span>
        <span class="fx-legend"><i class="fx-up">▲ 涨</i><i class="fx-down">▼ 跌</i></span>
      </div>
      <div class="fx-head fx-grid">
        <span>币种</span><span class="fx-num">现汇买入价</span><span class="fx-num">现汇卖出价</span><span class="fx-num">涨跌</span>
      </div>
      <div class="fx-rows"></div>`;

    const updateEl = root.querySelector('.fx-update b');
    updateEl.textContent = clockText();
    const rowsEl = root.querySelector('.fx-rows');
    const cells = new Map();

    for (const rate of rates) {
      const row = document.createElement('div');
      row.className = 'fx-row fx-grid';
      row.dataset.code = rate.code;
      row.innerHTML = `
        <span class="fx-cur"><b>${rate.name}</b><i>${rate.note ?? rate.code}</i></span>
        <span class="fx-price"></span>
        <span class="fx-price"></span>
        <span class="fx-delta"></span>`;
      const [buyEl, sellEl] = row.querySelectorAll('.fx-price');
      const deltaEl = row.querySelector('.fx-delta');
      cells.set(rate.code, { buyEl, sellEl, deltaEl });
      rowsEl.append(row);
    }

    function paint(rate, animate) {
      const cell = cells.get(rate.code);
      if (!cell) return;
      const prevBuy = rate.prevBuy;
      const prevSell = rate.prevSell;
      cell.buyEl.textContent = formatRate(rate.buy);
      cell.sellEl.textContent = formatRate(rate.sell);
      const buyTrend = trendOf(round4(rate.buy - prevBuy));
      const sellTrend = trendOf(round4(rate.sell - prevSell));
      const { trend, text } = formatDelta(rate.delta);
      cell.deltaEl.textContent = text;
      applyTrend(cell.deltaEl, trend);
      if (animate && !reduce) {
        bump(cell.buyEl, buyTrend);
        bump(cell.sellEl, sellTrend);
        bump(cell.deltaEl, trend);
      }
    }

    for (const rate of rates) paint(rate, false);
    el.append(root);

    const timer = setInterval(() => {
      if (!el.isConnected) {
        clearInterval(timer);
        return;
      }
      rates = stepRates(rates);
      updateEl.textContent = clockText();
      for (const rate of rates) paint(rate, true);
    }, TICK_MS);

    const cleanup = () => {
      clearInterval(timer);
      removeEventListener('pagehide', cleanup);
      el.replaceChildren();
    };
    addEventListener('pagehide', cleanup);
    el.__fxCleanup = cleanup;
  },
};
