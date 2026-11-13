// 「反洗钱可疑交易监测」：顶部三项今日可疑交易 KPI，下方 3 条最新可疑交易。
// 数据用固定种子在面板内生成，每次打开完全一致；纯函数集中在本文件内，
// 测试只 import 这些函数，不依赖浏览器 DOM。
//
// 布局按 460 × 236 设计画布固定排版：KPI 行 70px + 列表标题 12px + 3 行 × 约 44px。
// 不读取窗口尺寸、不写 @media；呼吸（闪烁）提醒沿用 src/styles.css 的全局
// prefers-reduced-motion 规则统一关闭，且风险等级始终有图标 + 文字，不依赖动画表达。

/** 固定随机种子：每次打开面板，笔数、金额与时间都一致。 */
export const AML_SEED = 20261112;

/** 今日可疑交易总量与待核查/已处置的固定口径（两者相加等于总量）。 */
export const TOTAL_SUSPICIOUS = 37;
export const PENDING_COUNT = 8;

/** 各风险等级的固定分布：6 + 14 + 17 = 37。 */
export const LEVEL_TOTALS = { high: 6, medium: 14, low: 17 };

/** 风险等级元数据：图标 + 中文文字 + 状态色 + 排序序号（越小越紧急）。状态不只靠颜色表达。 */
export const LEVEL_META = {
  high: { label: '高风险', short: '高', icon: '⚠', rank: 0, tone: 'bad' },
  medium: { label: '中风险', short: '中', icon: '▲', rank: 1, tone: 'warn' },
  low: { label: '低风险', short: '低', icon: '●', rank: 2, tone: 'good' },
};

export const LEVEL_ORDER = ['high', 'medium', 'low'];

/** 可疑交易类型（全部虚构）。列表最上面 3 条固定展示前三种，便于演示。 */
export const SUSPICIOUS_TYPES = [
  '大额分散转入',
  '跨境频繁汇款',
  '夜间异常交易',
  '整数大额转账',
  '账户快进快出',
  '异地频繁交易',
];

const LATEST_COUNT = 3;
const pad2 = (n) => String(n).padStart(2, '0');

