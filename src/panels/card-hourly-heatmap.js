// 「信用卡分时交易热力」面板：24 小时 × 3 个卡种的交易笔数热力网格。
// 固定设计画布 460×236；数据用固定种子的模拟分布生成，午间与晚间双峰。
// 纯计算函数与渲染分离，测试只 import 纯函数、不依赖 DOM。

/** 卡种（3 行）。 */
export const CARD_TYPES = ['标准卡', '金卡', '白金卡'];

/** 今日交易总笔数（万笔），固定值。 */
export const TOTAL_WAN = 86.4;

/** 24 小时基础强度曲线：午间 12 时最高，晚间 19 时次高峰。 */
const HOUR_PROFILE = [
  0.20, 0.14, 0.10, 0.08, 0.09, 0.16, 0.32, 0.55, 0.80, 0.98, 1.08, 1.22,
  1.55, 1.30, 1.00, 0.90, 0.94, 1.04, 1.16, 1.30, 1.18, 0.92, 0.58, 0.30,
];

/** 各卡种笔数占比（标准卡走量、白金卡少而集中）。 */
const CARD_WEIGHTS = [0.52, 0.31, 0.17];

/** 卡种强度曲线的陡峭指数：越高，峰值越集中、夜间越暗。 */
const CARD_SHARPNESS = [1, 1.07, 1.16];

/**
 * 生成 3×24 的交易笔数矩阵（单位：万笔），合计恰好等于 total。
 * rand 为可复现随机源（如 ctx.data.seededRandom(20261112)）。
 * @returns {{ total: number, values: number[][] }}
 */
export function buildHeatmap(rand = Math.random, total = TOTAL_WAN) {
  const totalHundredths = Math.max(0, Math.round(total * 100));
  const weights = CARD_TYPES.map((_, row) =>
    HOUR_PROFILE.map((base) => {
      const jitter = 0.94 + rand() * 0.12; // ±6%，避免随机波动盖过双峰
      return Math.pow(base, CARD_SHARPNESS[row]) * CARD_WEIGHTS[row] * jitter;
    }),
  );

  const flat = weights.flat();
  const sum = flat.reduce((s, w) => s + w, 0);
  if (!(sum > 0) || totalHundredths <= 0) {
    return { total: 0, values: CARD_TYPES.map(() => Array.from({ length: 24 }, () => 0)) };
  }

  // 最大余数法：按 0.01 万笔分配，保证各格合计精确等于 total。
  const exact = flat.map((w) => (w / sum) * totalHundredths);
  const hundredths = exact.map(Math.floor);
  let left = totalHundredths - hundredths.reduce((s, n) => s + n, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length) {
    hundredths[order[k].i] += 1;
    left -= 1;
  }

  return {
    total: totalHundredths / 100,
    values: CARD_TYPES.map((_, row) => hundredths.slice(row * 24, row * 24 + 24).map((n) => n / 100)),
  };
}

/**
 * 交易峰值小时（0–23）：按 24 列求和后取最大的一列，并列时取较早的小时。
 * @param {number[][]} matrix 3×24 矩阵
 */
export function peakHour(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0) return 0;
  const cols = Math.max(...matrix.map((row) => (Array.isArray(row) ? row.length : 0)));
  let bestHour = 0;
  let bestSum = -Infinity;
  for (let c = 0; c < cols; c += 1) {
    const sum = matrix.reduce((s, row) => s + (Number(row?.[c]) || 0), 0);
    if (sum > bestSum) {
      bestSum = sum;
      bestHour = c;
    }
  }
  return bestHour;
}

/**
 * 把笔数归一化到 0–1（用于颜色强度）；越界值夹住，区间无效时返回 0。
 */
export function intensity(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** 把 #rgb / #rrggbb 解析成 [r, g, b]；解析失败时退回面板蓝。 */
function toRgb(hex) {
  const text = String(hex ?? '').trim();
  const short = /^#([0-9a-f]{3})$/i.exec(text);
  const full = /^#([0-9a-f]{6})$/i.exec(text);
  const raw = short ? short[1].split('').map((c) => c + c).join('') : full?.[1];
  if (!raw) return [57, 135, 229];
  return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16));
}

/** 强度 0–1 → 面板序列色（低透明度 → 高亮）。 */
function heatColor(hex, t) {
  const [r, g, b] = toRgb(hex);
  const k = Math.min(1, Math.max(0, t));
  const lift = Math.round(46 * k); // 越强越亮，避免高值糊成一块
  const alpha = 0.09 + 0.86 * Math.pow(k, 0.78);
  return `rgba(${Math.min(255, r + lift)},${Math.min(255, g + lift)},${Math.min(255, b + lift)},${alpha.toFixed(3)})`;
}

