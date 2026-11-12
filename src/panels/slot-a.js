// A 区「风险预警」：4 条模拟预警，按严重程度排序，最严重的一条闪烁提醒。
// 纯函数集中在本文件内，测试只 import 这些函数，不依赖浏览器 DOM。

/** 固定随机种子：每次打开面板，预警数值都一致。 */
export const ALERT_SEED = 20261112;

/** 严重程度从高到低的顺序。 */
export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

/** 每种严重程度的图标与中文文字（图标不单独承担状态表达）。 */
export const SEVERITY_META = {
  critical: { label: '严重', icon: '⚠' },
  high: { label: '高', icon: '▲' },
  medium: { label: '中', icon: '◆' },
  low: { label: '低', icon: '●' },
};

const BRANCHES = ['城北分行', '滨江分行', '科技园分行', '临港分行'];

/** 保留指定小数位。 */
function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 生成 4 条模拟预警。传入 ctx.data.seededRandom(固定种子) 可复现。 */
export function createAlerts(random = Math.random) {
  const r = typeof random === 'function' ? random : Math.random;
  const branch = BRANCHES[Math.floor(r() * BRANCHES.length) % BRANCHES.length];

  const npl = round(4.72 + r() * 0.24, 2); // 4.72% ~ 4.96%，逼近 5.00% 阈值
  const headroom = round(5 - npl, 2);
  const txAmount = Math.round((2000 + r() * 1200) / 10) * 10; // 2,000 ~ 3,190 万元
  const outflow = round(3.4 + r() * 0.5, 2); // 3.40 ~ 3.90 亿元
  const multiple = round(1.8 + r() * 0.6, 1); // 近 30 日均值的 1.8 ~ 2.4 倍
  const concentration = round(33 + r() * 2.4, 1); // 33.0% ~ 35.4%

  return [
    {
      id: 'concentration',
      level: 'critical',
      score: 94,
      title: '客户集中度过高',
      detail: `前 5 大客户贷款集中度 ${concentration.toFixed(1)}%，超过内部限额 30.0%`,
      meta: '公司金融部 · 09:40',
    },
    {
      id: 'npl',
      level: 'high',
      score: 86,
      title: `${branch}不良率逼近阈值`,
      detail: `不良率 ${npl.toFixed(2)}%，监管阈值 5.00%，仅余 ${headroom.toFixed(2)} 个百分点`,
      meta: '风险管理部 · 10:15',
    },
    {
      id: 'outflow',
      level: 'medium',
      score: 70,
      title: '存款日间大幅流出',
      detail: `日间净流出 ${outflow.toFixed(2)} 亿元，为近 30 日均值的 ${multiple.toFixed(1)} 倍`,
      meta: '计划财务部 · 13:20',
    },
    {
      id: 'large-tx',
      level: 'low',
      score: 40,
      title: '单笔大额交易',
      detail: `单笔转账 ${txAmount.toLocaleString('zh-CN')} 万元，超过大额监测线 1,000 万元`,
      meta: '实时交易监控 · 14:05',
    },
  ];
}

/** 严重程度序号：越小越严重，未知级别排在最后。 */
export function severityRank(level) {
  const index = SEVERITY_ORDER.indexOf(level);
  return index < 0 ? SEVERITY_ORDER.length : index;
}

/** 按严重程度降序排列（同级别按 score 降序），返回新数组，不改原数组。 */
export function sortAlerts(alerts) {
  return [...alerts].sort(
    (a, b) => severityRank(a.level) - severityRank(b.level) || (b.score ?? 0) - (a.score ?? 0),
  );
}

/** 最严重的一条；空列表返回 null。 */
export function topAlert(alerts) {
  return sortAlerts(alerts)[0] ?? null;
}