/** 把「一天中的第几分钟」格式化为 HH:MM（支持跨零点回绕）。 */
export function minutesToTime(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

/** 各风险等级的金额参考区间（万元），高风险金额更大、低风险金额更小。 */
const AMOUNT_RANGE = {
  high: [40, 100],
  medium: [8, 40],
  low: [0.5, 8],
};

function amountOf(level, r) {
  const [min, max] = AMOUNT_RANGE[level];
  return round1(min + r() * (max - min));
}

function shuffle(list, r) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * 统计一组可疑交易的各风险等级笔数（未知等级归入 other，不丢总数）。
 * 返回新对象，不修改入参。
 */
export function riskCounts(transactions = []) {
  const counts = { high: 0, medium: 0, low: 0, other: 0, total: 0 };
  for (const tx of Array.isArray(transactions) ? transactions : []) {
    counts.total += 1;
    if (tx?.level === 'high' || tx?.level === 'medium' || tx?.level === 'low') counts[tx.level] += 1;
    else counts.other += 1;
  }
  return counts;
}

/** 按风险等级从高到低排序；同等级按时间从近到远。返回新数组，不修改原数组。 */
export function sortByRisk(transactions = []) {
  return [...(Array.isArray(transactions) ? transactions : [])].sort(
    (a, b) =>
      (LEVEL_META[a?.level]?.rank ?? LEVEL_ORDER.length) - (LEVEL_META[b?.level]?.rank ?? LEVEL_ORDER.length) ||
      (b?.at ?? 0) - (a?.at ?? 0),
  );
}

/**
 * 生成今日可疑交易汇总（37 笔，风险分布 6 / 14 / 17，待核查 8、已处置 29）。
 * random 传入 ctx.data.seededRandom(AML_SEED) 可保证每次结果一致。
 * 返回：total、pending、disposed、counts、amountTotal、latest（最新 3 笔）、latestTotal、transactions。
 */
export function buildAmlSummary(random = Math.random) {
  const r = typeof random === 'function' ? random : Math.random;

  // 先按固定分布铺出风险等级，再打乱，保证任何种子下计数都不变。
  const levels = [];
  for (const level of LEVEL_ORDER) {
    for (let i = 0; i < LEVEL_TOTALS[level]; i += 1) levels.push(level);
  }
  shuffle(levels, r);

  // 最新 3 条按「高 → 中 → 低」各展示一条，方便一眼看清三种风险等级；
  // 最新一条固定高风险，用于演示轻微闪烁提醒；笔数分布不受影响。
  ['high', 'medium', 'low'].forEach((level, i) => {
    if (levels[i] === level) return;
    const from = levels.indexOf(level, i);
    [levels[i], levels[from]] = [levels[from], levels[i]];
  });

  const transactions = [];
  let minute = 15 * 60 + 42; // 从 15:42 起往前排，覆盖今日营业时段
  for (let i = 0; i < TOTAL_SUSPICIOUS; i += 1) {
    const level = levels[i];
    const at = minute;
    minute -= 5 + Math.floor(r() * 14); // 相邻两笔间隔 5–18 分钟
    const type = i < LATEST_COUNT ? SUSPICIOUS_TYPES[i] : SUSPICIOUS_TYPES[Math.floor(r() * SUSPICIOUS_TYPES.length) % SUSPICIOUS_TYPES.length];
    const amount = amountOf(level, r);
    transactions.push({
      id: `aml-${i + 1}`,
      type,
      level,
      amount,
      at,
      time: minutesToTime(at),
      // 最新的 8 笔待核查，其余 29 笔已处置，与顶部 KPI 口径一致。
      status: i < PENDING_COUNT ? 'pending' : 'disposed',
    });
  }

  const counts = riskCounts(transactions);
  const pending = transactions.filter((tx) => tx.status === 'pending').length;
  const disposed = transactions.filter((tx) => tx.status === 'disposed').length;
  const latest = transactions.slice(0, LATEST_COUNT);
  const amountTotal = round1(transactions.reduce((sum, tx) => sum + tx.amount, 0));
  const latestTotal = round1(latest.reduce((sum, tx) => sum + tx.amount, 0));

  return {
    total: counts.total,
    pending,
    disposed,
    counts,
    amountTotal,
    latest,
    latestTotal,
    transactions,
  };
}

// 说明：闪烁只在高风险条目的外框上，等级同时由「⚠ 高风险」图标、文字和状态色表达；
// prefers-reduced-motion 由 src/styles.css 的全局规则统一关闭动画，面板内不写 @media。
const STYLE = `
[data-panel="aml-monitoring"] {
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
[data-panel="aml-monitoring"] .am-wrap {
  height: 100%;
  padding: 5px 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
  white-space: nowrap;
}
[data-panel="aml-monitoring"] .am-kpis {
  flex: 0 0 70px;
  height: 70px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}
[data-panel="aml-monitoring"] .am-kpi {
  min-width: 0;
  height: 70px;
  padding: 5px 9px 6px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  border: 1px solid rgba(79, 163, 255, 0.2);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(79, 195, 255, 0.07), rgba(79, 195, 255, 0.015));
  overflow: hidden;
  white-space: nowrap;
}
[data-panel="aml-monitoring"] .am-kpi.is-total {
  border-color: rgba(79, 195, 255, 0.38);
  box-shadow: inset 0 1px 0 rgba(79, 195, 255, 0.16);
}
[data-panel="aml-monitoring"] .am-kpi-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  line-height: 1;
  color: var(--text-secondary);
  white-space: nowrap;
}
[data-panel="aml-monitoring"] .am-kpi-value {
  display: flex;
  align-items: baseline;
  gap: 3px;
  font-size: 21px;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--text-primary);
  white-space: nowrap;
}
[data-panel="aml-monitoring"] .am-kpi-value small {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-muted);
}
[data-panel="aml-monitoring"] .am-kpi.is-total .am-kpi-value { color: var(--am-series); text-shadow: 0 0 12px rgba(79, 195, 255, 0.35); }
[data-panel="aml-monitoring"] .am-kpi.is-pending .am-kpi-value { color: var(--am-warn); }
[data-panel="aml-monitoring"] .am-kpi.is-done .am-kpi-value { color: var(--am-good); }
[data-panel="aml-monitoring"] .am-kpi-sub {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 12px;
  font-size: 10px;
  line-height: 1;
  color: var(--text-muted);
  white-space: nowrap;
}
[data-panel="aml-monitoring"] .am-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
[data-panel="aml-monitoring"] .am-chip i {
  font-style: normal;
  font-size: 9px;
  line-height: 1;
}
[data-panel="aml-monitoring"] .am-chip.high { color: var(--am-bad); }
[data-panel="aml-monitoring"] .am-chip.medium { color: var(--am-warn); }
[data-panel="aml-monitoring"] .am-chip.low { color: var(--am-good); }
[data-panel="aml-monitoring"] .am-chip.good { color: var(--am-good); }
[data-panel="aml-monitoring"] .am-list-head {
  flex: 0 0 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
[data-panel="aml-monitoring"] .am-list-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  line-height: 1;
  color: var(--text-secondary);
  white-space: nowrap;
}
[data-panel="aml-monitoring"] .am-list-title::before {
  content: "";
  width: 3px;
  height: 10px;
  border-radius: 2px;
  background: var(--am-series);
  box-shadow: 0 0 6px var(--am-series);
}
[data-panel="aml-monitoring"] .am-list-meta {
  font-size: 11px;
  line-height: 1;
  color: var(--text-muted);
  white-space: nowrap;
}
[data-panel="aml-monitoring"] .am-list-meta b {
  color: var(--text-secondary);
  font-weight: 600;
}
[data-panel="aml-monitoring"] .am-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
[data-panel="aml-monitoring"] .am-row {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 9px;
  padding: 0 10px;
  border: 1px solid rgba(79, 163, 255, 0.18);
  border-left: 3px solid var(--am-level);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.02);
  background: linear-gradient(90deg, color-mix(in srgb, var(--am-level) 8%, transparent), rgba(255, 255, 255, 0.015));
  overflow: hidden;
  white-space: nowrap;
}
[data-panel="aml-monitoring"] .am-row.level-high,
[data-panel="aml-monitoring"] .am-badge.level-high { --am-level: var(--am-bad); }
[data-panel="aml-monitoring"] .am-row.level-medium,
[data-panel="aml-monitoring"] .am-badge.level-medium { --am-level: var(--am-warn); }
[data-panel="aml-monitoring"] .am-row.level-low,
[data-panel="aml-monitoring"] .am-badge.level-low { --am-level: var(--am-good); }
[data-panel="aml-monitoring"] .am-time {
  font-size: 11px;
  line-height: 1;
  color: var(--text-muted);
  white-space: nowrap;
}
[data-panel="aml-monitoring"] .am-type {
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
}
[data-panel="aml-monitoring"] .am-amount {
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  color: var(--text-primary);
  white-space: nowrap;
}
[data-panel="aml-monitoring"] .am-amount small {
  margin-left: 2px;
  font-size: 10px;
  font-weight: 400;
  color: var(--text-muted);
}
[data-panel="aml-monitoring"] .am-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 20px;
  padding: 0 7px;
  border: 1px solid var(--am-level);
  border-radius: 999px;
  color: var(--am-level);
  background: color-mix(in srgb, var(--am-level) 13%, transparent);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}
[data-panel="aml-monitoring"] .am-badge i {
  font-style: normal;
  font-size: 9px;
  line-height: 1;
}
[data-panel="aml-monitoring"] .am-row.is-alert::after {
  content: "";
  position: absolute;
  inset: 0;
  border: 1px solid color-mix(in srgb, var(--am-bad) 70%, transparent);
  border-radius: 7px;
  pointer-events: none;
  box-shadow: inset 0 0 10px color-mix(in srgb, var(--am-bad) 30%, transparent);
  opacity: 0.35;
  animation: am-blink 2.2s ease-in-out infinite;
}
@keyframes am-blink {
  0%, 100% { opacity: 0.18; box-shadow: inset 0 0 6px rgba(230, 103, 103, 0.16); }
  50% { opacity: 0.85; box-shadow: inset 0 0 12px rgba(230, 103, 103, 0.4); }
}
`;

function kpiCard(label, value, unit, subHtml, extraClass, valueClass) {
  return `<div class="am-kpi ${extraClass}" aria-label="${label} ${value} ${unit}${subHtml.text ? `，${subHtml.text}` : ''}">
    <span class="am-kpi-label">${label}</span>
    <span class="am-kpi-value ${valueClass}">${value}<small>${unit}</small></span>
    <span class="am-kpi-sub">${subHtml.html}</span>
  </div>`;
}

export default {
  title: '反洗钱可疑交易监测',
  unit: '今日 · 模拟数据',
  render(el, ctx) {
    const doc = el.ownerDocument;
    const colors = ctx.colors ?? {};
    el.style.setProperty('--am-good', colors.good ?? '#0ca30c');
    el.style.setProperty('--am-warn', colors.warn ?? '#fab219');
    el.style.setProperty('--am-bad', colors.bad ?? '#e66767');
    // 本面板没有多序列图表；标题前的标记按序列色顺序取第 1 个。
    el.style.setProperty('--am-series', colors.series?.[0] ?? colors.accent ?? '#4fc3ff');

    if (!el.querySelector('style[data-aml-monitoring]')) {
      const style = doc.createElement('style');
      style.dataset.amlMonitoring = '';
      style.textContent = STYLE;
      el.append(style);
    }

    const summary = buildAmlSummary(ctx.data.seededRandom(AML_SEED));
    const { counts } = summary;
    const disposedRate = summary.total ? Math.round((summary.disposed / summary.total) * 1000) / 10 : 0;

    const wrap = doc.createElement('div');
    wrap.className = 'am-wrap';

    const kpis = doc.createElement('div');
    kpis.className = 'am-kpis';
    kpis.innerHTML = [
      kpiCard(
        '今日可疑',
        summary.total,
        '笔',
        {
          text: `高风险 ${counts.high} 笔，中风险 ${counts.medium} 笔，低风险 ${counts.low} 笔`,
          html: `<span class="am-chip high"><i aria-hidden="true">${LEVEL_META.high.icon}</i>高 ${counts.high}</span>
            <span class="am-chip medium"><i aria-hidden="true">${LEVEL_META.medium.icon}</i>中 ${counts.medium}</span>
            <span class="am-chip low"><i aria-hidden="true">${LEVEL_META.low.icon}</i>低 ${counts.low}</span>`,
        },
        'is-total',
        '',
      ),
      kpiCard(
        '待核查',
        summary.pending,
        '笔',
        {
          text: '需人工复核',
          html: `<span class="am-chip medium"><i aria-hidden="true">◷</i>需人工复核</span>`,
        },
        'is-pending',
        '',
      ),
      kpiCard(
        '已处置',
        summary.disposed,
        '笔',
        {
          text: `处置率 ${disposedRate}%`,
          html: `<span class="am-chip good"><i aria-hidden="true">✓</i>处置率 ${disposedRate}%</span>`,
        },
        'is-done',
        '',
      ),
    ].join('');

    const head = doc.createElement('div');
    head.className = 'am-list-head';
    head.innerHTML = `<span class="am-list-title">最新可疑交易</span>
      <span class="am-list-meta">${summary.latest.length} 笔 · 合计 <b>${summary.latestTotal.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b> 万元</span>`;

    const list = doc.createElement('ul');
    list.className = 'am-list';
    list.setAttribute('aria-label', '最新可疑交易列表，共 3 笔');

    summary.latest.forEach((tx) => {
      const meta = LEVEL_META[tx.level] ?? LEVEL_META.low;
      const item = doc.createElement('li');
      item.className = `am-row level-${tx.level}${tx.level === 'high' ? ' is-alert' : ''}`;
      item.setAttribute(
        'aria-label',
        `${tx.time}，${tx.type}，金额 ${tx.amount} 万元，${meta.label}${tx.level === 'high' ? '，闪烁提醒' : ''}`,
      );
      item.innerHTML = `
        <time class="am-time" datetime="2026-11-12T${tx.time}">${tx.time}</time>
        <span class="am-type">${tx.type}</span>
        <span class="am-amount">${tx.amount.toFixed(1)}<small>万元</small></span>
        <span class="am-badge level-${tx.level}"><i aria-hidden="true">${meta.icon}</i>${meta.label}</span>`;
      list.append(item);
    });

    wrap.append(kpis, head, list);
    el.append(wrap);
  },
};
