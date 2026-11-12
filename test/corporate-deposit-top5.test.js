import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTopClients, sharePct, sortClients, totalOf } from '../src/panels/corporate-deposit-top5.js';

const NAMES = ['华信集团', '恒远能源', '中科制造', '城建控股', '瑞和医药'];

/** 按顺序返回预设的随机数，用完后固定 0.5，保证测试可复现。 */
function seqRandom(values) {
  let i = 0;
  return () => values[i++] ?? 0.5;
}

test('sortClients：按余额降序且不修改入参', () => {
  const input = [
    { name: '甲', value: 120.5 },
    { name: '乙', value: 240.2 },
    { name: '丙', value: 180.9 },
  ];
  const sorted = sortClients(input);
  assert.deepEqual(sorted.map((c) => c.value), [240.2, 180.9, 120.5]);
  assert.deepEqual(input.map((c) => c.value), [120.5, 240.2, 180.9]);
});

test('sharePct：占比保留 1 位小数，分母为 0 时返回 0', () => {
  assert.equal(sharePct(862, 2233), 38.6);
  assert.equal(sharePct(1, 3), 33.3);
  assert.equal(sharePct(500, 1000), 50);
  assert.equal(sharePct(120, 0), 0);
});

test('totalOf：合计由数据计算', () => {
  assert.equal(totalOf([{ value: 100.5 }, { value: 200 }, { value: 0.5 }]), 301);
  assert.equal(totalOf([]), 0);
});

test('buildTopClients：五家虚构客户、余额在 80–260 亿元并降序', () => {
  const clients = buildTopClients(seqRandom([0.1, 0.3, 0.5, 0.7, 0.9]));

  assert.equal(clients.length, 5);
  assert.deepEqual(clients.map((c) => c.name).sort(), [...NAMES].sort());
  for (const client of clients) {
    assert.ok(client.value >= 80 && client.value <= 260, `${client.name} 余额 ${client.value} 超出 80–260`);
  }
  for (let i = 1; i < clients.length; i += 1) {
    assert.ok(clients[i - 1].value >= clients[i].value, '必须按存款余额降序');
  }
});

test('buildTopClients：合计约 862 亿元，同一种子可复现', () => {
  const first = buildTopClients(seqRandom([0.05, 0.22, 0.48, 0.66, 0.94]));
  const second = buildTopClients(seqRandom([0.05, 0.22, 0.48, 0.66, 0.94]));

  assert.deepEqual(first, second);
  assert.ok(Math.abs(totalOf(first) - 862) <= 0.5, `合计 ${totalOf(first)} 偏离 862 过多`);
});

test('buildTopClients：自定义客户名也保持降序与合计口径', () => {
  const clients = buildTopClients(seqRandom([0.2, 0.4, 0.6, 0.8, 1]), {
    names: ['A 集团', 'B 集团', 'C 集团', 'D 集团', 'E 集团'],
  });
  assert.deepEqual(clients.map((c) => c.name).sort(), ['A 集团', 'B 集团', 'C 集团', 'D 集团', 'E 集团']);
  assert.ok(Math.abs(totalOf(clients) - 862) <= 0.5);
});
