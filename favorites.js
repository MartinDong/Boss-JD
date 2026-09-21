const db = globalThis.BossJdDB;
const api = globalThis.BossJdExtract;
let jobs = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

function jobsToMarkdown(rows) {
  return rows
    .map((job, index) => `## ${index + 1}. ${job.title || "未命名岗位"}\n\n${api.toMarkdown(job).replace(/^# .+\n+/, "")}`)
    .join("\n");
}

function visibleJobs() {
  const query = document.getElementById("query").value.trim().toLowerCase();
  const wanted = document.querySelector("#chips .chip[aria-pressed='true']")?.dataset.filter || "";
  return jobs.filter((job) => {
    if (wanted && job.applyStatus !== wanted) return false;
    if (!query) return true;
    return [job.title, job.company, job.salary, job.location, job.url].join("\n").toLowerCase().includes(query);
  });
}

function buildTrackingRow(job) {
  const track = el("div", "track");
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
  const save = el("button", "", "记录");
  save.type = "button";
  save.addEventListener("click", async () => {
    save.disabled = true;
    try {
      const updated = await request("BJD_DB", "track", {
        id: job.id,
        applyStatus: status.value,
        applyAt: date.value,
        applyNote: note.value,
      });
      Object.assign(job, updated);
      save.textContent = "已记录";
      setTimeout(() => {
        save.textContent = "记录";
        save.disabled = false;
      }, 1200);
    } catch (error) {
      save.textContent = "失败";
      save.classList.add("status-warn");
      save.disabled = false;
    }
  });
  track.append(status, date, note, save);
  return track;
}

function request(type, op, extra) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, op, ...extra }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "操作失败"));
        return;
      }
      resolve(response.result);
    });
  });
}

function render() {
  const rows = visibleJobs();
  document.getElementById("count").textContent = `本地数据库共 ${jobs.length} 条，当前显示 ${rows.length} 条`;
  const list = document.getElementById("list");
  list.replaceChildren();
  if (!rows.length) {
    list.append(el("p", "empty", jobs.length ? "没有符合搜索的收藏。" : "还没有收藏。在岗位详情页提取后点「收藏」。"));
    return;
  }
  rows.forEach((job) => {
    const card = el("article", "card");
    const head = el("button", "card-toggle");
    head.type = "button";
    head.setAttribute("aria-expanded", "false");
    const titleWrap = el("span", "card-title");
    titleWrap.textContent = job.title || "未命名岗位";
    if (job.source === "manual") {
      head.append(el("span", "badge", "手动"));
    }
    head.append(titleWrap);
    head.append(
      el(
        "p",
        "sub",
        (
          (globalThis.BossJdExtract?.summaryLine ? globalThis.BossJdExtract.summaryLine(job) : "") ||
          [
            job.company,
            job.salary,
            job.distance,
            job.applyStatus ? `状态：${job.applyStatus}` : "",
            formatTime(job.savedAt) ? `收藏于 ${formatTime(job.savedAt)}` : "",
          ]
            .filter(Boolean)
            .join(" · ")
        ) + [
          "",
          job.applyStatus ? `状态：${job.applyStatus}` : "",
          formatTime(job.savedAt) ? `收藏于 ${formatTime(job.savedAt)}` : "",
        ].filter(Boolean).join(" · ")
      )
    );
    const detail = el("div", "detail");
    detail.hidden = true;
    api.appendDetails(detail, job);
    detail.append(buildTrackingRow(job));
    head.addEventListener("click", () => {
      detail.hidden = !detail.hidden;
      head.setAttribute("aria-expanded", detail.hidden ? "false" : "true");
    });
    const actions = el("div", "actions");
    if (job.url) {
      const open = document.createElement("a");
      open.className = "primary-link";
      open.href = job.url;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      open.textContent = "打开原岗位";
      actions.append(open);
    }
    const remove = el("button", "danger", "删除");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      await db.removeFavorite(job.id);
      jobs = jobs.filter((item) => item.id !== job.id);
      render();
    });
    actions.append(remove);
    card.append(head, detail, actions);
    list.append(card);
  });
}

async function boot() {
  jobs = await db.listFavorites();
  document.getElementById("query").addEventListener("input", render);
  document.querySelectorAll("#chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#chips .chip").forEach((node) => node.setAttribute("aria-pressed", node === chip ? "true" : "false"));
      render();
    });
  });
  const manualForm = document.getElementById("manual-form");
  document.getElementById("import").addEventListener("click", () => {
    manualForm.hidden = !manualForm.hidden;
  });
  document.getElementById("m-cancel").addEventListener("click", () => {
    manualForm.hidden = true;
  });
  document.getElementById("m-save").addEventListener("click", async () => {
    const button = document.getElementById("m-save");
    const status = document.getElementById("m-status");
    status.classList.remove("status-warn");
    button.disabled = true;
    try {
      await request("BJD_DB", "manual", {
        job: {
          company: document.getElementById("m-company").value,
          title: document.getElementById("m-title").value,
          salary: document.getElementById("m-salary").value,
          location: document.getElementById("m-location").value,
          url: document.getElementById("m-url").value,
          description: document.getElementById("m-desc").value,
        },
      });
      jobs = await db.listFavorites();
      manualForm.hidden = true;
      ["m-company", "m-title", "m-salary", "m-location", "m-url", "m-desc"].forEach((id) => {
        document.getElementById(id).value = "";
      });
      status.textContent = "已保存到收藏。";
      render();
    } catch (error) {
      status.textContent = error.message || "保存失败";
      status.classList.add("status-warn");
    } finally {
      button.disabled = false;
    }
  });
  document.getElementById("export-md").addEventListener("click", () => {
    download("boss-favorites.md", `# BOSS直聘收藏\n\n${jobsToMarkdown(visibleJobs())}`, "text/markdown");
  });
  document.getElementById("export-json").addEventListener("click", () => {
    download("boss-favorites.json", JSON.stringify(visibleJobs(), null, 2), "application/json");
  });
  document.getElementById("clear").addEventListener("click", async () => {
    if (!jobs.length) return;
    if (!confirm("清空本地数据库里的全部收藏？")) return;
    await db.clearFavorites();
    jobs = [];
    render();
  });
  render();
}

boot();
