// 「风险预警」：4 条模拟预警，按严重程度从高到低排序，最严重一条做呼吸提醒。
// 纯函数集中在本文件内，测试只 import 这些函数，不依赖浏览器 DOM。

/** 固定随机种子：每次打开面板，预警数值与时间都一致。 */
export const ALERT_SEED = 20261112;

/** 严重程度元数据：图标 + 中文文字 + 排序序号（越小越严重）。状态不只靠颜色表达。 */
export const LEVEL_META = {
  critical: { label: '严重', icon: '⚠', rank: 0 },
  warning: { label: '警告', icon: '▲', rank: 1 },
  info: { label: '提示', icon: '●', rank: 2 },
};

/** 兜底分行名：只在调用方没有传入分行列表时使用，均为虚构名称。 */
const FALLBACK_BRANCHES = ['城北分行', '滨江分行', '科技园分行', '临港分行'];

const pad2 = (n) => String(n).padStart(2, '0');

/** 把「一天中的第几分钟」格式化为 HH:MM。 */
export function minutesToTime(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function branchNameList(branches) {
  if (!Array.isArray(branches)) return [];
  return branches
    .map((branch) => (typeof branch === 'string' ? branch : branch?.name))
    .filter((name) => typeof name === 'string' && name.trim().length > 0);
}

/**
 * 生成 4 条模拟预警（已按严重程度排序）。
 * random 传入 ctx.data.seededRandom(ALERT_SEED) 可保证每次结果一致；
 * branches 传入 ctx.data.branches，分行名全部来自模拟数据。
 */
export function createAlerts(random = Math.random, branches = []) {
  const r = typeof random === 'function' ? random : Math.random;
  const names = branchNameList(branches);
  const pool = names.length > 0 ? names : FALLBACK_BRANCHES;
  const branch = pool[Math.floor(r() * pool.length) % pool.length];

  // 数值区间刻意贴近演示口径；固定种子下约为 4.86%、2,860 万元、3.24 亿元、42.1%。
  const npl = round(4.8 + r() * 0.16, 2); // 4.80% ~ 4.96%，逼近 5% 红线但未越线
  const largeTx = Math.round((2490 + r() * 500) / 10) * 10; // 2,490 ~ 2,990 万元
  const outflow = round(2.81 + r() * 0.6, 2); // 2.81 ~ 3.41 亿元
  const concentration = round(40.5 + r() * 8, 1); // 40.5% ~ 48.5%

  let minute = 14 * 60 + 32;
  const stamp = () => {
    const at = minute;
    minute -= 10 + Math.floor(r() * 18);
    return at;
  };

  const nplAt = stamp();
  const txAt = stamp();
  const outflowAt = stamp();
  const concentrationAt = stamp();

  return [
    {
      id: 'npl',
      level: 'critical',
      at: nplAt,
      time: minutesToTime(nplAt),
      title: `${branch}不良率 ${npl.toFixed(2)}%，逼近 5% 监管红线`,
    },
    {
      id: 'large-tx',
      level: 'warning',
      at: txAt,
      time: minutesToTime(txAt),
      title: `单笔大额交易 ${largeTx.toLocaleString('zh-CN')} 万元`,
    },
    {
      id: 'outflow',
      level: 'warning',
      at: outflowAt,
      time: minutesToTime(outflowAt),
      title: `存款日间净流出 ${outflow.toFixed(2)} 亿元`,
    },
    {
      id: 'top5-loans',
      level: 'info',
      at: concentrationAt,
      time: minutesToTime(concentrationAt),
      title: `前 5 大客户贷款占比 ${concentration.toFixed(1)}%`,
    },
  ];
}

/** 严重程度序号：越小越严重，未知级别排在最后。 */
export function severityRank(level) {
  return LEVEL_META[level]?.rank ?? Object.keys(LEVEL_META).length;
}

/** 按严重程度从高到低排序；同级别按时间从近到远。返回新数组，不修改原数组。 */
export function sortAlerts(alerts = []) {
  return [...alerts].sort(
    (a, b) => severityRank(a?.level) - severityRank(b?.level) || (b?.at ?? 0) - (a?.at ?? 0),
  );
}

/** 最严重的一条；空列表返回 null。 */
export function topAlert(alerts = []) {
  return sortAlerts(alerts)[0] ?? null;
}

/** 统计各严重程度的条数，供面板顶部摘要与测试使用。 */
export function summaryOf(alerts = []) {
  const summary = { total: 0, critical: 0, warning: 0, info: 0, other: 0 };
  for (const alert of Array.isArray(alerts) ? alerts : []) {
    summary.total += 1;
    const level = alert?.level;
    if (level === 'critical' || level === 'warning' || level === 'info') summary[level] += 1;
    else summary.other += 1;
  }
  return summary;
}

// 说明：呼吸动效只在最严重一行，且信息同时由「⚠ 严重」文字、图标和描边表达；
// prefers-reduced-motion 由 src/styles.css 的全局规则统一关闭动画，面板内不写 @media。
const STYLE = `
[data-panel="risk-alerts"] {
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
[data-panel="risk-alerts"] .ra-wrap {
  height: 100%;
  padding: 6px 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
  white-space: nowrap;
}
[data-panel="risk-alerts"] .ra-summary {
  flex: none;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  line-height: 16px;
  color: var(--text-muted);
  white-space: nowrap;
}
[data-panel="risk-alerts"] .ra-sum b {
  color: var(--ra-accent);
  font-size: 12px;
  font-weight: 700;
}
[data-panel="risk-alerts"] .ra-counts {
  display: flex;
  align-items: center;
  gap: 9px;
  white-space: nowrap;
}
[data-panel="risk-alerts"] .ra-count {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}
[data-panel="risk-alerts"] .ra-count i {
  font-style: normal;
  font-size: 9px;
  line-height: 1;
}
[data-panel="risk-alerts"] .ra-count.critical { color: var(--ra-bad); }
[data-panel="risk-alerts"] .ra-count.warning { color: var(--ra-warn); }
[data-panel="risk-alerts"] .ra-count.info { color: var(--ra-accent); }
[data-panel="risk-alerts"] .ra-count b {
  color: currentColor;
  font-size: 11px;
  font-weight: 700;
}
[data-panel="risk-alerts"] .ra-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
[data-panel="risk-alerts"] .ra-row {
  position: relative;
  flex: 0 0 48px;
  height: 48px;
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid rgba(79, 163, 255, 0.18);
  border-left: 3px solid var(--ra-level);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.02);
  background: color-mix(in srgb, var(--ra-level) 6%, rgba(255, 255, 255, 0.015));
  white-space: nowrap;
}
[data-panel="risk-alerts"] .ra-row.level-critical { --ra-level: var(--ra-bad); }
[data-panel="risk-alerts"] .ra-row.level-warning { --ra-level: var(--ra-warn); }
[data-panel="risk-alerts"] .ra-row.level-info { --ra-level: var(--ra-accent); }
[data-panel="risk-alerts"] .ra-row.is-top {
  border-color: var(--ra-bad);
  background: rgba(255, 255, 255, 0.02);
  background: linear-gradient(90deg, color-mix(in srgb, var(--ra-bad) 15%, transparent), color-mix(in srgb, var(--ra-bad) 3%, transparent));
}
[data-panel="risk-alerts"] .ra-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 7px;
  border: 1px solid var(--ra-level);
  border-radius: 999px;
  color: var(--ra-level);
  background: color-mix(in srgb, var(--ra-level) 14%, transparent);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}
[data-panel="risk-alerts"] .ra-icon {
  font-size: 11px;
  line-height: 1;
}
[data-panel="risk-alerts"] .ra-title {
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.01em;
  color: var(--text-primary);
  white-space: nowrap;
}
[data-panel="risk-alerts"] .ra-time {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}
[data-panel="risk-alerts"] .ra-row.is-top::after {
  content: "";
  position: absolute;
  inset: -1px;
  border: 1px solid var(--ra-bad);
  border-radius: 7px;
  pointer-events: none;
  box-shadow: 0 0 10px var(--ra-bad), inset 0 0 10px color-mix(in srgb, var(--ra-bad) 55%, transparent);
  opacity: 0.2;
  animation: ra-breathe 1.9s ease-in-out infinite;
}
@keyframes ra-breathe {
  0%, 100% { opacity: 0.18; }
  50% { opacity: 0.78; }
}
`;

export default {
  title: '风险预警',
  unit: '实时 · 模拟数据',
  render(el, ctx) {
    const doc = el.ownerDocument;
    const colors = ctx.colors ?? {};
    el.style.setProperty('--ra-bad', colors.bad ?? '#e66767');
    el.style.setProperty('--ra-warn', colors.warn ?? '#fab219');
    el.style.setProperty('--ra-accent', colors.accent ?? '#4fc3ff');

    if (!el.querySelector('style[data-risk-alerts]')) {
      const style = doc.createElement('style');
      style.dataset.riskAlerts = '';
      style.textContent = STYLE;
      el.append(style);
    }

    const alerts = sortAlerts(createAlerts(ctx.data.seededRandom(ALERT_SEED), ctx.data.branches));
    const summary = summaryOf(alerts);

    const wrap = doc.createElement('div');
    wrap.className = 'ra-wrap';

    const head = doc.createElement('div');
    head.className = 'ra-summary';
    head.innerHTML = `<span class="ra-sum"><b>${summary.total}</b> 条实时预警</span>
      <span class="ra-counts" aria-label="按严重程度统计">
        <span class="ra-count critical"><i aria-hidden="true">${LEVEL_META.critical.icon}</i>${LEVEL_META.critical.label} <b>${summary.critical}</b></span>
        <span class="ra-count warning"><i aria-hidden="true">${LEVEL_META.warning.icon}</i>${LEVEL_META.warning.label} <b>${summary.warning}</b></span>
        <span class="ra-count info"><i aria-hidden="true">${LEVEL_META.info.icon}</i>${LEVEL_META.info.label} <b>${summary.info}</b></span>
      </span>`;

    const list = doc.createElement('ul');
    list.className = 'ra-list';
    list.setAttribute('aria-label', '风险预警列表，按严重程度从高到低排序');

    alerts.forEach((alert, index) => {
      const meta = LEVEL_META[alert.level] ?? LEVEL_META.info;
      const item = doc.createElement('li');
      item.className = `ra-row level-${alert.level}${index === 0 ? ' is-top' : ''}`;
      item.setAttribute(
        'aria-label',
        `${meta.label}预警${index === 0 ? '（最高优先级）' : ''}：${alert.title}，时间 ${alert.time}`,
      );
      item.innerHTML = `
        <span class="ra-badge"><span class="ra-icon" aria-hidden="true">${meta.icon}</span>${meta.label}</span>
        <span class="ra-title">${alert.title}</span>
        <time class="ra-time" datetime="2026-11-12T${alert.time}">${alert.time}</time>`;
      list.append(item);
    });

    wrap.append(head, list);
    el.append(wrap);
  },
};
