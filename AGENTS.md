# AGENTS.md

本文件是本仓库编码代理配置的**单一事实源**：`CLAUDE.md` 以及今后新增的任何代理规则文件（如 `.github/copilot-instructions.md`、`.cursor/rules/*`）都只放一行指向本文件的引用，不复制正文，避免多份拷贝漂移。改规则只改这里。

## 项目是什么

Chrome MV3 扩展「BOSS岗位提取」：提取 zhipin.com 岗位详情、本地收藏管理、简历管理与表单自动填写、以及基于用户自配 LLM 的求职建议。纯原生 JavaScript，无构建、无打包、无 npm 依赖、无 lint 工具。所有界面文案、注释、错误信息使用中文（zh-CN），新代码应保持一致。

改用户能看见的文案、入口或流程前，先读 `USER.md`（使用者、要办的事、界面用词）。产品红线的代码落点仍以下面「必须遵守的产品约束」为准。

## 常用命令

```bash
node tests/manual-db.test.js   # 运行唯一的自动化测试（数据层校验，会写 tests/last-run.txt）
python tests/make_icons.py     # 重新生成 icons/ 下的 PNG 图标
```

- 没有 build/lint 步骤。开发方式：在 `chrome://extensions` 开发者模式「加载已解压的扩展程序」加载本目录，改代码后在扩展管理页点刷新。
- `tests/db.html`、`tests/fixture.html`、`tests/form.html` 是浏览器手动测试夹具（直接在浏览器打开，用假 DOM 驱动各模块）；`tests/manual-db.test.js` 用 vm 沙箱跑 `db.js`，沙箱没有真 IndexedDB，只验证参数校验与错误路径。

## 架构

### 全局命名空间模块（非 ESM）

每个 `.js` 是一个 IIFE，挂到 `globalThis` 的命名空间上，靠 `<script src>` 加载顺序协作（见各 HTML 底部）和 `background.js` 的 `importScripts`。没有模块打包：

- `db.js` → `BossJdDB`：IndexedDB（库名 `boss-jd`，v4；stores：favorites / resumes / advice / interviews）+ `chrome.storage.local` 迁移。
- `extract.js` → `BossJdExtract`：从 BOSS 岗位页 DOM 提取职位字段；检测自定义字体加密的薪资（PUA 字符区）；导出 `summaryLine`/`classifyMeta` 等供列表与收藏复用。
- `list-extract.js` → `BossJdList`：从推荐/搜索列表页（`/web/geek/jobs`）的岗位卡片提取批量岗位（选择器优先、卡片文本行兜底），记录带 `source: "list"`。
- `resume-text.js` → `BossJdResumeText`：从 txt/md/pdf/docx 提取纯文本，含手写 zip inflate（PDF/DOCX 解析无第三方库）。
- `fill.js` → `BossJdFill`：收集页面空表单字段 / 应用填写计划（注入到任意招聘网站执行）。
- `llm.js` → `BossJdLlm`：OpenAI 兼容 `/chat/completions` 调用；配置存 `chrome.storage.local` 的 `bjd_llm`。
- `agent.js` → `BossJdAgent`：表单填写计划（本地正则识别 + 模型兜底）。
- `coach-agent.js` → `BossJdCoach`：求职建议编排（目标评分排序 → 截取前 6 条收藏 → 两步模型调用 → 结果落库）。

### 消息中枢：background.js

`background.js` 是唯一 service worker，也是 IndexedDB 的唯一访问点。所有上下文（popup、options、favorites、coach、content script）通过 `chrome.runtime.sendMessage` 带 `type` 字段调用：

`BJD_DB` / `BJD_RESUME` / `BJD_AGENT` / `BJD_LIST` / `BJD_INTERVIEW` / `BJD_COACH` / `BJD_OPEN_PAGE`

新增后台能力时：在 `background.js` 加 type 分支 + handler，返回 `{ ok, result }` 或 throw（自动转 `{ ok: false, error }`）。UI 侧已有 promise 封装的 `extensionRequest`/`request` 模式可参考。

### 内容脚本注入链

manifest 有两条 content_scripts：岗位详情页（`/job_detail/*`）注入 `extract.js, resume-text.js, fill.js, content.js`；推荐列表页（`/web/geek/jobs*`）注入 `extract.js, resume-text.js, fill.js, list-extract.js, content.js`（均 `run_at: document_idle`）。`content.js` 在两类页面注入 Shadow DOM 侧边栏（宿主 `#bjd-root`，`all:initial` 隔离样式），在列表页用 `BossJdList` 提供的卡片数据渲染「本页岗位」视图。注意 `popup.js` 的兜底注入文件列表必须与 manifest 保持同步——新增内容脚本文件时两处都要改。

### 权限模型

manifest 只声明 `zhipin.com/job_detail/*` 的 host 权限；列表页 `/web/geek/jobs*` 由 content_scripts matches 覆盖注入，不额外申请 host 权限；其余网站走 `optional_host_permissions`。模型接口地址由用户在 options 页填写，保存时 `chrome.permissions.request` 按域名授权（`llm.js` 调用前会校验已授权）。仓库中没有也不应有默认密钥。

## 必须遵守的产品约束（README 已向用户承诺）

- 不自动提交表单、不自动打招呼、不自动投递，不绕过/处理安全验证页。
- 性别、民族、宗教、残疾、政治面貌等敏感字段一律留空（`fill.js` 的 `SENSITIVE`、`agent.js` 的 `sensitive()`）。
- 建议只能基于简历已有内容，不编造经历；挂掉的岗位只标注、不自动排除。
- 所有数据只存本机（IndexedDB / 扩展存储），不上传。

## 架构决策记录（ADR）

重大技术决策记录在 `docs/adr/`（索引与写作规范见 `docs/adr/README.md`）。本文件的「架构」「权限模型」「产品约束」各节是这些决策的摘要，来龙去脉看对应 ADR；改任何一边都要检查另一边是否需要同步。

- 需要偏离已有决策（引入依赖、改存储 schema、改消息协议、改注入链、动产品红线的技术实现）时，先用 `docs/adr/template.md` 写一条新 ADR，再写代码。
- 已接受的 ADR 正文不改写；推翻时新增编号文件，并在新旧两条中互相标注取代关系。
