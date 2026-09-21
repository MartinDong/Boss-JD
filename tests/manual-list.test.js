// 手动在浏览器打开本文件旁边的 list-fixture.html 前先用 node 跑一遍：
//   node tests/manual-list.test.js
// 通过 vm 沙箱 + 最小 DOM 桩验证 list-extract.js 的文本行兜底解析路径；
// 选择器路径请用浏览器打开 tests/list-fixture.html 后在控制台执行
//   BossJdList.extractList()
// 该脚本不写任何文件、不访问网络。
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.join(__dirname, "..");

function textNode(text) {
  return { innerText: text };
}

function element({ text = "", attrs = {}, children = [], selfText }) {
  return {
    attrs,
    children,
    innerText: selfText !== undefined ? selfText : text,
    getAttribute(name) {
      return attrs[name] ?? null;
    },
    querySelector(selector) {
      if (!children.length) return null;
      if (/a\[href\*='\/job_detail\/'\]|^a$/.test(selector) && attrs.href) return element({ attrs });
      const hit = children.find((child) => child.attrs?.href);
      if (hit && /job_detail|^a$/.test(selector)) return hit;
      return null;
    },
    querySelectorAll(selector) {
      if (/tag-list|job-tags|job-card-footer/.test(selector) && selector !== undefined) return [];
      return children;
    },
  };
}

// 典型列表卡片的纯文本（类名失配时兜底解析要吃的行结构）。
const cardLines = [
  "大模型应用工程师",
  "25-50K·16薪",
  "北京·朝阳区·望京",
  "3-5年",
  "本科",
  "Python",
  "RAG",
  "Agent",
  "示例智能科技",
  "人工智能 / 已上市 / 1000-9999人",
  "张女士·招聘经理",
].join("\n");

const card = element({
  children: [
    element({ attrs: { href: "/job_detail/abc123.html" } }),
  ],
  selfText: cardLines,
});

const sandbox = {
  globalThis: null,
  location: {
    href: "https://www.zhipin.com/web/geek/jobs?city=101010100",
    pathname: "/web/geek/jobs",
    search: "?city=101010100",
    origin: "https://www.zhipin.com",
  },
  document: {
    title: "「北京招聘」- BOSS直聘",
    querySelector: () => null,
    querySelectorAll: () => [card],
  },
  URL: URL,
  console,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

vm.runInContext(fs.readFileSync(path.join(root, "extract.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "list-extract.js"), "utf8"), sandbox);

const api = sandbox.globalThis.BossJdList;
if (!api) throw new Error("BossJdList 没挂到 globalThis");
if (!api.isListPage()) throw new Error("isListPage 应识别 /web/geek/jobs");

const result = api.extractList();
if (!result.ok) throw new Error(`extractList 失败：${result.message}`);
if (result.jobs.length !== 1) throw new Error(`应解析出 1 条，实际 ${result.jobs.length}`);

const job = result.jobs[0];
const expect = (label, actual, wanted) => {
  if (actual !== wanted) throw new Error(`${label} 期望「${wanted}」，实际「${actual}」`);
};

expect("jobId", job.jobId, "abc123");
expect("title", job.title, "大模型应用工程师");
expect("salary", job.salary, "25-50K·16薪");
expect("experience", job.experience, "3-5年");
expect("education", job.education, "本科");
expect("url", job.url, "https://www.zhipin.com/job_detail/abc123.html");
expect("source", job.source, "list");
if (!job.location.includes("北京")) throw new Error(`location 应含北京，实际「${job.location}」`);
if (!/示例智能科技|张女士/.test(job.company + job.summary)) throw new Error("公司/招聘者兜底解析缺失");
if (!job.summary) throw new Error("summary 概要行不应为空");

console.log("list-extract.js 兜底解析校验通过");
console.log("  薪资:", job.salary, "| 地点:", job.location, "| 经验:", job.experience, "| 学历:", job.education);
console.log("  概要:", job.summary);
