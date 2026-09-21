(function () {
  if (globalThis.__BJD_CONTENT__) return;
  globalThis.__BJD_CONTENT__ = true;

  const HOST_ID = "bjd-root";
  const OPEN_KEY = "bjd-panel-open";
  let panelOpen = false;

  function readOpen() {
    try {
      return sessionStorage.getItem(OPEN_KEY) === "1";
    } catch {
      return false;
    }
  }

  function rememberOpen(open) {
    try {
      sessionStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      /* 页面不允许写入时，只保留本次打开状态。 */
    }
  }

  function isJobPage() {
    return location.pathname.includes("/job_detail/");
  }

  function isListPage() {
    return /\/web\/geek\/jobs/.test(location.pathname + location.search);
  }

  function extractLabel() {
    return isListPage() ? "本页岗位" : "提取当前岗位";
  }

  function liveHost() {
    const host = document.getElementById(HOST_ID);
    if (host?.shadowRoot?.getElementById("shell")) return host;
    return null;
  }

  function ensureHost() {
    if (!isJobPage() && !isListPage()) {
      shiftPage(false);
      return null;
    }
    const current = liveHost();
    if (current) return current;

    document.getElementById(HOST_ID)?.remove();
    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:none;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        button { font: inherit; }
        .shell {
          position: absolute;
          top: 0;
          right: 0;
          height: 100%;
          height: 100dvh;
          width: min(560px, calc(100vw - 48px));
          transform: translateX(calc(100% - 36px));
          transition: transform 180ms ease-out;
          pointer-events: none;
          font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
          color: #1c1917;
          padding-right: env(safe-area-inset-right);
        }
        .shell.open { transform: translateX(0); }
        @media (prefers-reduced-motion: reduce) {
          .shell { transition: none; }
        }
        .tab, .panel, .resizer { pointer-events: auto; }
        .shell.resizing { transition: none; }
        .resizer {
          position: absolute;
          top: 0;
          left: 36px;
          width: 8px;
          height: 100%;
          cursor: ew-resize;
          z-index: 3;
          pointer-events: auto;
        }
        .resizer:hover, .shell.resizing .resizer { background: rgba(15, 118, 110, 0.28); }
        .tab {
          position: absolute;
          left: 0;
          top: 96px;
          width: 36px;
          min-height: 88px;
          padding: 12px 0;
          border: 0;
          border-radius: 8px 0 0 8px;
          background: #0f766e;
          color: #fff;
          cursor: pointer;
          writing-mode: vertical-rl;
          font-size: 13px;
        }
        .tab:focus-visible { outline: 2px solid #115e59; outline-offset: 2px; }
        .panel {
          position: absolute;
          top: 0;
          left: 36px;
          width: calc(100% - 36px);
          height: 100%;
          background: #fafaf9;
          border-left: 1px solid #e7e5e4;
          box-shadow: -12px 0 32px rgba(28, 25, 23, 0.08);
          display: flex;
          flex-direction: column;
          padding-bottom: env(safe-area-inset-bottom);
        }
        .head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          padding: 14px 16px;
          background: #fff;
          border-bottom: 1px solid #e7e5e4;
        }
        .head h2 { margin: 0; font-size: 15px; font-weight: 650; }
        .head p { margin: 2px 0 0; color: #78716c; font-size: 12px; }
        .head-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
        .icon-btn {
          border: 1px solid #e7e5e4;
          background: #fff;
          height: 32px;
          padding: 0 10px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          color: #1c1917;
        }
        .body { flex: 1; min-height: 0; overflow: auto; padding: 16px; }
        .status { margin: 0; font-size: 14px; line-height: 1.6; }
        .title { margin: 0; font-size: 18px; line-height: 1.35; }
        .salary {
          margin: 6px 0 0;
          color: #0f766e;
          font-size: 18px;
          font-variant-numeric: tabular-nums;
        }
        .facts {
          display: grid;
          grid-template-columns: 72px 1fr;
          gap: 8px 12px;
          margin: 8px 0 0;
        }
        .facts dt { margin: 0; color: #78716c; font-size: 12px; }
        .facts dd { margin: 0; font-size: 13px; line-height: 1.45; word-break: break-word; }
        .chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .chip {
          background: #fff;
          border: 1px solid #e7e5e4;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 12px;
        }
        .block { margin-top: 16px; }
        .block h3 { margin: 0 0 8px; font-size: 13px; font-weight: 650; color: #44403c; }
        .desc {
          margin: 0;
          white-space: pre-wrap;
          background: #fff;
          border: 1px solid #e7e5e4;
          border-radius: 10px;
          padding: 12px;
          font-size: 13px;
          line-height: 1.65;
        }
        .note { margin: 12px 0 0; color: #b45309; font-size: 12px; line-height: 1.5; }
        .foot {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 12px 16px;
          background: #fff;
          border-top: 1px solid #e7e5e4;
        }
        .foot button {
          border: 1px solid #d6d3d1;
          background: #fff;
          border-radius: 8px;
          padding: 8px 10px;
          cursor: pointer;
          font-size: 13px;
          color: #1c1917;
        }
        .foot button.primary { background: #0f766e; color: #fff; border-color: #0f766e; }
        .foot button.wide { grid-column: 1 / -1; }
        .foot button.danger { color: #b91c1c; }
        .toast { grid-column: 1 / -1; min-height: 16px; margin: 0; font-size: 12px; color: #0f766e; }
        .count { margin: 0 0 8px; color: #78716c; font-size: 12px; }
        .fav { padding: 10px 0; border-bottom: 1px solid #e7e5e4; }
        .fav-top { display: flex; align-items: flex-start; gap: 8px; }
        .fav-main {
          flex: 1;
          min-width: 0;
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          text-align: left;
          cursor: pointer;
          color: inherit;
        }
        .fav-main strong { display: block; font-size: 14px; line-height: 1.35; }
        .fav-main span { display: block; margin-top: 2px; color: #78716c; font-size: 12px; }
        .fav-main[aria-expanded="true"] strong { color: #0f766e; }
        .fav-meta { display: block; margin-top: 2px; color: #78716c; font-size: 12px; }
        .fav-meta b { color: #0f766e; font-weight: 650; font-variant-numeric: tabular-nums; }
        .fav-req { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
        .fav-req span {
          background: #f5f5f4;
          border-radius: 4px;
          color: #57534e;
          font-size: 11px;
          padding: 1px 6px;
        }
        .list-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
          margin: 0 0 10px;
        }
        .list-actions .chip { cursor: pointer; }
        .list-actions .chip[aria-pressed="true"] { background: #0f766e; color: #fff; border-color: #0f766e; }
        .list-actions > button {
          border: 1px solid #d6d3d1;
          background: #fff;
          border-radius: 8px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
        }
        .list-actions > button.primary { background: #0f766e; color: #fff; border-color: #0f766e; }
        .list-tools .chip { cursor: pointer; }
        .list-tools .chip[aria-pressed="true"] { background: #0f766e; color: #fff; border-color: #0f766e; }
        .open-job {
          flex-shrink: 0;
          border: 1px solid #0f766e;
          color: #0f766e;
          background: #fff;
          border-radius: 8px;
          padding: 4px 8px;
          font-size: 12px;
          line-height: 1.4;
          text-decoration: none;
        }
        .fav-detail { margin-top: 8px; }
        .fav-detail .desc { margin-top: 8px; }
        .resume { padding: 10px 0; border-bottom: 1px solid #e7e5e4; }
        .list-tools { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
        .list-tools .chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .list-tools .chip { cursor: pointer; }
        .list-tools .chip[aria-pressed="true"] { background: #0f766e; color: #fff; border-color: #0f766e; }
        .list-tools > button {
          border: 1px solid #d6d3d1;
          background: #fff;
          border-radius: 8px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
        }
        .track { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .track select, .track input {
          border: 1px solid #d6d3d1;
          border-radius: 8px;
          padding: 5px 8px;
          font-size: 12px;
          font-family: inherit;
        }
        .track input[type="text"] { flex: 1; min-width: 120px; }
        .track button {
          border: 1px solid #0f766e;
          background: #fff;
          color: #0f766e;
          border-radius: 8px;
          padding: 5px 10px;
          cursor: pointer;
          font-size: 12px;
        }
        .manual-form label { display: block; margin-top: 10px; font-size: 13px; font-weight: 650; }
        .manual-form input, .manual-form textarea {
          display: block;
          width: 100%;
          margin-top: 4px;
          border: 1px solid #d6d3d1;
          border-radius: 8px;
          padding: 7px 9px;
          font: inherit;
          font-weight: 400;
        }
        .manual-form .primary { margin-top: 12px; background: #0f766e; color: #fff; border-color: #0f766e; padding: 8px 12px; cursor: pointer; border-radius: 8px; }
        .badge { color: #0f766e; font-weight: 650; }
        .resume strong { display: block; font-size: 14px; }
        .resume .meta { margin: 4px 0 0; color: #78716c; font-size: 12px; line-height: 1.45; }
        .resume .row, .upload-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .resume button, .upload-row button {
          border: 1px solid #d6d3d1;
          background: #fff;
          border-radius: 8px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
          color: #1c1917;
        }
        .badge { color: #0f766e; font-weight: 650; }
      </style>
      <div class="shell" id="shell">
        <button class="tab" id="toggle" type="button" aria-expanded="false" aria-controls="panel">岗位</button>
        <div class="resizer" id="resizer" role="separator" aria-orientation="vertical" aria-label="拖动调整侧边栏宽度"></div>
        <section class="panel" id="panel" aria-label="岗位工具" inert>
          <header class="head">
            <div>
              <h2>收藏列表</h2>
              <p>点职位查看详情</p>
            </div>
            <div class="head-actions">
              <button class="icon-btn" id="resumes" type="button">简历</button>
              <button class="icon-btn" id="coach" type="button">建议</button>
              <button class="icon-btn" id="refresh" type="button">提取当前岗位</button>
              <button class="icon-btn" id="close" type="button">收起</button>
            </div>
          </header>
          <div class="body" id="body">
            <p class="status">正在读取收藏…</p>
          </div>
          <footer class="foot" id="foot" hidden></footer>
        </section>
      </div>
    `;
    (document.documentElement).appendChild(host);
    bind(shadow);
    applyWidth(shadow, panelWidth);
    readStoredWidth().then((width) => {
      if (host.isConnected) applyWidth(shadow, width);
    });
    if (panelOpen || readOpen()) openPanel(shadow);
    return host;
  }

  const WIDTH_KEY = "bjd_panel_width";
  const DEFAULT_WIDTH = 560;
  const MIN_WIDTH = 420;
  let panelWidth = DEFAULT_WIDTH;

  function clampWidth(value) {
    const max = Math.min(840, Math.max(MIN_WIDTH, window.innerWidth - 80));
    const number = Number(value);
    if (!Number.isFinite(number)) return Math.min(DEFAULT_WIDTH, max);
    return Math.round(Math.min(max, Math.max(MIN_WIDTH, number)));
  }

  function applyWidth(shadow, width) {
    panelWidth = clampWidth(width);
    const shell = shadow?.getElementById?.("shell");
    if (!shell) return;
    shell.style.width = `${panelWidth}px`;
    if (panelOpen) shiftPage(true, shell);
  }

  async function readStoredWidth() {
    try {
      if (globalThis.chrome?.storage?.local) {
        const data = await chrome.storage.local.get(WIDTH_KEY);
        if (data[WIDTH_KEY]) return clampWidth(data[WIDTH_KEY]);
      }
    } catch {
      /* 读不到已保存宽度时用默认值。 */
    }
    return DEFAULT_WIDTH;
  }

  function saveWidth(width) {
    panelWidth = clampWidth(width);
    if (!globalThis.chrome?.storage?.local) return;
    chrome.storage.local.set({ [WIDTH_KEY]: panelWidth }).catch(() => {});
  }

  function bindResize(shadow) {
    const resizer = shadow.getElementById("resizer");
    const shell = shadow.getElementById("shell");
    if (!resizer || !shell) return;
    resizer.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = shell.getBoundingClientRect().width;
      shell.classList.add("resizing");
      const move = (moveEvent) => {
        applyWidth(shadow, startWidth + (startX - moveEvent.clientX));
      };
      const up = () => {
        shell.classList.remove("resizing");
        window.removeEventListener("pointermove", move);
        saveWidth(panelWidth);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up, { once: true });
    });
    resizer.addEventListener("dblclick", () => {
      applyWidth(shadow, DEFAULT_WIDTH);
      saveWidth(DEFAULT_WIDTH);
    });
  }
    function bind(shadow) {
    bindResize(shadow);
    shadow.getElementById("toggle")?.addEventListener("click", () => {
      if (panelOpen) closePanel(shadow);
      else openPanel(shadow);
    });
    shadow.getElementById("close")?.addEventListener("click", () => {
      if (shadow.__bjdMode === "job" || shadow.__bjdMode === "resumes" || shadow.__bjdMode === "manual") showList(shadow);
      else closePanel(shadow);
    });
    shadow.getElementById("refresh")?.addEventListener("click", () => {
      if (isListPage()) showPageJobs(shadow);
      else showJob(shadow);
    });
    shadow.getElementById("resumes")?.addEventListener("click", () => {
      showResumes(shadow);
    });
    shadow.getElementById("coach")?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "BJD_OPEN_PAGE", page: "coach.html" });
    });
  }

  function setMode(shadow, mode) {
    shadow.__bjdMode = mode;
    const title = shadow.querySelector(".head h2");
    const sub = shadow.querySelector(".head p");
    const close = shadow.getElementById("close");
    const refresh = shadow.getElementById("refresh");
    const resumes = shadow.getElementById("resumes");
    if (refresh) refresh.hidden = false;
    if (resumes) resumes.hidden = false;
    if (mode === "job") {
      if (title) title.textContent = "当前岗位";
      if (sub) sub.textContent = "关闭后回到收藏列表";
      if (close) close.textContent = "返回列表";
      if (refresh) refresh.textContent = "重新提取";
      return;
    }
    if (mode === "pagejobs") {
      if (title) title.textContent = "本页岗位";
      if (sub) sub.textContent = "列表页上的岗位，点开看要求与地点";
      if (close) close.textContent = "返回列表";
      if (refresh) refresh.textContent = "重新扫描";
      return;
    }
    if (mode === "resumes") {
      if (title) title.textContent = "我的简历";
      if (sub) sub.textContent = "默认简历用于填写当前页";
      if (close) close.textContent = "返回列表";
      if (refresh) refresh.hidden = true;
      if (resumes) resumes.hidden = true;
      return;
    }
    if (mode === "manual") {
      if (title) title.textContent = "导入岗位";
      if (sub) sub.textContent = "粘贴其他网站的职位描述";
      if (close) close.textContent = "返回列表";
      if (refresh) refresh.hidden = true;
      if (resumes) resumes.hidden = true;
      return;
    }
    if (title) title.textContent = "收藏列表";
    if (sub) sub.textContent = "点职位查看详情";
    if (close) close.textContent = "收起";
    if (refresh) refresh.textContent = extractLabel();
  }

  function shiftPage(open, shell) {
    const body = document.body;
    if (!body) return;
    if (!open) {
      if (body.dataset.bjdShifted !== "1") return;
      body.style.width = body.dataset.bjdWidth || "";
      body.style.maxWidth = body.dataset.bjdMaxWidth || "";
      body.style.transform = body.dataset.bjdTransform || "";
      body.style.boxSizing = body.dataset.bjdBox || "";
      body.style.overflowX = body.dataset.bjdOverflow || "";
      delete body.dataset.bjdShifted;
      return;
    }
    if (body.dataset.bjdShifted !== "1") {
      body.dataset.bjdShifted = "1";
      body.dataset.bjdWidth = body.style.width || "";
      body.dataset.bjdMaxWidth = body.style.maxWidth || "";
      body.dataset.bjdTransform = body.style.transform || "";
      body.dataset.bjdBox = body.style.boxSizing || "";
      body.dataset.bjdOverflow = body.style.overflowX || "";
    }
    const width = Math.max(MIN_WIDTH, Math.ceil(shell?.getBoundingClientRect().width || DEFAULT_WIDTH));
    body.style.boxSizing = "border-box";
    body.style.width = `calc(100vw - ${width}px)`;
    body.style.maxWidth = `calc(100vw - ${width}px)`;
    body.style.transform = body.dataset.bjdTransform || "translateX(0)";
    if (!body.style.transform || body.style.transform === "none") body.style.transform = "translateX(0)";
    body.style.overflowX = "hidden";
  }

  function setOpen(shadow, open) {
    const shell = shadow?.getElementById?.("shell");
    const tab = shadow?.getElementById?.("toggle");
    const panel = shadow?.getElementById?.("panel");
    if (!shell || !tab || !panel) return false;
    panelOpen = open;
    rememberOpen(open);
    shell.classList.toggle("open", open);
    tab.setAttribute("aria-expanded", open ? "true" : "false");
    tab.setAttribute("aria-label", open ? "收起岗位工具" : "打开岗位工具");
    tab.textContent = open ? "收起" : "岗位";
    if (open) panel.removeAttribute("inert");
    else panel.setAttribute("inert", "");
    shiftPage(open, shell);
    return true;
  }

  let openDepth = 0;

  function openPanel(shadow) {
    showList(shadow);
  }

  async function showList(shadow) {
    if (openDepth > 1) return;
    openDepth += 1;
    try {
      let root = shadow?.getElementById?.("shell") ? shadow : null;
      if (!root) root = ensureHost()?.shadowRoot || null;
      if (!setOpen(root, true)) return;
      setMode(root, "list");
      const body = root.getElementById("body");
      const foot = root.getElementById("foot");
      if (foot) {
        foot.hidden = true;
        foot.replaceChildren();
      }
      if (body) {
        body.replaceChildren();
        const status = document.createElement("p");
        status.className = "status";
        status.textContent = "正在读取收藏…";
        body.append(status);
      }
      let jobs = [];
      let failed = false;
      try {
        const rows = await dbRequest("list");
        jobs = Array.isArray(rows) ? rows : [];
      } catch {
        failed = true;
      }
      if (!panelOpen || root.__bjdMode !== "list") return;
      if (failed) {
        renderListMessage(root, "暂时读不到收藏。可以先提取当前岗位。");
        return;
      }
      renderFavoriteList(root, jobs);
    } finally {
      openDepth -= 1;
    }
  }

  function showJob(shadow) {
    if (openDepth > 1) return;
    openDepth += 1;
    try {
      let root = shadow?.getElementById?.("shell") ? shadow : null;
      if (!root) root = ensureHost()?.shadowRoot || null;
      if (!setOpen(root, true)) return;
      setMode(root, "job");
      const extract = globalThis.BossJdExtract?.extractJob;
      render(
        root,
        extract ? extract() : { ok: false, message: "提取功能还没准备好，请刷新页面后再打开。" }
      );
    } finally {
      openDepth -= 1;
    }
  }

  async function showPageJobs(shadow) {
    if (openDepth > 1) return;
    openDepth += 1;
    try {
      let root = shadow?.getElementById?.("shell") ? shadow : null;
      if (!root) root = ensureHost()?.shadowRoot || null;
      if (!setOpen(root, true)) return;
      setMode(root, "pagejobs");
      const body = root.getElementById("body");
      const foot = root.getElementById("foot");
      if (body) {
        body.replaceChildren();
        const status = document.createElement("p");
        status.className = "status";
        status.textContent = "正在扫描列表…";
        body.append(status);
      }
      if (foot) {
        foot.hidden = true;
        foot.replaceChildren();
      }
      const collect = globalThis.BossJdList?.extractList;
      const result = collect ? collect() : { ok: false, message: "列表提取功能还没准备好，请刷新页面。" };
      if (root.__bjdMode !== "pagejobs") return;
      if (!result.ok) {
        renderListMessage(root, result.message || "没有扫到岗位。");
        return;
      }
      renderPageJobs(root, result.jobs);
    } finally {
      openDepth -= 1;
    }
  }

  function renderPageJobs(shadow, jobs) {
    const body = shadow.getElementById("body");
    const foot = shadow.getElementById("foot");
    if (!body) return;
    if (foot) {
      foot.hidden = true;
      foot.replaceChildren();
    }
    body.replaceChildren();
    const actions = document.createElement("div");
    actions.className = "list-actions";
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = `本页 ${jobs.length} 条`;
    const saveAll = document.createElement("button");
    saveAll.type = "button";
    saveAll.className = "primary";
    saveAll.textContent = "全部收藏";
    const toast = document.createElement("p");
    toast.className = "toast";
    toast.style.flexBasis = "100%";
    toast.style.margin = "0";
    saveAll.addEventListener("click", async () => {
      saveAll.disabled = true;
      toast.textContent = "正在写入收藏…";
      try {
        const savedList = await extensionRequest("BJD_LIST", "saveAll", { jobs });
        toast.textContent = `已收藏 ${savedList.length} 条（含更新）。`;
        saveAll.textContent = "已收藏";
      } catch (error) {
        toast.textContent = error.message || "收藏失败";
        saveAll.disabled = false;
      }
    });
    actions.append(count, saveAll);
    body.append(actions, toast);
    jobs.forEach((job) => body.append(renderPageJobItem(job)));
  }

  function renderPageJobItem(job) {
    const item = document.createElement("article");
    item.className = "fav";
    const top = document.createElement("div");
    top.className = "fav-top";
    const main = document.createElement("button");
    main.type = "button";
    main.className = "fav-main";
    main.setAttribute("aria-expanded", "false");
    const title = document.createElement("strong");
    title.textContent = job.title || "未命名岗位";
    const meta = document.createElement("span");
    meta.className = "fav-meta";
    const salaryNode = document.createElement("b");
    salaryNode.textContent = job.salary || "薪资面议";
    meta.append(salaryNode);
    const rest = [job.location, job.experience, job.education].filter(Boolean).join(" · ");
    if (rest) meta.append(document.createTextNode(` ${rest}`));
    const req = document.createElement("span");
    req.className = "fav-req";
    (job.tags || []).slice(0, 6).forEach((tag) => {
      const chip = document.createElement("span");
      chip.textContent = tag;
      req.append(chip);
    });
    main.append(title, meta);
    if ((job.tags || []).length) main.append(req);
    const detail = document.createElement("div");
    detail.className = "fav-detail";
    detail.hidden = true;
    const extractApi = globalThis.BossJdExtract;
    if (extractApi?.appendDetails) extractApi.appendDetails(detail, job);
    else if (job.summary) {
      const desc = document.createElement("div");
      desc.className = "desc";
      desc.textContent = job.summary;
      detail.append(desc);
    }
    detail.append(buildListSaveRow(job));
    main.addEventListener("click", () => {
      const willOpen = detail.hidden;
      item.parentElement?.querySelectorAll(".fav-detail").forEach((node) => {
        if (node !== detail) node.hidden = true;
      });
      item.parentElement?.querySelectorAll(".fav-main").forEach((node) => {
        if (node !== main) node.setAttribute("aria-expanded", "false");
      });
      detail.hidden = !willOpen;
      main.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
    top.append(main);
    if (job.url) {
      const link = document.createElement("a");
      link.className = "open-job";
      link.href = job.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "打开";
      top.append(link);
    }
    item.append(top, detail);
    return item;
  }

  function buildListSaveRow(job) {
    const wrap = document.createElement("div");
    wrap.className = "track";
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "收藏这条";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        await extensionRequest("BJD_LIST", "saveOne", { job });
        save.textContent = "已收藏";
      } catch (error) {
        save.textContent = (error.message || "失败").slice(0, 12);
        save.disabled = false;
      }
    });
    wrap.append(save);
    return wrap;
  }

  async function showResumes(shadow) {
    let root = shadow?.getElementById?.("shell") ? shadow : null;
    if (!root) root = ensureHost()?.shadowRoot || null;
    if (!setOpen(root, true)) return;
    setMode(root, "resumes");
    const body = root.getElementById("body");
    const foot = root.getElementById("foot");
    if (body) {
      body.replaceChildren();
      const status = document.createElement("p");
      status.className = "status";
      status.textContent = "正在读取简历…";
      body.append(status);
    }
    if (foot) {
      foot.hidden = true;
      foot.replaceChildren();
    }
    try {
      renderResumeList(root, await extensionRequest("BJD_RESUME", "list"));
    } catch (error) {
      renderListMessage(root, error.message || "暂时读不到简历。");
    }
  }

  function closePanel(shadow) {
    const root = shadow?.getElementById?.("shell") ? shadow : liveHost()?.shadowRoot;
    setOpen(root, false);
  }

  function renderListMessage(shadow, message) {
    const body = shadow.getElementById("body");
    const foot = shadow.getElementById("foot");
    if (!body) return;
    if (foot) {
      foot.hidden = true;
      foot.replaceChildren();
    }
    body.replaceChildren();
    const status = document.createElement("p");
    status.className = "status";
    status.textContent = message;
    body.append(status);
  }

  function renderFavoriteList(shadow, jobs) {
    const body = shadow.getElementById("body");
    const foot = shadow.getElementById("foot");
    if (!body) return;
    if (foot) {
      foot.hidden = true;
      foot.replaceChildren();
    }
    body.replaceChildren();
    const toolbar = document.createElement("div");
    toolbar.className = "list-tools";
    const chips = document.createElement("div");
    chips.className = "chips";
    ["全部", "已投", "约面", "终面", "挂了", "拿offer"].forEach((label, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = label;
      chip.dataset.filter = index === 0 ? "" : label;
      chip.setAttribute("aria-pressed", index === 0 ? "true" : "false");
      chip.addEventListener("click", () => {
        chips.querySelectorAll(".chip").forEach((node) => node.setAttribute("aria-pressed", node === chip ? "true" : "false"));
        const wanted = chip.dataset.filter;
        body.querySelectorAll(".fav").forEach((item) => {
          item.hidden = Boolean(wanted) && item.dataset.status !== wanted;
        });
      });
      chips.append(chip);
    });
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.textContent = "导入岗位";
    importBtn.addEventListener("click", () => {
      showManualForm(shadow);
    });
    toolbar.append(chips, importBtn);
    body.append(toolbar);
    if (!jobs.length) {
      const empty = document.createElement("p");
      empty.className = "status";
      empty.textContent = "还没有收藏。在岗位详情页点「提取当前岗位」，在推荐列表页点「本页岗位」，或点「导入岗位」手动添加。";
      body.append(empty);
      return;
    }
    const count = document.createElement("p");
    count.className = "count";
    count.textContent = `已收藏 ${jobs.length} 条`;
    body.append(count);
    jobs.forEach((job) => body.append(renderFavoriteItem(body, job)));
  }

  function showManualForm(shadow) {
    const root = shadow?.getElementById?.("shell") ? shadow : liveHost()?.shadowRoot;
    if (!root) return;
    setMode(root, "manual");
    const body = root.getElementById("body");
    const foot = root.getElementById("foot");
    if (!body) return;
    if (foot) {
      foot.hidden = true;
      foot.replaceChildren();
    }
    body.replaceChildren();
    const form = document.createElement("div");
    form.className = "manual-form";
    const make = (label, tag, placeholder) => {
      const labelNode = document.createElement("label");
      labelNode.textContent = label;
      const input = document.createElement(tag === "textarea" ? "textarea" : "input");
      if (tag !== "textarea") input.type = "text";
      else input.rows = 8;
      input.placeholder = placeholder || "";
      labelNode.append(input);
      form.append(labelNode);
      return input;
    };
    const company = make("公司", "input", "例如：示例科技");
    const title = make("职位", "input", "例如：前端开发");
    const salary = make("薪资（选填）", "input", "例如：20-40K");
    const location = make("城市（选填）", "input", "例如：北京");
    const url = make("链接（选填）", "input", "以 http 开头");
    const description = make("正文", "textarea", "把职位描述整段贴进来");
    const save = document.createElement("button");
    save.type = "button";
    save.className = "primary";
    save.textContent = "保存到收藏";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        await extensionRequest("BJD_DB", "manual", {
          job: {
            company: company.value,
            title: title.value,
            salary: salary.value,
            location: location.value,
            url: url.value,
            description: description.value,
          },
        });
        await showList(root);
      } catch (error) {
        save.disabled = false;
        const warn = document.createElement("p");
        warn.className = "note";
        warn.textContent = error.message || "保存失败";
        form.append(warn);
      }
    });
    form.append(save);
    body.append(form);
  }

  function renderFavoriteItem(body, job) {
    const item = document.createElement("article");
    item.className = "fav";
    item.dataset.status = job.applyStatus || "";
    const top = document.createElement("div");
    top.className = "fav-top";
    const main = document.createElement("button");
    main.type = "button";
    main.className = "fav-main";
    main.setAttribute("aria-expanded", "false");
    const title = document.createElement("strong");
    title.textContent = job.title || "未命名岗位";
    const meta = document.createElement("span");
    meta.className = "fav-meta";
    const summary = globalThis.BossJdExtract?.summaryLine
      ? globalThis.BossJdExtract.summaryLine(job)
      : [job.company, job.salary, job.distance].filter(Boolean).join(" · ");
    meta.textContent = summary || "查看详情";
    const req = document.createElement("span");
    req.className = "fav-req";
    (job.tags || []).slice(0, 4).forEach((tag) => {
      const chip = document.createElement("span");
      chip.textContent = tag;
      req.append(chip);
    });
    main.append(title, meta);
    if ((job.tags || []).length) main.append(req);
    const detail = document.createElement("div");
    detail.className = "fav-detail";
    detail.hidden = true;
    globalThis.BossJdExtract?.appendDetails(detail, job);
    detail.append(buildTrackingRow(job));
    main.addEventListener("click", () => {
      const willOpen = detail.hidden;
      body.querySelectorAll(".fav-detail").forEach((node) => {
        node.hidden = true;
      });
      body.querySelectorAll(".fav-main").forEach((node) => node.setAttribute("aria-expanded", "false"));
      detail.hidden = !willOpen;
      main.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
    top.append(main);
    if (job.source === "manual") {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "手动";
      top.append(badge);
    }
    if (job.url) {
      const link = document.createElement("a");
      link.className = "open-job";
      link.href = job.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "打开原岗位";
      top.append(link);
    }
    item.append(top, detail);
    return item;
  }

  function buildTrackingRow(job) {
    const wrap = document.createElement("div");
    wrap.className = "track";
    const status = document.createElement("select");
    status.setAttribute("aria-label", "投递状态");
    ["", "已投", "约面", "终面", "挂了", "拿offer"].forEach((label) => {
      const option = document.createElement("option");
      option.value = label;
      option.textContent = label || "未投";
      status.append(option);
    });
    status.value = job.applyStatus || "";
    const date = document.createElement("input");
    date.type = "date";
    date.setAttribute("aria-label", "日期");
    date.value = job.applyAt || "";
    const note = document.createElement("input");
    note.type = "text";
    note.placeholder = "一句话备注";
    note.value = job.applyNote || "";
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "记录";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        await extensionRequest("BJD_DB", "track", {
          id: job.id,
          applyStatus: status.value,
          applyAt: date.value,
          applyNote: note.value,
        });
        save.textContent = "已记录";
        setTimeout(() => {
          save.textContent = "记录";
        }, 1200);
      } catch (error) {
        save.textContent = error.message.slice(0, 12) || "失败";
      } finally {
        save.disabled = false;
      }
    });
    wrap.append(status, date, note, save);
    return wrap;
  }

  function render(shadow, job) {
    const body = shadow?.getElementById?.("body");
    const foot = shadow?.getElementById?.("foot");
    if (!body || !foot) return;
    foot.hidden = true;
    foot.replaceChildren();
    if (!job.ok) {
      body.replaceChildren();
      body.append(Object.assign(document.createElement("p"), { className: "status", textContent: job.message }));
      return;
    }

    body.replaceChildren();
    const title = document.createElement("h3");
    title.className = "title";
    title.textContent = job.title || "未命名岗位";
    body.append(title);
    if (job.salary) {
      const salary = document.createElement("p");
      salary.className = "salary";
      salary.textContent = job.salary;
      body.append(salary);
    }
    globalThis.BossJdExtract?.appendDetails(body, job);

    foot.hidden = false;
    const buttons = [
      ["复制 Markdown", "primary", "md"],
      ["复制 JSON", "", "json"],
      ["下载", "", "download"],
      ["复制链接", "", "link"],
      ["收藏", "primary", "favorite"],
      ["取消收藏", "danger wide", "unfavorite"],
    ];
    buttons.forEach(([label, className, action]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.dataset.act = action;
      button.textContent = label;
      if (action === "unfavorite") button.hidden = true;
      button.addEventListener("click", () => onAction(shadow, action, job));
      foot.append(button);
    });
    const toast = document.createElement("p");
    toast.className = "toast";
    toast.id = "toast";
    foot.append(toast);
    refreshFavoriteState(shadow, job);
  }

  function dbRequest(op, extra) {
    return extensionRequest("BJD_DB", op, extra);
  }

  function extensionRequest(type, op, extra) {
    if (!globalThis.chrome?.runtime?.sendMessage) {
      return Promise.reject(new Error("当前页面无法访问插件数据库"));
    }
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, op, ...extra }, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        if (!response || response.ok === false) {
          reject(new Error(response?.error || "操作失败"));
          return;
        }
        resolve(response.result);
      });
    });
  }

  function renderResumeList(shadow, resumes) {
    const body = shadow.getElementById("body");
    const foot = shadow.getElementById("foot");
    if (!body) return;
    body.replaceChildren();
    const hint = document.createElement("p");
    hint.className = "status";
    hint.textContent = "可上传多份。填写只会写入这一页的空表单，不会点提交。";
    const uploadRow = document.createElement("div");
    uploadRow.className = "upload-row";
    const upload = document.createElement("button");
    upload.type = "button";
    upload.textContent = "上传简历";
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.hidden = true;
    input.accept = ".txt,.md,.pdf,.docx,text/plain,application/pdf";
    upload.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      uploadPickedResumes(shadow, input.files).catch((error) => {
        hint.textContent = error.message || "上传失败";
      });
    });
    const settings = document.createElement("button");
    settings.type = "button";
    settings.textContent = "模型配置";
    settings.addEventListener("click", () => chrome.runtime.openOptionsPage());
    uploadRow.append(upload, settings, input);
    body.append(hint, uploadRow);
    if (!resumes.length) {
      const empty = document.createElement("p");
      empty.className = "status";
      empty.textContent = "还没有简历。上传后，PDF 如果没有抽出文字，请到模型配置页把正文补上。";
      body.append(empty);
    } else {
      resumes.forEach((resume) => body.append(renderResumeItem(shadow, resume)));
    }
    if (!foot) return;
    foot.hidden = false;
    foot.replaceChildren();
    const fill = document.createElement("button");
    fill.type = "button";
    fill.className = "primary wide";
    fill.textContent = "用默认简历填写当前页";
    const toast = document.createElement("p");
    toast.className = "toast";
    fill.addEventListener("click", () => fillThisPage(shadow, toast, shadow.querySelector("input[name='bjd-resume']:checked")?.value));
    foot.append(fill, toast);
  }

  function renderResumeItem(shadow, resume) {
    const item = document.createElement("article");
    item.className = "resume";
    const title = document.createElement("strong");
    title.textContent = resume.name || "未命名简历";
    if (resume.isDefault) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = " · 默认";
      title.append(badge);
    }
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = String(resume.text || "").replace(/\s+/g, " ").slice(0, 72) || "没有正文，填写前请先补上文字。";
    const row = document.createElement("div");
    row.className = "row";
    const pick = document.createElement("input");
    pick.type = "radio";
    pick.name = "bjd-resume";
    pick.value = resume.id;
    pick.checked = Boolean(resume.isDefault);
    const use = document.createElement("button");
    use.type = "button";
    use.textContent = resume.isDefault ? "已是默认" : "设为默认";
    use.disabled = Boolean(resume.isDefault);
    use.addEventListener("click", () => {
      extensionRequest("BJD_RESUME", "default", { id: resume.id })
        .then(() => showResumes(shadow))
        .catch((error) => {
          meta.textContent = error.message || "设置失败";
        });
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "删除";
    remove.addEventListener("click", () => {
      if (!confirm(`删除「${resume.name || "未命名简历"}」？`)) return;
      extensionRequest("BJD_RESUME", "remove", { id: resume.id })
        .then(() => showResumes(shadow))
        .catch((error) => {
          meta.textContent = error.message || "删除失败";
        });
    });
    const pickLabel = document.createElement("span");
    pickLabel.textContent = "用这份";
    row.append(pick, pickLabel, use, remove);
    item.append(title, meta, row);
    return item;
  }

  async function uploadPickedResumes(shadow, fileList) {
    const files = [...(fileList || [])];
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) throw new Error("单个文件请小于 8MB");
      const buffer = await file.arrayBuffer();
      const text = globalThis.BossJdResumeText
        ? await globalThis.BossJdResumeText.extract(buffer, file.name)
        : "";
      await extensionRequest("BJD_RESUME", "save", {
        name: file.name.replace(/\.[^.]+$/, ""),
        filename: file.name,
        mime: file.type || "application/octet-stream",
        text,
        buffer,
      });
    }
    await showResumes(shadow);
  }

  async function fillThisPage(shadow, toast, resumeId) {
    const collect = globalThis.BossJdFill?.collectFields;
    const apply = globalThis.BossJdFill?.applyPlan;
    if (!collect || !apply) {
      toast.textContent = "填写功能还没准备好，请刷新页面。";
      return;
    }
    const collected = collect();
    if (collected.blocked) {
      toast.textContent = "页面还在安全验证，请先手动完成。";
      return;
    }
    if (!collected.fields.length && !collected.hasFile) {
      toast.textContent = "这一页没有可填写的空表单。";
      return;
    }
    toast.textContent = "正在根据简历填写…";
    try {
      const plan = await extensionRequest("BJD_AGENT", "plan", {
        resumeId: resumeId || "",
        fields: collected.fields,
        hasFile: collected.hasFile,
      });
      const result = apply(plan);
      const note = plan.note ? ` ${plan.note}` : "";
      const upload = result.uploaded ? "简历文件已放进上传框。" : "";
      toast.textContent = `已填写 ${result.filled} 项。${upload}${note}请自己检查后再提交。`;
    } catch (error) {
      toast.textContent = error.message || "填写失败";
    }
  }

  async function refreshFavoriteState(shadow, job) {
    const favorite = shadow.querySelector('[data-act="favorite"]');
    const remove = shadow.querySelector('[data-act="unfavorite"]');
    if (!favorite || !remove) return;
    try {
      const existing = await dbRequest("get", { id: job.jobId || job.url });
      favorite.textContent = existing ? "更新收藏" : "收藏";
      remove.hidden = !existing;
    } catch {
      favorite.textContent = "收藏";
    }
  }

  async function onAction(shadow, action, job) {
    const api = globalThis.BossJdExtract;
    const toast = shadow.getElementById("toast");
    if (!api || !toast) return;
    try {
      if (action === "md") {
        await copyText(api.toMarkdown(job));
        toast.textContent = "已复制 Markdown";
      } else if (action === "json") {
        await copyText(JSON.stringify(job, null, 2));
        toast.textContent = "已复制 JSON";
      } else if (action === "download") {
        download(`${api.fileStem(job)}.md`, api.toMarkdown(job), "text/markdown");
        toast.textContent = "已开始下载 Markdown";
      } else if (action === "link") {
        await copyText(job.url || "");
        toast.textContent = "已复制原始链接";
      } else if (action === "favorite") {
        const saved = await dbRequest("save", { job });
        toast.textContent = saved?.url ? "已收藏，原始链接已写入本地数据库" : "已收藏";
        await refreshFavoriteState(shadow, job);
      } else if (action === "unfavorite") {
        await dbRequest("remove", { id: job.jobId || job.url });
        toast.textContent = "已取消收藏";
        await refreshFavoriteState(shadow, job);
      }
    } catch (error) {
      toast.textContent = error && error.message ? error.message : "操作失败";
    }
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) throw new Error("复制失败，请改用下载");
    }
  }

  function download(filename, value, mime) {
    const blob = new Blob([value], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  if (globalThis.chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message) return;
      if (message.type === "BJD_EXTRACT") {
        sendResponse(globalThis.BossJdExtract.extractJob());
        return;
      }
      if (message.type === "BJD_OPEN") {
        const host = ensureHost();
        if (!host?.shadowRoot?.getElementById("shell")) {
          sendResponse({ ok: false });
          return;
        }
        openPanel(host.shadowRoot);
        sendResponse({ ok: true });
      }
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !panelOpen) return;
    const shadow = liveHost()?.shadowRoot;
    if (!shadow) return;
    if (shadow.__bjdMode === "job" || shadow.__bjdMode === "resumes" || shadow.__bjdMode === "manual") showList(shadow);
    else closePanel(shadow);
  });

  ensureHost();
  setInterval(ensureHost, 1200);
})();
