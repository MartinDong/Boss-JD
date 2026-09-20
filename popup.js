const db = globalThis.BossJdDB;
const api = globalThis.BossJdExtract;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function toast(text) {
  const node = document.getElementById("toast");
  if (node) node.textContent = text;
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
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

function jobsToMarkdown(jobs) {
  return jobs.map((job, index) => `## ${index + 1}. ${job.title || "未命名岗位"}\n\n${api.toMarkdown(job).replace(/^# .+\n+/, "")}`).join("\n");
}

function renderSaved(jobs) {
  const box = el("section", "saved");
  box.append(el("h2", "", `收藏 ${jobs.length} 条`));
  if (!jobs.length) {
    box.append(el("p", "hint", "点「收藏」后，岗位内容会写入本地数据库。"));
    appendSavedActions(box, jobs);
    return box;
  }
  jobs.forEach((job) => box.append(renderFavorite(job, box)));
  appendSavedActions(box, jobs);
  return box;
}

function renderFavorite(job, box) {
  const item = el("article", "fav");
  const top = el("div", "fav-top");
  const main = el("button", "fav-main");
  main.type = "button";
  main.setAttribute("aria-expanded", "false");
  main.append(el("strong", "", job.title || "未命名岗位"));
  main.append(el("span", "", [job.company, job.salary, job.distance].filter(Boolean).join(" · ") || "查看详情"));
  const detail = el("div", "fav-detail");
  detail.hidden = true;
  fillFavoriteDetail(detail, job);
  main.addEventListener("click", () => {
    const willOpen = detail.hidden;
    box.querySelectorAll(".fav-detail").forEach((node) => {
      node.hidden = true;
    });
    box.querySelectorAll(".fav-main").forEach((node) => node.setAttribute("aria-expanded", "false"));
    detail.hidden = !willOpen;
    main.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });
  top.append(main);
  appendOpenJob(top, job.url);
  item.append(top, detail);
  return item;
}

function fillFavoriteDetail(detail, job) {
  globalThis.BossJdExtract.appendDetails(detail, job);
}

function appendOpenJob(parent, url) {
  if (!url) return;
  const link = document.createElement("a");
  link.className = "open-job";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "打开原岗位";
  parent.append(link);
}

function appendSavedActions(box, jobs) {
  const row = el("div", "row");
  const openBtn = el("button", "", "打开收藏库");
  const exportBtn = el("button", "", "导出全部");
  const clearBtn = el("button", "ghost", "清空");
  openBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("favorites.html") });
  });
  exportBtn.disabled = !jobs.length;
  exportBtn.addEventListener("click", () => {
    download("boss-favorites.md", `# BOSS直聘收藏\n\n${jobsToMarkdown(jobs)}`, "text/markdown");
    toast("已开始下载");
  });
  clearBtn.addEventListener("click", async () => {
    if (!jobs.length || !confirm("清空本地数据库里的全部收藏？")) return;
    await db.clearFavorites();
    boot();
  });
  row.append(openBtn, exportBtn, clearBtn);
  box.append(row);
  return box;
}

async function renderJob(job) {
  const saved = await db.getFavorite(job.jobId || job.url).catch(() => null);
  const card = el("section", "card");
  card.append(el("h2", "title", job.title || "未命名岗位"));
  const list = el("ul", "meta");
  [
    ["薪资", job.salary],
    ["地点", job.location],
    ["经验", job.experience],
    ["学历", job.education],
    ["公司", job.company],
    ["招聘者", [job.recruiter, job.recruiterTitle].filter(Boolean).join(" · ")],
  ]
    .filter(([, value]) => value)
    .forEach(([label, value]) => {
      const li = document.createElement("li");
      li.textContent = `${label}：${value}`;
      list.append(li);
    });
  card.append(list);
  card.append(el("div", "desc", job.description || "（页面上没有读到职位描述）"));
  if (job.salaryNote) card.append(el("p", "warn", job.salaryNote));

  const actions = el("div", "actions");
  const buttons = [
    ["复制 Markdown", "primary", () => copyText(api.toMarkdown(job)).then(() => toast("已复制 Markdown"))],
    ["复制 JSON", "", () => copyText(JSON.stringify(job, null, 2)).then(() => toast("已复制 JSON"))],
    ["下载", "", () => {
      download(`${api.fileStem(job)}.md`, api.toMarkdown(job), "text/markdown");
      toast("已开始下载");
    }],
    ["在右侧打开", "", async () => {
      const tab = await currentTab();
      await chrome.tabs.sendMessage(tab.id, { type: "BJD_OPEN" });
      window.close();
    }],
    [saved ? "更新收藏" : "收藏", "primary", async () => {
      await db.saveFavorite(job);
      toast("已写入本地数据库");
      boot();
    }],
  ];
  if (saved) {
    buttons.push(["取消收藏", "danger", async () => {
      await db.removeFavorite(saved.id);
      toast("已取消收藏");
      boot();
    }]);
  }
  buttons.forEach(([label, className, onClick]) => {
    const button = el("button", className, label);
    button.addEventListener("click", () => {
      Promise.resolve(onClick()).catch((error) => toast(error.message || "操作失败"));
    });
    actions.append(button);
  });
  card.append(actions, el("div", "toast", ""));
  card.querySelector(".toast").id = "toast";
  return card;
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isJobPage(url) {
  return /^https:\/\/www\.zhipin\.com\/job_detail\//.test(url || "");
}

async function readJob(tab) {
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "BJD_EXTRACT" });
    if (response) return response;
  } catch {
    /* 页面在安装插件前就打开了，改由脚本注入再读一次。 */
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["extract.js", "content.js"],
  });
  const [injected] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => globalThis.BossJdExtract.extractJob(),
  });
  return injected?.result;
}

async function boot() {
  const app = document.getElementById("app");
  app.replaceChildren();
  const jobs = await db.listFavorites().catch(() => []);
  let tab;
  try {
    tab = await currentTab();
  } catch {
    tab = null;
  }

  if (!tab || !isJobPage(tab.url)) {
    const card = el("section", "card");
    card.append(
      el("p", "status", "当前标签不是 BOSS直聘的岗位详情页。"),
      el("p", "hint", "请先打开 zhipin.com/job_detail/ 开头的职位页。若页面停在安全验证，先手动完成验证。")
    );
    app.append(card, renderSaved(jobs));
    return;
  }

  let job;
  try {
    job = await readJob(tab);
  } catch {
    const card = el("section", "card");
    card.append(el("p", "warn", "读取失败。请刷新职位页后再打开插件。"));
    app.append(card, renderSaved(jobs));
    return;
  }

  if (!job || !job.ok) {
    const card = el("section", "card");
    card.append(el("p", "warn", job?.message || "没有读到岗位内容。"));
    app.append(card, renderSaved(jobs));
    return;
  }

  app.append(await renderJob(job), renderSaved(jobs));
}

boot();