/** 峰值小时的展示文本，例如 12 → 12:00–13:00。 */
function hourRange(hour) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hour)}:00–${pad((hour + 1) % 24)}:00`;
}

const styleText = `
[data-panel="card-hourly-heatmap"] { overflow: hidden; }
[data-panel="card-hourly-heatmap"] .chh-root {
  box-sizing: border-box; width: 100%; height: 100%;
  display: flex; flex-direction: column; gap: 0;
  padding: 10px 10px 8px;
  font-family: inherit; color: var(--text-primary);
  white-space: nowrap; overflow: hidden;
  background:
    radial-gradient(340px 130px at 16% 0%, rgba(79, 163, 255, 0.10), transparent 72%),
    linear-gradient(180deg, rgba(17, 23, 36, 0.42), rgba(12, 16, 24, 0.12));
  border-radius: 8px;
}
[data-panel="card-hourly-heatmap"] .chh-head {
  flex: 0 0 50px; display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
[data-panel="card-hourly-heatmap"] .chh-total { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
[data-panel="card-hourly-heatmap"] .chh-total-cap {
  font-size: 11px; line-height: 1; color: var(--text-muted); letter-spacing: 0.10em;
}
[data-panel="card-hourly-heatmap"] .chh-total-line { display: flex; align-items: baseline; gap: 5px; }
[data-panel="card-hourly-heatmap"] .chh-num {
  font-size: 24px; line-height: 1.05; font-weight: 700; letter-spacing: 0.01em;
  color: var(--text-primary); font-variant-numeric: tabular-nums;
  text-shadow: 0 0 14px rgba(79, 163, 255, 0.45);
}
[data-panel="card-hourly-heatmap"] .chh-unit { font-size: 11px; color: var(--text-secondary); }
[data-panel="card-hourly-heatmap"] .chh-peak {
  display: flex; align-items: center; gap: 7px; padding: 5px 9px;
  border: 1px solid rgba(79, 163, 255, 0.30); border-radius: 999px;
  background: linear-gradient(180deg, rgba(79, 163, 255, 0.13), rgba(79, 163, 255, 0.05));
}
[data-panel="card-hourly-heatmap"] .chh-pulse {
  flex: 0 0 6px; width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 7px var(--accent);
  animation: chh-pulse 1.9s ease-in-out infinite;
}
@keyframes chh-pulse {
  0%, 100% { opacity: 0.45; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.15); }
}
[data-panel="card-hourly-heatmap"] .chh-peak-txt { display: flex; flex-direction: column; gap: 1px; }
[data-panel="card-hourly-heatmap"] .chh-peak-txt span {
  font-size: 10px; line-height: 1; color: var(--text-muted); letter-spacing: 0.06em;
}
[data-panel="card-hourly-heatmap"] .chh-peak-txt b {
  font-size: 12px; line-height: 1.1; font-weight: 600; color: #bfe4ff; font-variant-numeric: tabular-nums;
}
[data-panel="card-hourly-heatmap"] .chh-body {
  flex: 1 1 auto; min-height: 0;
  display: grid; grid-template-columns: 40px minmax(0, 1fr); column-gap: 8px;
  align-content: center;
}
[data-panel="card-hourly-heatmap"] .chh-labels {
  display: grid; grid-template-rows: repeat(3, 30px); row-gap: 5px; align-items: center;
}
[data-panel="card-hourly-heatmap"] .chh-labels span {
  font-size: 11px; line-height: 1; color: var(--text-secondary); text-align: right; letter-spacing: 0.02em;
}
[data-panel="card-hourly-heatmap"] .chh-main {
  display: grid; grid-template-rows: 100px 16px; row-gap: 4px; min-width: 0;
}
[data-panel="card-hourly-heatmap"] .chh-grid {
  display: grid; grid-template-columns: repeat(24, minmax(0, 1fr));
  grid-template-rows: repeat(3, 30px); gap: 5px 1px; min-width: 0;
}
[data-panel="card-hourly-heatmap"] .chh-cell {
  display: block; border-radius: 2px; opacity: 0; transform: scale(0.72);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  transition:
    opacity 0.45s ease var(--d, 0ms),
    transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) var(--d, 0ms),
    filter 0.15s ease 0s;
  will-change: opacity, transform;
}
[data-panel="card-hourly-heatmap"] .chh-ready .chh-cell { opacity: 1; transform: none; }
[data-panel="card-hourly-heatmap"] .chh-cell:hover {
  filter: brightness(1.35); outline: 1px solid rgba(255, 255, 255, 0.55); outline-offset: 1px;
}
[data-panel="card-hourly-heatmap"] .chh-axis { position: relative; height: 16px; }
[data-panel="card-hourly-heatmap"] .chh-axis span {
  position: absolute; top: 2px; font-size: 10px; line-height: 1.2;
  color: var(--text-muted); font-variant-numeric: tabular-nums;
}
[data-panel="card-hourly-heatmap"] .chh-axis i {
  position: absolute; top: 0; width: 1px; height: 3px; background: rgba(79, 163, 255, 0.28);
}
[data-panel="card-hourly-heatmap"] .chh-foot {
  flex: 0 0 20px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
}
[data-panel="card-hourly-heatmap"] .chh-scale { display: flex; align-items: center; gap: 6px; min-width: 0; }
[data-panel="card-hourly-heatmap"] .chh-cap {
  font-size: 10px; line-height: 1; color: var(--text-muted);
}
[data-panel="card-hourly-heatmap"] .chh-scale-bar {
  width: 66px; height: 8px; border-radius: 4px; display: inline-block;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.10), 0 0 8px rgba(79, 163, 255, 0.16);
}
[data-panel="card-hourly-heatmap"] .chh-scale-note { font-size: 10px; color: var(--text-muted); }
[data-panel="card-hourly-heatmap"] .chh-foot-note { font-size: 10px; color: var(--text-muted); }
`;

const AXIS_HOURS = [0, 6, 12, 18, 24];

/** 渲染面板。 */
export default {
  title: '信用卡分时交易热力',
  unit: '24 小时 · 模拟数据',
  render(el, ctx) {
    const rand = ctx.data.seededRandom(20261112);
    const heatmap = buildHeatmap(rand, TOTAL_WAN);
    const values = heatmap.values;
    const flat = values.flat();
    const lo = Math.min(...flat);
    const hi = Math.max(...flat);
    const peak = peakHour(values);
    const peakText = hourRange(peak);
    const series = ctx.colors.series[0];

    const style = document.createElement('style');
    style.textContent = styleText;

    const root = document.createElement('div');
    root.className = 'chh-root';
    root.innerHTML = `
      <div class="chh-head">
        <div class="chh-total">
          <span class="chh-total-cap">今日交易</span>
          <div class="chh-total-line"><b class="chh-num">${heatmap.total.toFixed(1)}</b><span class="chh-unit">万笔</span></div>
        </div>
        <div class="chh-peak" title="峰值时段 ${peakText}">
          <span class="chh-pulse" aria-hidden="true"></span>
          <div class="chh-peak-txt"><span>峰值时段</span><b>${peakText}</b></div>
        </div>
      </div>
      <div class="chh-body">
        <div class="chh-labels">${CARD_TYPES.map((name) => `<span>${name}</span>`).join('')}</div>
        <div class="chh-main">
          <div class="chh-grid" role="img"
            aria-label="信用卡分时交易热力：今日交易 ${heatmap.total.toFixed(1)} 万笔，峰值时段 ${peakText}"></div>
          <div class="chh-axis">${AXIS_HOURS.map((h) => {
            const left = (h / 24) * 100;
            const anchor = h === 0 ? 'translateX(0)' : h === 24 ? 'translateX(-100%)' : 'translateX(-50%)';
            return `<span style="left:${left}%;transform:${anchor}">${h}</span>`;
          }).join('')}</div>
        </div>
      </div>
      <div class="chh-foot">
        <div class="chh-scale">
          <span class="chh-cap">低</span>
          <span class="chh-scale-bar" style="background:linear-gradient(90deg,${[0, 0.25, 0.5, 0.75, 1]
            .map((t) => heatColor(series, t)).join(',')})"></span>
          <span class="chh-cap">高</span>
          <span class="chh-scale-note">交易强度</span>
        </div>
        <span class="chh-foot-note">颜色越亮交易越集中</span>
      </div>`;

    const grid = root.querySelector('.chh-grid');
    const cells = [];
    values.forEach((row, r) => {
      row.forEach((value, c) => {
        const t = intensity(value, lo, hi);
        const cell = document.createElement('span');
        cell.className = 'chh-cell';
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.style.setProperty('--d', `${c * 14 + r * 28}ms`);
        cell.style.background = heatColor(series, t);
        if (t > 0.82) cell.style.boxShadow = `inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 0 7px ${heatColor(series, t)}`;
        cell.title = `${CARD_TYPES[r]} ${hourRange(c)} ${value.toFixed(2)} 万笔`;
        cells.push(cell);
      });
    });
    grid.append(...cells);
    el.replaceChildren(style, root);

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduced) root.classList.add('chh-ready');
    else requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('chh-ready')));

    grid.addEventListener('pointermove', (e) => {
      const cell = e.target.closest('.chh-cell');
      if (!cell || !grid.contains(cell)) return;
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      ctx.charts?.tip?.show(
        `<b>${CARD_TYPES[r]} · ${hourRange(c)}</b><div>交易笔数<span>${values[r][c].toFixed(2)} 万笔</span></div>`,
        e.clientX,
        e.clientY,
      );
    });
    grid.addEventListener('pointerleave', () => ctx.charts?.tip?.hide());
  },
};
