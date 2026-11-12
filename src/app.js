import * as data from './data.js';
import * as metrics from './metrics.js';
import * as layout from './layout.js';
import * as charts from './charts.js';
import { kpiCard, gauges, countUp } from './widgets.js';
import { branchNetwork } from './network.js';
import { loadSlots } from './slots.js';

const { BANK_NAME, AS_OF, monthly, current, lastYear, revenueMix, branches, channels, nextTransaction, kpiTrend, activeUsers, regulatory } = data;
const { yoy, pointDelta, rankBy, formatYi, formatAmount, signed } = metrics;

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SERIES = [1, 2, 3, 4, 5].map((i) => css(`--series-${i}`));
const $ = (sel) => document.querySelector(sel);

$('[data-bank]').textContent = BANK_NAME;
$('[data-asof]').textContent = AS_OF;

// ---- 时钟 ----
const clock = $('[data-clock]');
const tick = () => { clock.textContent = new Date().toLocaleString('zh-CN', { hour12: false }); };
tick();
setInterval(tick, 1000);

// ---- 核心指标 ----
const kpis = [
  { name: '存款余额', value: current.deposits, decimals: 1, unit: '亿元', delta: yoy(current.deposits, lastYear.deposits), good: 'up', trend: kpiTrend.deposits },
  { name: '贷款余额', value: current.loans, decimals: 1, unit: '亿元', delta: yoy(current.loans, lastYear.loans), good: 'up', trend: kpiTrend.loans },
  { name: '不良贷款率', value: current.nplRatio, decimals: 2, unit: '%', delta: pointDelta(current.nplRatio, lastYear.nplRatio), deltaUnit: ' pp', good: 'down', trend: kpiTrend.nplRatio },
  { name: '中间业务收入', value: current.feeIncome, decimals: 1, unit: '亿元', delta: yoy(current.feeIncome, lastYear.feeIncome), good: 'up', trend: kpiTrend.feeIncome },
  { name: '新增客户', value: current.newCustomers, unit: '户', delta: yoy(current.newCustomers, lastYear.newCustomers), good: 'up', trend: kpiTrend.newCustomers },
  { name: '手机银行月活', value: activeUsers.now, unit: '万户', delta: yoy(activeUsers.now, activeUsers.lastYear), good: 'up', trend: kpiTrend.activeUsers },
];
$('[data-kpis]').append(...kpis.map((k, i) => kpiCard({ ...k, deltaText: signed(k.delta, k.deltaUnit ?? '%'), color: SERIES[i % 2 === 0 ? 0 : 2] })));

// ---- 存贷款趋势 ----
const trendSeries = [
  { key: 'deposits', name: '存款余额', color: SERIES[0] },
  { key: 'loans', name: '贷款余额', color: SERIES[1] },
];
$('[data-trend-legend]').innerHTML = trendSeries.map((s) => `<li><i style="background:${s.color}"></i>${s.name}</li>`).join('');
const drawTrend = () => charts.lineChart($('[data-trend]'), { rows: monthly, series: trendSeries, unit: '亿元', format: formatYi, area: true, height: 220 });
drawTrend();
window.addEventListener('resize', drawTrend);

// ---- 收入结构 / 渠道 ----
charts.barList($('[data-revenue]'), { items: revenueMix, color: SERIES[0], unit: '亿元', format: formatYi });
charts.segmentBar($('[data-channels]'), { items: channels, colors: SERIES });

// ---- 监管指标 ----
gauges($('[data-gauges]'), regulatory);

// ---- 分行网络 ----
const net = branchNetwork($('[data-network]'), { branches: rankBy(branches, 'loans') });

// ---- 实时交易：流水 + 网络粒子 + 今日累计 ----
const feed = $('[data-feed]');
const today = { count: 1_284_310, amount: 386.42 };
countUp($('[data-tx-count]'), today.count, { duration: 1600 });
countUp($('[data-tx-amount]'), today.amount, { decimals: 2, duration: 1600 });
let lastSec = [];
function pushTx() {
  const tx = nextTransaction();
  const prevCount = today.count, prevAmount = today.amount;
  today.count += 1 + Math.floor(Math.random() * 40);
  today.amount += tx.amount / 1e8;
  countUp($('[data-tx-count]'), today.count, { from: prevCount, duration: 600 });
  countUp($('[data-tx-amount]'), today.amount, { from: prevAmount, decimals: 2, duration: 600 });
  lastSec.push(Date.now());
  const big = tx.amount >= 10_000_000;
  const li = document.createElement('li');
  li.className = big ? 'big' : '';
  li.innerHTML = `<time>${tx.at.toLocaleTimeString('zh-CN', { hour12: false })}</time>
    <span>${tx.city}</span><span>${tx.type}</span>
    <b>${formatAmount(tx.amount)}</b>${big ? '<em>大额</em>' : ''}`;
  feed.prepend(li);
  while (feed.children.length > 8) feed.lastElementChild.remove();
  net.pulse(tx.city, tx.amount);
}
for (let i = 0; i < 8; i++) pushTx();
(function loop() { pushTx(); setTimeout(loop, 500 + Math.random() * 900); })();
setInterval(() => {
  const now = Date.now();
  lastSec = lastSec.filter((t) => now - t < 5000);
  $('[data-tps]').textContent = (lastSec.length * 1873 / 5 + Math.random() * 40).toFixed(0);
}, 1000);

// ---- AI 待建设区 ----
loadSlots({ data, metrics, layout, charts, colors: { series: SERIES, good: css('--good'), warn: css('--warn'), bad: css('--bad'), accent: css('--accent') } });
