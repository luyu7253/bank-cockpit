import { BANK_NAME, AS_OF, monthly, current, lastYear, revenueMix, branches, channels, nextTransaction } from './data.js';
import { yoy, pointDelta, rankBy, formatYi, formatAmount, signed } from './metrics.js';
import { lineChart, barList, segmentBar } from './charts.js';

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SERIES = [1, 2, 3, 4, 5].map((i) => css(`--series-${i}`));

document.querySelector('[data-bank]').textContent = BANK_NAME;
document.querySelector('[data-asof]').textContent = AS_OF;

// ---- 时钟 ----
const clock = document.querySelector('[data-clock]');
const tick = () => { clock.textContent = new Date().toLocaleString('zh-CN', { hour12: false }); };
tick();
setInterval(tick, 1000);

// ---- 核心指标 ----
// good: 'up' 表示上升为好，'down' 表示下降为好（如不良率）
const kpis = [
  { name: '存款余额', value: formatYi(current.deposits), unit: '亿元', delta: yoy(current.deposits, lastYear.deposits), good: 'up' },
  { name: '贷款余额', value: formatYi(current.loans), unit: '亿元', delta: yoy(current.loans, lastYear.loans), good: 'up' },
  { name: '不良贷款率', value: current.nplRatio.toFixed(2), unit: '%', delta: pointDelta(current.nplRatio, lastYear.nplRatio), deltaUnit: ' pp', good: 'down' },
  { name: '中间业务收入', value: formatYi(current.feeIncome), unit: '亿元', delta: yoy(current.feeIncome, lastYear.feeIncome), good: 'up' },
  { name: '新增客户', value: current.newCustomers.toLocaleString('zh-CN'), unit: '户', delta: yoy(current.newCustomers, lastYear.newCustomers), good: 'up' },
];
document.querySelector('[data-kpis]').innerHTML = kpis.map((k) => {
  const better = k.delta === 0 ? null : (k.delta > 0) === (k.good === 'up');
  const state = better === null ? 'flat' : better ? 'good' : 'bad';
  const arrow = k.delta > 0 ? '▲' : k.delta < 0 ? '▼' : '■';
  return `<article class="kpi">
    <h3>${k.name}</h3>
    <p class="kpi-value">${k.value}<small>${k.unit}</small></p>
    <p class="kpi-delta ${state}"><span aria-hidden="true">${arrow}</span> 同比 ${signed(k.delta, k.deltaUnit ?? '%')}</p>
  </article>`;
}).join('');

// ---- 存贷款趋势 ----
const trendSeries = [
  { key: 'deposits', name: '存款余额', color: SERIES[0] },
  { key: 'loans', name: '贷款余额', color: SERIES[1] },
];
document.querySelector('[data-trend-legend]').innerHTML = trendSeries
  .map((s) => `<li><i style="background:${s.color}"></i>${s.name}</li>`).join('');
const drawTrend = () => lineChart(document.querySelector('[data-trend]'), { rows: monthly, series: trendSeries, unit: '亿元', format: formatYi });
drawTrend();

// ---- 收入结构 ----
barList(document.querySelector('[data-revenue]'), { items: revenueMix, color: SERIES[0], unit: '亿元', format: formatYi });

// ---- 分行排名 ----
barList(document.querySelector('[data-branches]'), {
  items: rankBy(branches, 'loans').slice(0, 8).map((b) => ({ name: b.name, label: `${b.rank}. ${b.name}`, value: b.loans })),
  color: SERIES[2], unit: '亿元', format: formatYi,
});

// ---- 渠道占比 ----
segmentBar(document.querySelector('[data-channels]'), { items: channels, colors: SERIES });

// ---- 实时交易 ----
const feed = document.querySelector('[data-feed]');
const counter = document.querySelector('[data-tx-count]');
let txCount = 1_284_310;
function pushTx() {
  const tx = nextTransaction();
  txCount += 1 + Math.floor(Math.random() * 40);
  counter.textContent = txCount.toLocaleString('zh-CN');
  const li = document.createElement('li');
  const big = tx.amount >= 10_000_000;
  li.className = big ? 'big' : '';
  li.innerHTML = `<time>${tx.at.toLocaleTimeString('zh-CN', { hour12: false })}</time>
    <span>${tx.city}</span><span>${tx.type}</span>
    <b>${formatAmount(tx.amount)}</b>${big ? '<em>大额</em>' : ''}`;
  feed.prepend(li);
  while (feed.children.length > 9) feed.lastElementChild.remove();
}
for (let i = 0; i < 9; i++) pushTx();
setInterval(pushTx, 1600);

window.addEventListener('resize', drawTrend);
