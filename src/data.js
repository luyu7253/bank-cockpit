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
