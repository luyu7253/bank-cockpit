// 「实时业务计数器」面板：三个今日累计指标 + 单序列迷你趋势线。
// 初始值与初始趋势用固定种子生成，刷新一致；之后每 2–3 秒随机增长一次。
// 设计画布固定 460 × 236，页面会整块等比缩放。

const NS = 'http://www.w3.org/2000/svg';
const STYLE_ID = 'realtime-counters-style';
const SPARK_W = 440;
const SPARK_H = 18;
const SPARK_PAD = 4;

/** 三个今日累计指标：初始值固定，step 为每次增长的取值范围。 */
export const COUNTERS = [
  { key: 'accounts', name: '新开户数', unit: '户', decimals: 0, initial: 12846, step: [3, 9] },
  { key: 'wealth', name: '理财申购额', unit: '万元', decimals: 1, initial: 8632.4, step: [18.6, 64.8] },
  { key: 'cards', name: '信用卡交易笔数', unit: '笔', decimals: 0, initial: 158432, step: [60, 180] },
];

/** 迷你趋势线的点数（16–20）。 */
export const TREND_POINTS = 18;

const STYLE = `
[data-panel="realtime-counters"] .rc-root {
  width: 460px; height: 236px; box-sizing: border-box;
  padding: 7px 10px; display: flex; flex-direction: column;
  overflow: hidden; white-space: nowrap; color: var(--text-primary);
}
[data-panel="realtime-counters"] .rc-row {
  flex: 1 1 0; min-height: 0; display: flex; flex-direction: column;
  justify-content: center; padding: 0 2px; overflow: hidden;
  border-bottom: 1px solid var(--border);
}
[data-panel="realtime-counters"] .rc-row:last-child { border-bottom: 0; }
[data-panel="realtime-counters"] .rc-head {
  display: flex; align-items: baseline; gap: 8px;
  height: 44px; min-height: 44px; padding-top: 2px;
}
[data-panel="realtime-counters"] .rc-name {
  flex: 0 0 112px; font-size: 13px; color: var(--text-secondary);
}
[data-panel="realtime-counters"] .rc-name::before {
  content: ""; display: inline-block; width: 4px; height: 4px; margin-right: 6px;
  border-radius: 50%; vertical-align: middle;
  background: var(--rc-color); box-shadow: 0 0 6px var(--rc-color);
}
[data-panel="realtime-counters"] .rc-num {
  flex: 1 1 auto; min-width: 0; display: flex; align-items: baseline; gap: 4px;
}
[data-panel="realtime-counters"] .rc-num b {
  font-size: 25px; line-height: 1; font-weight: 700; letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums; color: var(--rc-color);
}
[data-panel="realtime-counters"] .rc-num em {
  font-size: 11px; font-style: normal; font-weight: 500; color: var(--text-muted);
}
[data-panel="realtime-counters"] .rc-delta {
  flex: 0 0 52px; text-align: right; font-size: 12px; font-weight: 600;
  color: var(--good); font-variant-numeric: tabular-nums;
  opacity: 0; transform: translateY(2px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
[data-panel="realtime-counters"] .rc-delta.show { opacity: 1; transform: none; }
[data-panel="realtime-counters"] .rc-root.rc-reduced .rc-delta { transition: none; }
[data-panel="realtime-counters"] .rc-spark {
  display: block; width: 100%; height: 18px; flex: 0 0 18px;
  margin-top: 2px; overflow: visible;
}
[data-panel="realtime-counters"] .rc-area { fill: var(--rc-color); opacity: 0.13; }
[data-panel="realtime-counters"] .rc-line {
  fill: none; stroke: var(--rc-color); stroke-width: 1.6;
  stroke-linecap: round; stroke-linejoin: round;
}
[data-panel="realtime-counters"] .rc-dot {
  fill: var(--rc-color); filter: drop-shadow(0 0 3px var(--rc-color));
}
`;

