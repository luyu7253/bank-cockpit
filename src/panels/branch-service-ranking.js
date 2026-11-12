// 网点服务排行：按今日服务评分取前 5 个网点，首尾分别标注「服务之星」「需关注」。
// 画布固定 460 × 236 CSS px，所有文字单行。

const PANEL = 'branch-service-ranking';
const SEED = 20261112;
const SCORE_MIN = 88;
const SCORE_MAX = 99;
const WAIT_MIN = 1.8;
const WAIT_MAX = 6.5;

/** 按评分降序，返回新数组，不修改入参。 */
export function sortByScore(rows) {
  return [...rows].sort((a, b) => b.score - a.score);
}

/** 把 88–99 的评分映射为 0–100 的条长百分比，超出范围时收拢到两端。 */
export function barWidth(score, min = SCORE_MIN, max = SCORE_MAX) {
  if (!Number.isFinite(score) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  const pct = ((score - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
}

/**
 * 生成网点评分并取前 limit 名。
 * @param {{name: string}[]} branches 网点列表（来自 ctx.data.branches）
 * @param {() => number} random 0–1 随机数函数，固定种子时结果可复现
 * @param {number} limit 取前几名，默认 5
 * @returns {{rank:number,name:string,score:number,wait:number,tag:string}[]}
 */
export function buildRanking(branches, random = Math.random, limit = 5) {
  const rows = (branches ?? []).map((branch) => {
    const score = Math.round((SCORE_MIN + random() * (SCORE_MAX - SCORE_MIN)) * 10) / 10;
    const wait = Math.round((WAIT_MIN + random() * (WAIT_MAX - WAIT_MIN)) * 10) / 10;
    return { name: branch.name, score, wait };
  });
  const top = sortByScore(rows).slice(0, Math.max(0, limit));
  return top.map((row, i) => ({
    ...row,
    rank: i + 1,
    tag: i === 0 ? 'star' : i === top.length - 1 && top.length > 1 ? 'watch' : '',
  }));
}

const STYLE = `
[data-panel="${PANEL}"] .bsr {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
  padding: 9px 14px;
  color: var(--text-primary);
  font-family: inherit;
  overflow: hidden;
}
[data-panel="${PANEL}"] .bsr-head,
[data-panel="${PANEL}"] .bsr-row {
  display: grid;
  grid-template-columns: 26px 54px minmax(0, 1fr) 70px;
  gap: 8px;
  align-items: center;
  padding: 0 6px;
}
[data-panel="${PANEL}"] .bsr-head {
  height: 20px;
  flex: 0 0 20px;
}
[data-panel="${PANEL}"] .bsr-head > span {
  font-size: 11px;
  line-height: 1;
  color: var(--text-muted);
  white-space: nowrap;
  letter-spacing: 0.02em;
}
[data-panel="${PANEL}"] .bsr-head .bsr-hscore {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
}
[data-panel="${PANEL}"] .bsr-head .bsr-hscore b {
  font-weight: 500;
  color: var(--text-secondary);
}
[data-panel="${PANEL}"] .bsr-head .bsr-hstate {
  text-align: right;
}
[data-panel="${PANEL}"] .bsr-rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 0;
}
[data-panel="${PANEL}"] .bsr-row {
  flex: 0 0 36px;
  height: 36px;
  border-radius: 6px;
  background: rgba(79, 195, 255, 0.025);
}
[data-panel="${PANEL}"] .bsr-row:nth-child(even) {
  background: rgba(79, 195, 255, 0.055);
}
[data-panel="${PANEL}"] .bsr-row.is-top {
  background: rgba(79, 195, 255, 0.1);
  box-shadow: inset 2px 0 0 var(--accent);
}
[data-panel="${PANEL}"] .bsr-rank {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
[data-panel="${PANEL}"] .bsr-row.is-top .bsr-rank {
  color: var(--accent);
  background: rgba(79, 195, 255, 0.14);
  border: 1px solid rgba(79, 195, 255, 0.5);
}
[data-panel="${PANEL}"] .bsr-name {
  font-size: 12px;
  line-height: 1;
  color: var(--text-primary);
  white-space: nowrap;
}
[data-panel="${PANEL}"] .bsr-metric {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
[data-panel="${PANEL}"] .bsr-track {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  height: 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.075);
  overflow: hidden;
}
[data-panel="${PANEL}"] .bsr-fill {
  display: block;
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: var(--bsr-bar, var(--series-1));
  box-shadow: 0 0 8px var(--bsr-bar, var(--series-1));
  transition: width 0.7s cubic-bezier(0.2, 0.8, 0.2, 1);
}
[data-panel="${PANEL}"] .bsr.no-anim .bsr-fill {
  transition: none;
}
[data-panel="${PANEL}"] .bsr-val {
  flex: 0 0 34px;
  text-align: right;
  font-size: 13px;
  line-height: 1;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
[data-panel="${PANEL}"] .bsr-state {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}
[data-panel="${PANEL}"] .bsr-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 20px;
  padding: 0 5px;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1;
  font-weight: 600;
  white-space: nowrap;
}
[data-panel="${PANEL}"] .bsr-tag.good {
  color: var(--good);
  border-color: rgba(12, 163, 12, 0.5);
  background: rgba(12, 163, 12, 0.14);
}
[data-panel="${PANEL}"] .bsr-tag.warn {
  color: var(--warn);
  border-color: rgba(250, 178, 25, 0.5);
  background: rgba(250, 178, 25, 0.13);
}
[data-panel="${PANEL}"] .bsr-tag svg {
  display: block;
  flex: none;
  width: 10px;
  height: 10px;
}
[data-panel="${PANEL}"] .bsr-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
`;

const ICONS = {
  star: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6l1.9 3.9 4.3 0.6-3.1 3 0.7 4.3L8 11.4l-3.8 2 0.7-4.3-3.1-3 4.3-0.6z" fill="currentColor"/></svg>',
  warn: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.9l6.2 11.3H1.8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 5.7v3.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.4" r="0.9" fill="currentColor"/></svg>',
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function ensureStyle() {
  if (document.querySelector(`style[data-panel-style="${PANEL}"]`)) return;
  const style = document.createElement('style');
  style.dataset.panelStyle = PANEL;
  style.textContent = STYLE;
  document.head.append(style);
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export default {
  title: '网点服务排行',
  unit: '今日服务评分 · 模拟数据',
  render(el, ctx) {
    ensureStyle();
    const random = ctx.data?.seededRandom ? ctx.data.seededRandom(SEED) : Math.random;
    const ranking = buildRanking(ctx.data?.branches ?? [], random, 5);
    const barColor = ctx.colors?.series?.[0] ?? 'var(--series-1)';
    const avgWait = ranking.length
      ? Math.round((ranking.reduce((sum, row) => sum + row.wait, 0) / ranking.length) * 10) / 10
      : 0;

    const rows = ranking.map((row) => {
      const width = Math.round(barWidth(row.score) * 10) / 10;
      const tag = row.tag === 'star'
        ? `<span class="bsr-tag good">${ICONS.star}服务之星</span>`
        : row.tag === 'watch'
          ? `<span class="bsr-tag warn">${ICONS.warn}需关注</span>`
          : '';
      return `
        <div class="bsr-row${row.tag === 'star' ? ' is-top' : ''}" role="listitem" aria-label="第 ${row.rank} 名 ${escapeHtml(row.name)}，服务评分 ${row.score}">
          <span class="bsr-rank">${row.rank}</span>
          <span class="bsr-name">${escapeHtml(row.name)}</span>
          <span class="bsr-metric">
            <span class="bsr-track"><i class="bsr-fill" data-width="${width}" style="--bsr-bar:${barColor}"></i></span>
            <b class="bsr-val">${row.score.toFixed(1)}</b>
          </span>
          <span class="bsr-state">${tag}</span>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="bsr${prefersReducedMotion() ? ' no-anim' : ''}">
        <div class="bsr-head" aria-hidden="true">
          <span>名次</span>
          <span>网点</span>
          <span class="bsr-hscore">服务评分<b>· 平均等候 ${avgWait.toFixed(1)} 分</b></span>
          <span class="bsr-hstate">状态</span>
        </div>
        ${ranking.length
          ? `<div class="bsr-rows" role="list">${rows}</div>`
          : '<div class="bsr-empty">暂无网点数据</div>'}
      </div>`;

    const fills = [...el.querySelectorAll('.bsr-fill')];
    const grow = () => fills.forEach((fill) => { fill.style.width = `${fill.dataset.width}%`; });
    if (prefersReducedMotion()) grow();
    else requestAnimationFrame(() => requestAnimationFrame(grow));
  },
};
