// 手动岗位与投递跟踪的数据层校验。在 Node 里跑：node tests/manual-db.test.js
// 沙箱没有真正的 IndexedDB，所以只验证参数校验和错误路径；完整读写靠浏览器手测。
import fs from "fs";
import assert from "assert";
import vm from "vm";

const sandbox = {
  globalThis: null,
  indexedDB: {
    open: () => {
      const request = { onupgradeneeded: null, onsuccess: null, onerror: null, result: null, error: null };
      queueMicrotask(() => {
        request.error = new Error("本地数据库打不开（测试沙箱没有 IndexedDB 实现）");
        if (typeof request.onerror === "function") request.onerror();
      });
      return request;
    },
  },
  chrome: { storage: { local: { get: async () => ({}), set: async () => ({}), remove: async () => ({}) } } },
  crypto: { randomUUID: () => "u1" },
};
sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync("db.js", "utf8"), sandbox);
const db = sandbox.BossJdDB;

// 参数缺失要直接报错，不碰数据库
await assert.rejects(db.saveManualJob(), /公司和职位都要填写/);
await assert.rejects(db.saveManualJob({ company: "", title: "x", description: "y" }), /公司和职位都要填写/);
await assert.rejects(db.saveManualJob({ company: "a", title: "b", description: "" }), /请粘贴岗位正文/);

// 状态白名单先于查库校验，缺 id 也直接报错
await assert.rejects(db.updateTracking("x", { applyStatus: "不认识" }), /未知的投递状态/);
await assert.rejects(db.updateTracking("", { applyStatus: "已投" }), /缺少岗位标识/);

// 正常路径在沙箱里走到 IndexedDB 才会失败，证明校验通过、请求已发出
await assert.rejects(
  db.saveManualJob({ company: "甲", title: "测试", description: "正文" }),
  /本地数据库打不开/
);

fs.writeFileSync("tests/last-run.txt", "manual job + tracking validation ok\n");