/** 数字格式化：千分位 + 固定小数位。 */
export function formatCounter(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** 第 index 个指标这一次的随机增量，落在 step 范围内并按小数位取整。 */
export function nextStep(index, rand = Math.random) {
  const counter = COUNTERS[index];
  if (!counter) return 0;
  const [lo, hi] = counter.step;
  const unit = 10 ** -counter.decimals;
  const raw = lo + rand() * (hi - lo);
  return Number((Math.round(raw / unit) * unit).toFixed(counter.decimals));
}

/** 三个指标各增长一次，返回新的数值数组（不修改传入数组）。 */
export function advanceCounters(values, rand = Math.random) {
  return COUNTERS.map((counter, i) => {
    const current = Number(values?.[i] ?? counter.initial);
    return Number((current + nextStep(i, rand)).toFixed(counter.decimals));
  });
}

/**
 * 生成一条以初始值结尾的递增趋势线（今日累计只会增长）。
 * 默认 18 个点，往回推随机增量，保证最后一点等于 counter.initial。
 */
export function buildTrend(index, count = TREND_POINTS, rand = Math.random) {
  const counter = COUNTERS[index];
  if (!counter) return [];
  const n = Math.max(1, Math.floor(count));
  if (n === 1) return [counter.initial];
  const values = new Array(n);
  values[n - 1] = counter.initial;
  let v = counter.initial;
  for (let i = n - 2; i >= 0; i -= 1) {
    // 历史每次增幅在本次步长的 0.65–1.35 倍之间，整体单调递增。
    const step = nextStep(index, rand) * (0.65 + rand() * 0.7);
    v = Number((v - step).toFixed(counter.decimals));
    values[i] = v;
  }
  return values;
}

/** 迷你趋势线的 SVG path：把 values 映射到 w × h，四周留 pad 边距。 */
export function sparklinePath(values, w, h, pad = 2) {
  if (!Array.isArray(values) || values.length < 2) return '';
  const p = Math.max(0, pad);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const innerW = w - p * 2;
  const innerH = h - p * 2;
  return values.map((v, i) => {
    const x = p + (i / (values.length - 1)) * innerW;
    const y = h - p - (hi === lo ? 0.5 : (v - lo) / (hi - lo)) * innerH;
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join('');
}

function lastPoint(values, w, h, pad) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const y = h - pad - (hi === lo ? 0.5 : (values.at(-1) - lo) / (hi - lo)) * (h - pad * 2);
  return { x: w - pad, y };
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.append(style);
}

function buildRow(counter, index, color) {
  const row = document.createElement('div');
  row.className = 'rc-row';
  row.style.setProperty('--rc-color', color);
  row.dataset.key = counter.key;
  row.innerHTML = `
    <div class="rc-head">
      <span class="rc-name">${counter.name}</span>
      <span class="rc-num"><b>${formatCounter(0, counter.decimals)}</b><em>${counter.unit}</em></span>
      <span class="rc-delta" aria-live="polite"></span>
    </div>
    <svg class="rc-spark" viewBox="0 0 ${SPARK_W} ${SPARK_H}" preserveAspectRatio="none" aria-hidden="true">
      <path class="rc-area"></path>
      <path class="rc-line"></path>
      <circle class="rc-dot" r="2.4"></circle>
    </svg>`;
  row.dataset.index = String(index);
  return row;
}

function drawSpark(row, values) {
  const d = sparklinePath(values, SPARK_W, SPARK_H, SPARK_PAD);
  row.querySelector('.rc-line').setAttribute('d', d);
  if (!d) return;
  row.querySelector('.rc-area').setAttribute(
    'd',
    `${d}L${SPARK_W - SPARK_PAD},${SPARK_H}L${SPARK_PAD},${SPARK_H}Z`,
  );
  const p = lastPoint(values, SPARK_W, SPARK_H, SPARK_PAD);
  const dot = row.querySelector('.rc-dot');
  dot.setAttribute('cx', p.x.toFixed(1));
  dot.setAttribute('cy', p.y.toFixed(1));
}

export default {
  title: '实时业务计数器',
  unit: '今日累计 · 模拟数据',
  render(el, ctx) {
    if (typeof el.__rcCleanup === 'function') el.__rcCleanup();
    ensureStyle();

    const reduce = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const series = ctx?.colors?.series ?? [];
    const seeded = ctx.data.seededRandom(20261112);

    const state = COUNTERS.map((counter, i) => ({
      value: counter.initial,
      trend: buildTrend(i, TREND_POINTS, seeded),
    }));

    el.replaceChildren();
    const root = document.createElement('div');
    root.className = 'rc-root';
    if (reduce) root.classList.add('rc-reduced');
    el.append(root);

    const rows = COUNTERS.map((counter, i) => {
      const row = buildRow(counter, i, series[i] ?? 'var(--accent)');
      root.append(row);
      drawSpark(row, state[i].trend);
      return row;
    });

    const timers = new Set();
    let stopped = false;

    const schedule = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!stopped) fn();
      }, ms);
      timers.add(id);
      return id;
    };

    const ease = (t) => 1 - (1 - t) ** 3;

    /** 数字滚动；reduce 时直接跳到目标值。 */
    function rollTo(row, counter, from, to, duration) {
      const b = row.querySelector('.rc-num b');
      cancelAnimationFrame(row._raf);
      if (reduce) {
        b.textContent = formatCounter(to, counter.decimals);
        return;
      }
      const t0 = performance.now();
      const frame = (now) => {
        if (stopped) return;
        const t = Math.min(1, (now - t0) / duration);
        b.textContent = formatCounter(from + (to - from) * ease(t), counter.decimals);
        if (t < 1) row._raf = requestAnimationFrame(frame);
      };
      row._raf = requestAnimationFrame(frame);
    }

    /** 本次增量短暂淡出。 */
    function flashDelta(row, delta, decimals) {
      const d = row.querySelector('.rc-delta');
      d.textContent = `+${formatCounter(delta, decimals)}`;
      d.classList.add('show');
      clearTimeout(row._deltaTimer);
      row._deltaTimer = schedule(() => d.classList.remove('show'), reduce ? 900 : 1800);
    }

    function tick() {
      if (stopped || !el.isConnected) return;
      const previous = state.map((s) => s.value);
      const next = advanceCounters(previous);
      rows.forEach((row, i) => {
        const counter = COUNTERS[i];
        state[i].value = next[i];
        state[i].trend.push(next[i]);
        state[i].trend.shift();
        drawSpark(row, state[i].trend);
        rollTo(row, counter, previous[i], next[i], 620);
        flashDelta(row, Number((next[i] - previous[i]).toFixed(counter.decimals)), counter.decimals);
      });
      schedule(tick, 2000 + Math.random() * 1000);
    }

    rows.forEach((row, i) => {
      const counter = COUNTERS[i];
      rollTo(row, counter, 0, counter.initial, 1150);
    });
    schedule(tick, 2000 + Math.random() * 1000);

    el.__rcCleanup = () => {
      stopped = true;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const row of rows) {
        cancelAnimationFrame(row._raf);
        clearTimeout(row._deltaTimer);
      }
    };
  },
};
