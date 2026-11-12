// C 区：今日业务实时计数器。
// 三个今日累计指标每隔几秒自动增长：数字滚动更新，下方各带一条迷你趋势线。
// 纯计算函数导出给 test/slot-c.test.js；DOM 只在 render 内创建。

export const TREND_POINTS = 18;

/** 三个计数器的初始值、单位与每次增长的步长（金额单位：万元）。 */
export const COUNTER_DEFS = [
  { key: 'accounts', name: '新开户数', unit: '户', decimals: 0, base: 12_846, step: [3, 9] },
  { key: 'wealth', name: '理财申购额', unit: '万元', decimals: 1, base: 8_632.4, step: [18.6, 64.8] },
  { key: 'cards', name: '信用卡交易笔数', unit: '笔', decimals: 0, base: 158_432, step: [60, 180] },
];

function roundTo(value, decimals) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** 千分位格式化，小数位按指标定义固定。 */
export function formatCounter(value, decimals = 0) {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** 在 [min, max] 内取一步随机增量，并按 decimals 取整（rand 返回 [0, 1)）。 */
export function nextStep(rand, min, max, decimals = 0) {
  return roundTo(min + rand() * (max - min), decimals);
}

/** 从当前值往回推 points 个采样点，得到一条以 def.base 收尾的递增趋势线。 */
export function buildTrend(rand, def, points = TREND_POINTS) {
  const avg = (def.step[0] + def.step[1]) / 2;
  const values = new Array(points);
  let value = def.base;
  for (let i = points - 1; i >= 0; i -= 1) {
    values[i] = roundTo(value, def.decimals);
    value -= avg * (0.6 + rand() * 0.8);
  }
  return values;
}

/** 三个计数器的初始状态：今日累计值 + 最近一段趋势。 */
export function createCounters(rand, defs = COUNTER_DEFS) {
  return Object.fromEntries(defs.map((def) => [
    def.key,
    { value: def.base, trend: buildTrend(rand, def) },
  ]));
}

/**
 * 推进一次（每隔几秒调用）：各自随机增长一步，趋势线右移一位。
 * 返回新状态，不修改传入的 state；delta 为本次增量。
 */
export function advanceCounters(state, rand, defs = COUNTER_DEFS) {
  return Object.fromEntries(defs.map((def) => {
    const prev = state[def.key];
    const delta = nextStep(rand, def.step[0], def.step[1], def.decimals);
    const value = roundTo(prev.value + delta, def.decimals);
    const trend = [...prev.trend, value].slice(-TREND_POINTS);
    return [def.key, { value, trend, delta: roundTo(value - prev.value, def.decimals) }];
  }));
}

/** 迷你趋势线的 SVG path（宽 w 高 h，留 pad 像素边距）。 */
export function sparklinePath(values, w, h, pad = 2) {
  if (values.length < 2) return '';
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo;
  return values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = span === 0 ? h / 2 : h - pad - ((v - lo) / span) * (h - pad * 2);
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join('');
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const SPARK_W = 220;
const SPARK_H = 34;
const SPARK_PAD = 3;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// 样式都限定在 [data-slot="c"] 内，不影响其它区域。
// C 区固定为 470×306 的画布格子，内容必须塞进约 440×251 的 body：三行均分。
const PANEL_CSS = `
[data-slot="c"] .tc-root { display: flex; flex-direction: column; height: 100%; min-height: 0; }
[data-slot="c"] .tc-list {
  list-style: none; margin: 0; padding: 0; min-width: 0; min-height: 0; flex: 1;
  display: grid; gap: 6px; grid-template-rows: repeat(3, minmax(0, 1fr));
}
[data-slot="c"] .tc-item {
  min-width: 0; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column; justify-content: center;
  padding: 4px 12px 3px; border-radius: 8px;
  background: linear-gradient(180deg, rgba(79, 195, 255, 0.07), rgba(79, 195, 255, 0.015));
  border: 1px solid var(--border);
  box-shadow: inset 2px 0 0 var(--tc-color);
}
[data-slot="c"] .tc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
[data-slot="c"] .tc-name {
  display: flex; align-items: center; gap: 6px; min-width: 0;
  color: var(--text-secondary); font-size: 12px; line-height: 15px; letter-spacing: 0.04em; white-space: nowrap;
}
[data-slot="c"] .tc-swatch { width: 7px; height: 7px; border-radius: 2px; background: var(--tc-color); flex: none; }
[data-slot="c"] .tc-step {
  flex: none; color: var(--accent); font-size: 11px; line-height: 15px; font-variant-numeric: tabular-nums;
  opacity: 0; transition: opacity 0.3s ease; white-space: nowrap;
}
[data-slot="c"] .tc-step.on { opacity: 1; }
[data-slot="c"] .tc-value { display: flex; align-items: baseline; gap: 5px; margin: 0; min-width: 0; }
[data-slot="c"] .tc-value b {
  font-size: 32px; line-height: 1.05; font-weight: 700;
  font-variant-numeric: tabular-nums; letter-spacing: 0.01em;
  text-shadow: 0 0 16px rgba(79, 195, 255, 0.26);
}
[data-slot="c"] .tc-value small { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
[data-slot="c"] .tc-spark { display: block; width: 100%; height: 22px; margin-top: 1px; overflow: visible; }
[data-slot="c"] .tc-line { fill: none; stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
[data-slot="c"] .tc-area { opacity: 0.14; }
`;

export default {
  title: '今日业务实时计数器',
  unit: '实时 · 模拟数据',
  render(el, ctx) {
    if (!el.querySelector('style[data-slot-c]')) {
      const style = document.createElement('style');
      style.setAttribute('data-slot-c', '');
      style.textContent = PANEL_CSS;
      el.append(style);
    }

    const colors = COUNTER_DEFS.map((_, i) => ctx.colors.series[i % ctx.colors.series.length]);
    const rand = ctx.data.seededRandom(20261112);
    let state = createCounters(rand);

    const root = document.createElement('div');
    root.className = 'tc-root';
    const list = document.createElement('ul');
    list.className = 'tc-list';
    root.append(list);
    el.append(root);

    const items = COUNTER_DEFS.map((def, i) => {
      const color = colors[i];
      const li = document.createElement('li');
      li.className = 'tc-item';
      li.style.setProperty('--tc-color', color);
      li.innerHTML = `
        <div class="tc-head">
          <span class="tc-name"><i class="tc-swatch" aria-hidden="true"></i>${def.name}</span>
          <span class="tc-step" aria-hidden="true"></span>
        </div>
        <p class="tc-value"><b>0</b><small>${def.unit}</small></p>
        <svg class="tc-spark" viewBox="0 0 ${SPARK_W} ${SPARK_H}" preserveAspectRatio="none" aria-hidden="true">
          <path class="tc-area" style="fill:${color}"></path>
          <path class="tc-line" style="stroke:${color};filter:drop-shadow(0 0 3px ${color})"></path>
        </svg>`;
      list.append(li);
      return {
        def,
        num: li.querySelector('.tc-value b'),
        step: li.querySelector('.tc-step'),
        line: li.querySelector('.tc-line'),
        area: li.querySelector('.tc-area'),
      };
    });

    const drawSpark = (item, values) => {
      const d = sparklinePath(values, SPARK_W, SPARK_H, SPARK_PAD);
      item.line.setAttribute('d', d);
      item.area.setAttribute('d', `${d}L${SPARK_W - SPARK_PAD},${SPARK_H}L${SPARK_PAD},${SPARK_H}Z`);
    };

    // 数字从 from 滚动到 to；尊重 prefers-reduced-motion。
    const rollTo = (item, from, to, duration = 900) => {
      const { decimals } = item.def;
      const settle = () => { item.num.textContent = formatCounter(to, decimals); };
      if (prefersReducedMotion()) { settle(); return; }
      const t0 = performance.now();
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        if (t >= 1) { settle(); return; }
        const eased = 1 - (1 - t) ** 3;
        item.num.textContent = formatCounter(from + (to - from) * eased, decimals);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };

    items.forEach((item) => {
      const current = state[item.def.key];
      drawSpark(item, current.trend);
      rollTo(item, 0, current.value, 1200);
    });

    const tick = () => {
      const prev = state;
      state = advanceCounters(state, Math.random);
      items.forEach((item) => {
        const key = item.def.key;
        const next = state[key];
        rollTo(item, prev[key].value, next.value);
        drawSpark(item, next.trend);
        item.step.textContent = `+${formatCounter(next.delta, item.def.decimals)}`;
        item.step.classList.add('on');
        clearTimeout(item.step._hide);
        item.step._hide = setTimeout(() => item.step.classList.remove('on'), 1600);
      });
      setTimeout(tick, 2200 + Math.random() * 1400);
    };
    setTimeout(tick, 2200 + Math.random() * 1000);
  },
};
