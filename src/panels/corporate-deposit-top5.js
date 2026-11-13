// 对公存款前五客户：固定种子的模拟数据，纯函数可单独测试。
// 设计画布 460 × 236，页面会整块等比缩放进格子，因此不读窗口尺寸、不写 @media。

const SEED = 20261112;
const TOP_TOTAL_YI = 862; // 前五合计的设计口径（亿元）
const DEPOSIT_BASE_YI = 2233; // 对公存款盘子（亿元，示意）
const CLIENT_NAMES = ['华信集团', '恒远能源', '中科制造', '城建控股', '瑞和医药'];
// 基线金额只决定前五名的相对大小；实际余额由 seededRandom 抖动、再按合计 862 归一，
// 保证每家都落在 80–260 亿元区间内。
const BASE_AMOUNTS = [229.8, 197.7, 194.6, 132.4, 107.5];

/** 按存款余额降序，返回新数组，不改动入参。 */
export function sortClients(list) {
  return [...list].sort((a, b) => b.value - a.value);
}

/** 五家客户余额合计（亿元）。 */
export function totalOf(list) {
  return list.reduce((sum, item) => sum + item.value, 0);
}

/** part 占 whole 的比例（%），保留 1 位小数；whole 为 0 时返回 0。 */
export function sharePct(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * 生成前五客户：先按基线抖动，再归一到合计约 862 亿元，最后降序。
 * rand 由调用方传入（页面用 ctx.data.seededRandom(20261112)），便于测试。
 */
export function buildTopClients(rand, { names = CLIENT_NAMES, total = TOP_TOTAL_YI } = {}) {
  const raw = names.map((name, i) => ({
    name,
    value: (BASE_AMOUNTS[i] ?? total / names.length) * (0.94 + rand() * 0.12),
  }));
  const sum = totalOf(raw);
  const k = sum ? total / sum : 0;
  return sortClients(raw.map(({ name, value }) => ({ name, value: Math.round(value * k * 10) / 10 })));
}

const STYLE = `
[data-panel="corporate-deposit-top5"] {
  color: var(--text-primary);
  font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-variant-numeric: tabular-nums;
}
[data-panel="corporate-deposit-top5"] .top5 {
  box-sizing: border-box;
  width: 460px;
  height: 236px;
  padding: 0 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  white-space: nowrap;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(79, 195, 255, 0.045), rgba(12, 16, 24, 0.1));
}
[data-panel="corporate-deposit-top5"] .top5 * {
  box-sizing: border-box;
  white-space: nowrap;
}
[data-panel="corporate-deposit-top5"] .top5-head {
  flex: 0 0 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid rgba(79, 163, 255, 0.14);
}
[data-panel="corporate-deposit-top5"] .top5-total {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
}
[data-panel="corporate-deposit-top5"] .top5-cap {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.06em;
}
[data-panel="corporate-deposit-top5"] .top5-total-num {
  font-size: 27px;
  line-height: 1;
  font-weight: 700;
  color: var(--accent);
  text-shadow: 0 0 14px rgba(79, 195, 255, 0.45);
}
[data-panel="corporate-deposit-top5"] .top5-total-unit {
  font-size: 11px;
  color: var(--text-secondary);
}
[data-panel="corporate-deposit-top5"] .top5-share {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 4px 7px;
  border: 1px solid rgba(79, 195, 255, 0.22);
  border-radius: 6px;
  background: rgba(79, 195, 255, 0.08);
}
[data-panel="corporate-deposit-top5"] .top5-share-num {
  font-size: 17px;
  line-height: 1;
  font-weight: 700;
  color: var(--accent);
}
[data-panel="corporate-deposit-top5"] .top5-share-note {
  font-size: 10px;
  color: var(--text-muted);
}
[data-panel="corporate-deposit-top5"] .top5-thead {
  flex: 0 0 18px;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 124px 70px;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  border-bottom: 1px solid rgba(79, 163, 255, 0.08);
}
[data-panel="corporate-deposit-top5"] .top5-thead span:nth-child(1) { text-align: center; }
[data-panel="corporate-deposit-top5"] .top5-thead span:nth-child(4) { text-align: right; }
[data-panel="corporate-deposit-top5"] .top5-rows {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
[data-panel="corporate-deposit-top5"] .top5-row {
  flex: 1 1 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 124px 70px;
  gap: 8px;
  align-items: center;
  border-bottom: 1px solid rgba(79, 163, 255, 0.08);
}
[data-panel="corporate-deposit-top5"] .top5-row:last-child { border-bottom: 0; }
[data-panel="corporate-deposit-top5"] .top5-row.is-top {
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(79, 195, 255, 0.09), rgba(79, 195, 255, 0));
}
[data-panel="corporate-deposit-top5"] .top5-rank {
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  color: var(--text-muted);
}
[data-panel="corporate-deposit-top5"] .top5-row.is-top .top5-rank {
  color: var(--accent);
  text-shadow: 0 0 8px rgba(79, 195, 255, 0.6);
}
[data-panel="corporate-deposit-top5"] .top5-client {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
[data-panel="corporate-deposit-top5"] .top5-name {
  font-size: 13px;
  color: var(--text-secondary);
}
[data-panel="corporate-deposit-top5"] .top5-row.is-top .top5-name {
  font-weight: 600;
  color: var(--text-primary);
}
[data-panel="corporate-deposit-top5"] .top5-badge {
  padding: 1px 5px;
  font-size: 10px;
  line-height: 1.4;
  color: var(--accent);
  border: 1px solid rgba(79, 195, 255, 0.45);
  border-radius: 4px;
  background: rgba(79, 195, 255, 0.12);
}
[data-panel="corporate-deposit-top5"] .top5-track {
  display: block;
  height: 10px;
  overflow: hidden;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.06);
}
[data-panel="corporate-deposit-top5"] .top5-fill {
  display: block;
  width: 0;
  height: 100%;
  border-radius: 5px;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0) 65%);
  transition: width 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
}
[data-panel="corporate-deposit-top5"] .top5-amount {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  color: var(--text-primary);
}
[data-panel="corporate-deposit-top5"] .top5-amount small {
  margin-left: 2px;
  font-size: 10px;
  font-weight: 400;
  color: var(--text-muted);
}
`;

function ensureStyle() {
  if (document.getElementById('corporate-deposit-top5-style')) return;
  const style = document.createElement('style');
  style.id = 'corporate-deposit-top5-style';
  style.textContent = STYLE;
  document.head.append(style);
}

export default {
  title: '对公存款前五客户',
  unit: '亿元 · 模拟数据',

  render(el, ctx) {
    ensureStyle();

    const rand = ctx.data.seededRandom(SEED);
    const clients = buildTopClients(rand);
    const total = totalOf(clients);
    const pct = sharePct(total, DEPOSIT_BASE_YI);
    const max = clients[0]?.value || 1;
    const color = ctx.colors.series[0];
    const format = ctx.metrics.formatYi;

    const rows = clients.map((client, i) => {
      const isTop = i === 0;
      const width = (client.value / max) * 100;
      return `
        <div class="top5-row${isTop ? ' is-top' : ''}">
          <span class="top5-rank">${i + 1}</span>
          <span class="top5-client">
            <span class="top5-name">${client.name}</span>
            ${isTop ? '<span class="top5-badge">★ 最大客户</span>' : ''}
          </span>
          <span class="top5-track"><span class="top5-fill" data-w="${width.toFixed(1)}%" style="background-color:${color}"></span></span>
          <span class="top5-amount">${format(client.value)}<small>亿</small></span>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="top5" role="img" aria-label="对公存款前五客户：合计 ${format(total)} 亿元，占对公存款 ${pct}%，第一名 ${clients[0].name}">
        <div class="top5-head">
          <div class="top5-total">
            <span class="top5-cap">前五合计</span>
            <span class="top5-total-num">${format(total)}</span>
            <span class="top5-total-unit">亿元</span>
          </div>
          <div class="top5-share">
            <span class="top5-cap">占对公存款</span>
            <span class="top5-share-num">${pct}%</span>
            <span class="top5-share-note">示意</span>
          </div>
        </div>
        <div class="top5-thead">
          <span>排名</span><span>客户</span><span>存款</span><span>余额</span>
        </div>
        <div class="top5-rows">${rows}</div>
      </div>`;

    const fills = [...el.querySelectorAll('.top5-fill')];
    const grow = () => fills.forEach((fill) => { fill.style.width = fill.dataset.w; });
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) grow();
    else requestAnimationFrame(() => requestAnimationFrame(grow));
  },
};