const STYLE = `
[data-slot="a"] .risk-summary {
  display: flex; justify-content: space-between; align-items: baseline; gap: 8px;
  margin: 0 0 6px; font-size: 11px; line-height: 16px; color: var(--text-muted);
}
[data-slot="a"] .risk-summary b {
  color: var(--accent); font-size: 13px; font-variant-numeric: tabular-nums;
}
[data-slot="a"] .risk-list {
  list-style: none; margin: 0; padding: 0;
  display: grid; gap: 6px;
}
[data-slot="a"] .risk-row {
  position: relative; min-width: 0;
  display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px;
  padding: 7px 9px; border: 1px solid var(--border); border-left-width: 3px;
  border-radius: 7px; background: rgba(255, 255, 255, 0.025);
}
[data-slot="a"] .risk-icon {
  width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center;
  font-size: 12px; line-height: 1; border: 1px solid currentColor;
  background: rgba(255, 255, 255, 0.05);
}
[data-slot="a"] .risk-body { min-width: 0; }
[data-slot="a"] .risk-head {
  display: flex; align-items: center; gap: 6px; min-width: 0;
}
[data-slot="a"] .risk-title {
  margin: 0; min-width: 0; font-size: 13px; font-weight: 600; line-height: 16px;
  color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
[data-slot="a"] .risk-level {
  flex: none; padding: 2px 5px; border-radius: 999px; border: 1px solid currentColor;
  font-size: 10px; line-height: 1; color: var(--text-secondary);
}
[data-slot="a"] .risk-meta {
  margin-left: auto; flex: none; font-size: 10px; line-height: 16px;
  color: var(--text-muted); white-space: nowrap;
}
[data-slot="a"] .risk-detail {
  margin: 2px 0 0; font-size: 12px; line-height: 16px;
  color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
[data-slot="a"] .level-critical {
  border-left-color: var(--bad);
  background: linear-gradient(90deg, rgba(230, 103, 103, 0.10), rgba(255, 255, 255, 0.02));
}
[data-slot="a"] .level-critical .risk-icon { color: var(--bad); box-shadow: 0 0 8px var(--bad); }
[data-slot="a"] .level-critical .risk-level {
  color: var(--surface-1); background: var(--bad); border-color: var(--bad);
}
[data-slot="a"] .level-high { border-left-color: var(--bad); }
[data-slot="a"] .level-high .risk-icon { color: var(--bad); }
[data-slot="a"] .level-high .risk-level { color: var(--bad); }
[data-slot="a"] .level-medium { border-left-color: var(--warn); }
[data-slot="a"] .level-medium .risk-icon { color: var(--warn); }
[data-slot="a"] .level-medium .risk-level { color: var(--warn); }
[data-slot="a"] .level-low { border-left-color: var(--text-muted); }
[data-slot="a"] .level-low .risk-icon { color: var(--text-muted); }
[data-slot="a"] .level-low .risk-level { color: var(--text-muted); }
[data-slot="a"] .risk-row.is-top { border-color: var(--bad); }
[data-slot="a"] .risk-row.is-top .risk-icon {
  animation: slot-a-risk-icon 1.6s ease-in-out infinite;
}
[data-slot="a"] .risk-row.is-top::after {
  content: ""; position: absolute; inset: 0; border-radius: 7px; pointer-events: none;
  border: 1px solid var(--bad); opacity: 0.2;
  animation: slot-a-risk-flash 1.6s ease-in-out infinite;
}
@keyframes slot-a-risk-flash {
  0%, 100% { opacity: 0.2; box-shadow: 0 0 0 var(--bad); }
  50% { opacity: 1; box-shadow: 0 0 20px var(--bad), inset 0 0 20px var(--bad); }
}
@keyframes slot-a-risk-icon {
  0%, 100% { box-shadow: 0 0 8px var(--bad); }
  50% { box-shadow: 0 0 20px var(--bad); }
}
@media (prefers-reduced-motion: reduce) {
  [data-slot="a"] .risk-row.is-top .risk-icon { animation: none; }
  [data-slot="a"] .risk-row.is-top::after { animation: none; opacity: 1; }
}
`;

export default {
  title: '风险预警',
  unit: '实时监测 · 模拟数据',
  render(el, ctx) {
    const doc = el.ownerDocument;
    const alerts = sortAlerts(createAlerts(ctx.data.seededRandom(ALERT_SEED)));

    const style = doc.createElement('style');
    style.textContent = STYLE;
    el.append(style);

    const summary = doc.createElement('div');
    summary.className = 'risk-summary';
    summary.innerHTML = `<span><b>${alerts.length}</b> 条预警</span><span>按严重程度排序</span>`;

    const list = doc.createElement('ul');
    list.className = 'risk-list';
    list.setAttribute('aria-label', '风险预警列表，按严重程度从高到低排序');

    alerts.forEach((alert, index) => {
      const meta = SEVERITY_META[alert.level] ?? SEVERITY_META.low;
      const isTop = index === 0;
      const item = doc.createElement('li');
      item.className = `risk-row level-${alert.level}${isTop ? ' is-top' : ''}`;
      item.setAttribute(
        'aria-label',
        `${meta.label}预警${isTop ? '（最高优先级）' : ''}：${alert.title}。${alert.detail}`,
      );
      item.innerHTML = `
        <span class="risk-icon" aria-hidden="true">${meta.icon}</span>
        <div class="risk-body">
          <div class="risk-head">
            <p class="risk-title">${alert.title}</p>
            <span class="risk-level">${meta.label}</span>
            <span class="risk-meta">${alert.meta}</span>
          </div>
          <p class="risk-detail">${alert.detail}</p>
        </div>`;
      list.append(item);
    });

    el.append(summary, list);
  },
};
