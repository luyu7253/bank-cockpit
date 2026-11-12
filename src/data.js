// 模拟数据：固定随机种子，每次打开数字都一样，测试也可复现。
// 所有金额单位：亿元。数据纯属虚构，不代表任何真实机构。

export const BANK_NAME = '示范银行';
export const AS_OF = '2026-10';

/** 可复现的伪随机数（mulberry32）。 */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seededRandom(20261113);
const jitter = (base, pct) => base * (1 + (rand() * 2 - 1) * pct);

/** 近 24 个月存贷款余额（亿元）。 */
export const monthly = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(2024, 10 + i, 1);
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return {
    month,
    deposits: round(jitter(3200 + i * 38, 0.012)),
    loans: round(jitter(2450 + i * 31, 0.012)),
  };
});

/** 去年同期的核心指标，用于计算同比。 */
export const lastYear = { deposits: 3520, loans: 2700, nplRatio: 1.42, feeIncome: 41.8, newCustomers: 15600 };

/** 本期核心指标。 */
export const current = {
  deposits: monthly.at(-1).deposits,
  loans: monthly.at(-1).loans,
  nplRatio: 1.31, // 不良率 %
  feeIncome: 46.3, // 中间业务收入（亿元，年初至今）
  newCustomers: 18240, // 年初至今新增客户（户）
};

/** 营业收入结构（亿元，年初至今）。 */
export const revenueMix = [
  { name: '利息净收入', value: 118.6 },
  { name: '手续费及佣金', value: 46.3 },
  { name: '投资收益', value: 21.9 },
  { name: '汇兑收益', value: 6.4 },
  { name: '其他业务', value: 3.2 },
];

/** 分行贷款余额（亿元）。 */
export const branches = [
  ['上海分行', 486], ['北京分行', 412], ['深圳分行', 377], ['杭州分行', 298],
  ['南京分行', 251], ['成都分行', 214], ['武汉分行', 188], ['西安分行', 152],
  ['苏州分行', 143], ['重庆分行', 129],
].map(([name, loans]) => ({ name, loans }));

/** 交易渠道占比（笔数 %）。 */
export const channels = [
  { name: '手机银行', share: 71.4 },
  { name: '网上银行', share: 12.8 },
  { name: '柜面', share: 7.9 },
  { name: 'ATM', share: 5.2 },
  { name: '其他', share: 2.7 },
];

const TX_TYPES = ['转账', '代发工资', '理财申购', '信用卡还款', '贷款发放', '缴费', '外汇结汇'];
const CITIES = branches.map((b) => b.name.replace('分行', ''));

/** 生成一笔模拟实时交易。 */
export function nextTransaction(r = Math.random) {
  const type = TX_TYPES[Math.floor(r() * TX_TYPES.length)];
  const city = CITIES[Math.floor(r() * CITIES.length)];
  const amount = Math.round(10 ** (2 + r() * 4.5)); // 100 元 ~ 3000 万元，对数分布
  return { type, city, amount, at: new Date() };
}

function round(x) {
  return Math.round(x * 10) / 10;
}

/** 核心指标近 12 个月走势（用于指标卡里的迷你趋势线）。 */
export const kpiTrend = {
  deposits: monthly.slice(-12).map((m) => m.deposits),
  loans: monthly.slice(-12).map((m) => m.loans),
  nplRatio: [1.46, 1.45, 1.44, 1.44, 1.42, 1.41, 1.39, 1.38, 1.36, 1.34, 1.33, 1.31],
  feeIncome: [3.1, 3.4, 3.6, 3.5, 3.9, 4.0, 4.2, 4.1, 4.4, 4.6, 4.7, 4.8],
  newCustomers: [1210, 1330, 1290, 1420, 1510, 1480, 1600, 1650, 1720, 1690, 1810, 1880],
  activeUsers: [402, 410, 418, 425, 431, 440, 452, 461, 470, 478, 489, 497],
};

/** 月活手机银行用户（万户）。 */
export const activeUsers = { now: 497, lastYear: 401 };

/**
 * 监管指标：value 当前值，limit 监管红线，better 'high' 表示越高越安全，max 仪表盘满刻度。
 * 数值为虚构，红线取常见监管口径，仅作演示。
 */
export const regulatory = [
  { name: '资本充足率', value: 13.62, limit: 10.5, max: 20, unit: '%', better: 'high' },
  { name: '拨备覆盖率', value: 218.4, limit: 150, max: 300, unit: '%', better: 'high' },
  { name: '流动性覆盖率', value: 142.7, limit: 100, max: 200, unit: '%', better: 'high' },
  { name: '不良贷款率', value: 1.31, limit: 5, max: 6, unit: '%', better: 'low' },
];

/** 总行与分行坐标（经纬度，城市中心的近似值）。 */
export const HQ = { name: '上海总行', lon: 121.4737, lat: 31.2304 };
export const cityCoords = {
  上海: [121.4737, 31.2304], 北京: [116.4074, 39.9042], 深圳: [114.0579, 22.5431], 杭州: [120.1551, 30.2741],
  南京: [118.7969, 32.0603], 成都: [104.0665, 30.5723], 武汉: [114.3054, 30.5931], 西安: [108.9398, 34.3416],
  苏州: [120.5853, 31.2989], 重庆: [106.5516, 29.563],
};

/** 经营指标（年初至今，亿元 / %），lastYear 为去年同期。 */
export const finance = {
  revenue: { now: 196.4, lastYear: 178.2, trend: [14.1, 15.0, 15.8, 15.2, 16.4, 16.9, 17.3, 16.8, 17.9, 18.4, 18.8, 19.6] },
  netProfit: { now: 68.7, lastYear: 61.9, trend: [4.9, 5.2, 5.6, 5.3, 5.8, 6.0, 6.1, 5.9, 6.4, 6.6, 6.7, 7.0] },
  roe: { now: 11.86, lastYear: 11.42, trend: [11.2, 11.3, 11.3, 11.4, 11.5, 11.5, 11.6, 11.6, 11.7, 11.7, 11.8, 11.86] },
  nim: { now: 1.92, lastYear: 2.01, trend: [2.01, 2.0, 1.99, 1.98, 1.97, 1.96, 1.96, 1.95, 1.94, 1.93, 1.93, 1.92] },
  costIncome: { now: 28.4, lastYear: 29.6, trend: [29.6, 29.5, 29.3, 29.2, 29.1, 29.0, 28.9, 28.8, 28.7, 28.6, 28.5, 28.4] },
  retailAum: { now: 5268, lastYear: 4710, trend: [4710, 4752, 4801, 4855, 4903, 4950, 5004, 5060, 5112, 5160, 5221, 5268] },
};
