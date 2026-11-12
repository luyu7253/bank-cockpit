import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dir = new URL('../src/panels/', import.meta.url);
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')) : [];

test('面板文件名只用小写英文、数字和连字符', () => {
  for (const f of files) assert.match(f, /^[a-z0-9][a-z0-9-]*\.js$/, f);
});

for (const f of files) {
  test(`面板 ${f}：默认导出 { title, render }`, async () => {
    const mod = await import(new URL(f, dir));
    const p = mod.default;
    assert.equal(typeof p, 'object', '必须 export default 一个对象');
    assert.equal(typeof p.title, 'string');
    assert.ok(p.title.trim().length > 0 && p.title.length <= 12, '标题 1–12 个字');
    assert.equal(typeof p.render, 'function');
  });
}
