import * as data from './data.js';
import * as metrics from './metrics.js';
import * as layout from './layout.js';
import * as charts from './charts.js';
import { kpiCard, gauges, countUp } from './widgets.js';
import { createChinaMap } from './map3d.js';
import { loadSlots } from './slots.js';

const { BANK_NAME, AS_OF, monthly, current, lastYear, revenueMix, branches, channels, nextTransaction, regulatory, finance, HQ, cityCoords } = data;
const { yoy, pointDelta, rankBy, formatYi, formatAmount, signed } = metrics;

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SERIES = [1, 2, 3, 4, 5].map((i) => css(`--series-${i}`));
const $ = (sel) => document.querySelector(sel);

// ---- 1920×1080 画布等比缩放，居中 ----
const screen = $('#screen');
function fit() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  screen.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px, ${(innerHeight - 1080 * s) / 2}px) scale(${s})`;
}
fit();
addEventListener('resize', fit);

$('[data-bank]').textContent = BANK_NAME;
$('[data-asof]').textContent = AS_OF;
const clock = $('[data-clock]');
const tick = () => { clock.textContent = new Date().toLocaleString('zh-CN', { hour12: false }); };
tick();
setInterval(tick, 1000);

// ---- 核心经营指标（8 项） ----
const f = finance;
const kpis = [
  { name: '存款余额', value: current.deposits, decimals: 1, unit: '亿元', delta: yoy(current.deposits, lastYear.deposits), good: 'up', trend: data.kpiTrend.deposits },
  { name: '贷款余额', value: current.loans, decimals: 1, unit: '亿元', delta: yoy(current.loans, lastYear.loans), good: 'up', trend: data.kpiTrend.loans },
  { name: '营业收入', value: f.revenue.now, decimals: 1, unit: '亿元', delta: yoy(f.revenue.now, f.revenue.lastYear), good: 'up', trend: f.revenue.trend },
  { name: '净利润', value: f.netProfit.now, decimals: 1, unit: '亿元', delta: yoy(f.netProfit.now, f.netProfit.lastYear), good: 'up', trend: f.netProfit.trend },
  { name: 'ROE', value: f.roe.now, decimals: 2, unit: '%', delta: pointDelta(f.roe.now, f.roe.lastYear), deltaUnit: ' pp', good: 'up', trend: f.roe.trend },
  { name: '净息差', value: f.nim.now, decimals: 2, unit: '%', delta: pointDelta(f.nim.now, f.nim.lastYear), deltaUnit: ' pp', good: 'up', trend: f.nim.trend },
  { name: '不良贷款率', value: current.nplRatio, decimals: 2, unit: '%', delta: pointDelta(current.nplRatio, lastYear.nplRatio), deltaUnit: ' pp', good: 'down', trend: data.kpiTrend.nplRatio },
  { name: '零售 AUM', value: f.retailAum.now, decimals: 0, unit: '亿元', delta: yoy(f.retailAum.now, f.retailAum.lastYear), good: 'up', trend: f.retailAum.trend },
];
$('[data-kpis]').append(...kpis.map((k, i) => kpiCard({ ...k, deltaText: signed(k.delta, k.deltaUnit ?? '%'), color: SERIES[i % 2 === 0 ? 0 : 2] })));

// ---- 存贷款趋势 ----
const trendSeries = [
  { key: 'deposits', name: '存款余额', color: SERIES[0] },
  { key: 'loans', name: '贷款余额', color: SERIES[1] },
];
$('[data-trend-legend]').innerHTML = trendSeries.map((s) => `<li><i style="background:${s.color}"></i>${s.name}</li>`).join('');
charts.lineChart($('[data-trend]'), { rows: monthly, series: trendSeries, unit: '亿元', format: formatYi, area: true, height: 200 });

// ---- 地图浮层：分行排名 / 收入结构 / 渠道 ----
const ranked = rankBy(branches, 'loans');
charts.barList($('[data-branches]'), {
  items: ranked.slice(0, 6).map((b) => ({ name: b.name, label: `${b.rank}. ${b.name.replace('分行', '')}`, value: b.loans })),
  color: SERIES[2], unit: '亿元', format: formatYi,
});
charts.barList($('[data-revenue]'), { items: revenueMix.slice(0, 4), color: SERIES[0], unit: '亿元', format: formatYi });
charts.segmentBar($('[data-channels]'), { items: channels, colors: SERIES });
$('[data-branch-count]').textContent = branches.length;

// ---- 监管指标 ----
gauges($('[data-gauges]'), regulatory);

// ---- 3D 地图 ----
let map = { pulse() {} };
fetch(new URL('../vendor/geo/china.json', import.meta.url))
  .then((r) => r.json())
  .then((geo) => {
    map = createChinaMap($('[data-map]'), {
      geo, hq: HQ, branches: ranked, coords: cityCoords,
      onHover(name, x, y) {
        if (!name) return charts.tip.hide();
        const b = branches.find((it) => name.startsWith(it.name.replace('分行', '')));
        charts.tip.show(`<b>${name}</b>${b ? `<div>${b.name}贷款余额<span>${formatYi(b.loans)} 亿元</span></div>` : '<div>暂未设立分行</div>'}`, x, y);
      },
    });
  })
  .catch((err) => { console.error('地图加载失败', err); $('[data-map]').textContent = '地图加载失败'; });

// ---- 实时交易：流水 + 地图飞线 + 今日累计 ----
const feed = $('[data-feed]');
const today = { count: 1_284_310, amount: 386.42 };
countUp($('[data-tx-count]'), today.count, { duration: 1600 });
countUp($('[data-tx-amount]'), today.amount, { decimals: 2, duration: 1600 });
let recent = [];
function pushTx() {
  const tx = nextTransaction();
  const prevCount = today.count, prevAmount = today.amount;
  today.count += 1 + Math.floor(Math.random() * 40);
  today.amount += tx.amount / 1e8;
  countUp($('[data-tx-count]'), today.count, { from: prevCount, duration: 600 });
  countUp($('[data-tx-amount]'), today.amount, { from: prevAmount, decimals: 2, duration: 600 });
  recent.push(Date.now());
  const big = tx.amount >= 10_000_000;
  const li = document.createElement('li');
  li.className = big ? 'big' : '';
  li.innerHTML = `<time>${tx.at.toLocaleTimeString('zh-CN', { hour12: false })}</time>
    <span>${tx.city}</span><span>${tx.type}</span>
    <b>${formatAmount(tx.amount)}</b>${big ? '<em>大额</em>' : ''}`;
  feed.prepend(li);
  while (feed.children.length > 10) feed.lastElementChild.remove();
  map.pulse(tx.city, tx.amount);
}
for (let i = 0; i < 10; i++) pushTx();
(function loop() { pushTx(); setTimeout(loop, 350 + Math.random() * 700); })();
setInterval(() => {
  const now = Date.now();
  recent = recent.filter((t) => now - t < 5000);
  $('[data-tps]').textContent = (recent.length * 1873 / 5 + Math.random() * 40).toFixed(0);
}, 1000);

// ---- AI 待建设区 ----
loadSlots({ data, metrics, layout, charts, colors: { series: SERIES, good: css('--good'), warn: css('--warn'), bad: css('--bad'), accent: css('--accent') } });
