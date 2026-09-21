# 0002. background service worker 作为 IndexedDB 唯一访问点

- 状态：已接受
- 日期：2026-09-21

## 背景与问题

收藏、简历、建议、面试复盘都存 IndexedDB，而 popup、options、favorites、coach 页面和 content script 都需要读写。如果各上下文直接开库，要处理多连接、升级竞争和重复迁移逻辑。

## 决策

IndexedDB 只在 `background.js`（唯一 service worker）里访问。其他上下文一律通过 `chrome.runtime.sendMessage` 带 `type` 字段调用：`BJD_DB` / `BJD_RESUME` / `BJD_AGENT` / `BJD_INTERVIEW` / `BJD_COACH` / `BJD_OPEN_PAGE`。handler 返回 `{ ok, result }`，throw 则统一转为 `{ ok: false, error }`。

## 理由

- 单连接消除升级与迁移竞争；`chrome.storage.local` 旧数据迁移（`bjd_jobs` → IndexedDB）也只在 service worker 内跑一次。
- 权限与敏感操作集中：简历文件读取、模型调用前的域名授权校验都收在后台。
- UI 侧只需维护一个 promise 封装的 `request`/`extensionRequest` 模式，错误信息统一透出。

## 影响

- 新增后台能力必须走「background.js 加 type 分支 + handler」，不要在 UI 页面直接 `indexedDB.open`。
- service worker 不常驻：依赖它的长任务要能被消息唤醒后从头完成，不依赖内存里的全局缓存。
- `db.js` 同时被后台和测试沙箱加载，因此它不能引用 `chrome.runtime`，只允许 `chrome.storage.local`（迁移用）且做了存在性判断。
