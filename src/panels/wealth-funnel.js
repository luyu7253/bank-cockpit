// 「理财销售漏斗」面板：今日理财销售 5 个环节的转化情况（模拟数据）。
// 固定设计画布 460×236 CSS px，由页面整体等比缩放；所有文字单行，不读窗口尺寸。

/** 漏斗阶段顺序（界面展示中文，全部单行）。 */
export const FUNNEL_STAGES = ['访问产品页', '风险测评', '预约咨询', '申购下单', '成交确认'];

/** 固定种子：刷新页面数字不变。 */
export const FUNNEL_SEED = 20261112;

// 建议量级：12,860 → 6,420 → 3,150 → 1,480 → 1,126。
// 在建议量级上做 ±3.5% 的固定种子扰动，并强制严格递减。
const BASE_COUNTS = [12860, 6420, 3150, 1480, 1126];
const JITTER = 0.035;

/**
 * 生成严格递减的漏斗阶段数据。
 * @param {() => number} rand 返回 [0,1) 的随机源（面板内传入 ctx.data.seededRandom）。
 * @returns {{name: string, value: number}[]}
 */
export function buildFunnel(rand = Math.random) {
  const random = typeof rand === 'function' ? rand : Math.random;
  const stages = [];
  let previous = Infinity;
  for (let i = 0; i < FUNNEL_STAGES.length; i += 1) {
    const jittered = Math.round(BASE_COUNTS[i] * (1 + (random() * 2 - 1) * JITTER));
    const value = i === 0 ? jittered : Math.min(jittered, previous - 1);
    stages.push({ name: FUNNEL_STAGES[i], value: Math.max(1, value) });
    previous = value;
  }
  return stages;
}

/**
 * 相对上一阶段的转化率（百分数，保留 1 位小数）；没有上一阶段时返回 null。
 * @param {number} previous 上一阶段人数
 * @param {number} current 当前阶段人数
 * @returns {number | null}
 */
export function conversionRate(previous, current) {
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous <= 0) return null;
  return Math.round((current / previous) * 1000) / 10;
}

/**
 * 漏斗条宽度：人数越多越宽，居中对称，限制在 [minWidth, maxWidth]。
 * @param {number} value 当前阶段人数
 * @param {number} maxValue 最大阶段人数
 * @param {{maxWidth?: number, minWidth?: number}} [options]
 * @returns {number}
 */
export function funnelWidth(value, maxValue, { maxWidth = 360, minWidth = 72 } = {}) {
  if (!Number.isFinite(value) || !Number.isFinite(maxValue) || maxValue <= 0) return minWidth;
  const ratio = Math.max(0, Math.min(1, value / maxValue));
  return Math.round((minWidth + (maxWidth - minWidth) * ratio) * 10) / 10;
}

