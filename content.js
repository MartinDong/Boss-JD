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

  function liveHost() {
    const host = document.getElementById(HOST_ID);
    if (host?.shadowRoot?.getElementById("shell")) return host;
    return null;
  }

  function ensureHost() {
    if (!isJobPage()) {
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
          width: min(416px, calc(100vw - 8px));
          transform: translateX(calc(100% - 36px));
          transition: transform 180ms ease-out;
          pointer-events: none;
          font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
          color: #1c1917;
          padding-right: env(safe-area-inset-right);
        }
        .shell.open { transform: translateX(0); }
        .tab, .panel { pointer-events: auto; }
        @media (prefers-reduced-motion: reduce) {
          .shell { transition: none; }
        }
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
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 14px 16px;
          background: #fff;
          border-bottom: 1px solid #e7e5e4;
        }
        .head h2 { margin: 0; font-size: 15px; font-weight: 650; }
        .head p { margin: 2px 0 0; color: #78716c; font-size: 12px; }
        .head-actions { display: flex; gap: 6px; flex-shrink: 0; }
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
          grid-template-columns: 64px 1fr;
          gap: 8px 12px;
          margin: 16px 0 0;
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
        .fav-detail .desc { margin-top: 8px; max-height: 180px; overflow: auto; }
      </style>
      <div class="shell" id="shell">
        <button class="tab" id="toggle" type="button" aria-expanded="false" aria-controls="panel">岗位</button>
        <section class="panel" id="panel" aria-label="岗位工具" inert>
          <header class="head">
            <div>
              <h2>收藏列表</h2>
              <p>点职位查看详情</p>
            </div>
            <div class="head-actions">
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
    if (panelOpen || readOpen()) openPanel(shadow);
    return host;
  }

  function bind(shadow) {
    shadow.getElementById("toggle")?.addEventListener("click", () => {
      if (panelOpen) closePanel(shadow);
      else openPanel(shadow);
    });
    shadow.getElementById("close")?.addEventListener("click", () => {
      if (shadow.__bjdMode === "job") showList(shadow);
      else closePanel(shadow);
    });
    shadow.getElementById("refresh")?.addEventListener("click", () => {
      showJob(shadow);
    });
  }

  function setMode(shadow, mode) {
    shadow.__bjdMode = mode;
    const title = shadow.querySelector(".head h2");
    const sub = shadow.querySelector(".head p");
    const close = shadow.getElementById("close");
    const refresh = shadow.getElementById("refresh");
    if (mode === "job") {
      if (title) title.textContent = "当前岗位";
      if (sub) sub.textContent = "关闭后回到收藏列表";
      if (close) close.textContent = "返回列表";
      if (refresh) refresh.textContent = "重新提取";
      return;
    }
    if (title) title.textContent = "收藏列表";
    if (sub) sub.textContent = "点职位查看详情";
    if (close) close.textContent = "收起";
    if (refresh) refresh.textContent = "提取当前岗位";
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
    const width = Math.max(280, Math.ceil(shell?.getBoundingClientRect().width || 416));
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
    if (!jobs.length) {
      renderListMessage(shadow, "还没有收藏。点右上角「提取当前岗位」，可以把这一页放进列表。");
      return;
    }
    const count = document.createElement("p");
    count.className = "count";
    count.textContent = `已收藏 ${jobs.length} 条`;
    body.append(count);
    jobs.forEach((job) => body.append(renderFavoriteItem(body, job)));
  }

  function renderFavoriteItem(body, job) {
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
    meta.textContent = [job.company, job.salary].filter(Boolean).join(" · ") || "查看详情";
    main.append(title, meta);
    const detail = document.createElement("div");
    detail.className = "fav-detail";
    detail.hidden = true;
    const rows = [
      ["地点", job.location],
      ["经验", job.experience],
      ["学历", job.education],
      ["公司", [job.company, job.industry, job.financing, job.scale].filter(Boolean).join(" · ")],
      ["招聘者", [job.recruiter, job.recruiterTitle].filter(Boolean).join(" · ")],
      ["地址", job.address],
      ["标签", (job.tags || []).join("、")],
    ].filter(([, value]) => value);
    if (rows.length) {
      const list = document.createElement("dl");
      list.className = "facts";
      rows.forEach(([label, value]) => {
        const term = document.createElement("dt");
        term.textContent = label;
        const desc = document.createElement("dd");
        desc.textContent = value;
        list.append(term, desc);
      });
      detail.append(list);
    }
    const text = document.createElement("div");
    text.className = "desc";
    text.textContent = job.description || "（没有保存职位描述）";
    detail.append(text);
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

    const facts = [
      ["地点", job.location],
      ["经验", job.experience],
      ["学历", job.education],
      ["公司", job.company],
      ["行业", job.industry],
      ["融资", job.financing],
      ["规模", job.scale],
      ["招聘者", [job.recruiter, job.recruiterTitle].filter(Boolean).join(" · ")],
      ["活跃", job.recruiterActive],
      ["地址", job.address],
    ].filter(([, value]) => value);
    if (facts.length) {
      const list = document.createElement("dl");
      list.className = "facts";
      facts.forEach(([label, value]) => {
        const term = document.createElement("dt");
        term.textContent = label;
        const detail = document.createElement("dd");
        detail.textContent = value;
        list.append(term, detail);
      });
      body.append(list);
    }
    if (job.tags?.length) {
      const chips = document.createElement("div");
      chips.className = "chips";
      chips.style.marginTop = "12px";
      job.tags.forEach((tag) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = tag;
        chips.append(chip);
      });
      body.append(chips);
    }

    const block = document.createElement("section");
    block.className = "block";
    const heading = document.createElement("h3");
    heading.textContent = "职位描述";
    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = job.description || "（页面上没有读到职位描述）";
    block.append(heading, desc);
    body.append(block);

    if (job.salaryNote) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = job.salaryNote;
      body.append(note);
    }

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
    if (!globalThis.chrome?.runtime?.sendMessage) {
      return Promise.reject(new Error("当前页面无法访问插件数据库"));
    }
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "BJD_DB", op, ...extra }, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        if (!response || response.ok === false) {
          reject(new Error(response?.error || "本地数据库操作失败"));
          return;
        }
        resolve(response.result);
      });
    });
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
    if (shadow.__bjdMode === "job") showList(shadow);
    else closePanel(shadow);
  });

  ensureHost();
  setInterval(ensureHost, 1200);
})();