function formatCount(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function stageRows(stages, barColor) {
  const max = stages[0].value;
  return stages.map((stage, index) => {
    const previous = index === 0 ? stage.value : stages[index - 1].value;
    const rate = conversionRate(previous, stage.value) ?? 0;
    const width = funnelWidth(stage.value, max);
    return `
      <div class="wf-row">
        <div class="wf-meta">
          <span class="wf-name"><span class="wf-no">${String(index + 1).padStart(2, '0')}</span>${stage.name}</span>
          <span class="wf-figures">
            <span class="wf-rate">转化 ${rate.toFixed(1)}%</span>
            <span class="wf-count">${formatCount(stage.value)} 人</span>
          </span>
        </div>
        <div class="wf-track">
          <span class="wf-bar" style="width:${width}px;animation-delay:${index * 70}ms;background:linear-gradient(90deg,${barColor}cc,${barColor});box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 0 10px ${barColor}66"></span>
        </div>
      </div>`;
  }).join('');
}

export default {
  title: '理财销售漏斗',
  unit: '今日转化 · 模拟数据',
  render(el, ctx) {
    if (el.dataset.panel !== 'wealth-funnel') el.dataset.panel = 'wealth-funnel';

    const stages = buildFunnel(ctx.data.seededRandom(FUNNEL_SEED));
    const first = stages[0].value;
    const last = stages.at(-1).value;
    const overall = conversionRate(first, last) ?? 0;
    const barColor = ctx.colors.series[0];
    const accent = ctx.colors.accent;
    const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    el.style.setProperty('--wf-bar', barColor);
    el.style.setProperty('--wf-accent', accent);
    el.classList.toggle('wf-reduce', reduceMotion);

    el.innerHTML = `
      <style>
        [data-panel="wealth-funnel"] {
          display: flex; flex-direction: column; gap: 5px;
          box-sizing: border-box; padding: 10px 14px 8px; overflow: hidden;
          background: linear-gradient(180deg, rgba(11, 24, 42, .38), rgba(5, 11, 21, .16));
          border-radius: 8px; font-variant-numeric: tabular-nums;
        }
        [data-panel="wealth-funnel"] .wf-head {
          flex: 0 0 20px; height: 20px; min-width: 0;
          display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
          white-space: nowrap;
        }
        [data-panel="wealth-funnel"] .wf-overall { display: flex; align-items: baseline; gap: 6px; white-space: nowrap; }
        [data-panel="wealth-funnel"] .wf-overall span { font-size: 11px; color: var(--text-muted); letter-spacing: .08em; }
        [data-panel="wealth-funnel"] .wf-overall b {
          font-size: 19px; line-height: 1; font-weight: 700;
          color: var(--wf-accent);
        }
        [data-panel="wealth-funnel"] .wf-route { font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
        [data-panel="wealth-funnel"] .wf-route b { color: var(--text-primary); font-weight: 600; }
        [data-panel="wealth-funnel"] .wf-list {
          flex: 1 1 auto; min-height: 0;
          display: flex; flex-direction: column; gap: 4px;
        }
        [data-panel="wealth-funnel"] .wf-row {
          flex: 0 0 35px; height: 35px; min-width: 0;
          display: flex; flex-direction: column; gap: 3px;
        }
        [data-panel="wealth-funnel"] .wf-meta {
          height: 15px; min-width: 0;
          display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
          white-space: nowrap;
        }
        [data-panel="wealth-funnel"] .wf-name {
          display: flex; align-items: baseline; gap: 5px;
          font-size: 12px; color: var(--text-secondary); letter-spacing: .02em;
          white-space: nowrap;
        }
        [data-panel="wealth-funnel"] .wf-no {
          font-size: 11px; font-weight: 600; color: var(--text-muted);
        }
        [data-panel="wealth-funnel"] .wf-figures { display: flex; align-items: baseline; gap: 10px; white-space: nowrap; }
        [data-panel="wealth-funnel"] .wf-rate { font-size: 11px; color: var(--text-muted); }
        [data-panel="wealth-funnel"] .wf-count { font-size: 12px; font-weight: 600; color: var(--text-primary); }
        [data-panel="wealth-funnel"] .wf-track {
          flex: 0 0 16px; width: 100%; height: 16px; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px; background: rgba(12, 20, 34, .72);
          box-shadow: inset 0 0 0 1px rgba(79, 195, 255, .09);
        }
        [data-panel="wealth-funnel"] .wf-bar {
          display: block; height: 16px; border-radius: 8px;
          transform-origin: center center;
          animation: wealth-funnel-grow .8s cubic-bezier(.22, .85, .28, 1) both;
        }
        [data-panel="wealth-funnel"].wf-reduce .wf-bar { animation: none; }
        @keyframes wealth-funnel-grow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      </style>
      <div class="wf-head">
        <span class="wf-overall"><span>整体转化率</span><b>${overall.toFixed(1)}%</b></span>
        <span class="wf-route">访问 <b>${formatCount(first)}</b> → 成交 <b>${formatCount(last)}</b> 人</span>
      </div>
      <div class="wf-list">${stageRows(stages, barColor)}</div>`;
  },
};
