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
  if (!query) return jobs;
  return jobs.filter((job) =>
    [job.title, job.company, job.salary, job.location, job.url].join("\n").toLowerCase().includes(query)
  );
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
    head.append(el("span", "card-title", job.title || "未命名岗位"));
    head.append(
      el(
        "p",
        "sub",
        [job.company, job.salary, job.location, formatTime(job.savedAt) ? `收藏于 ${formatTime(job.savedAt)}` : ""]
          .filter(Boolean)
          .join(" · ")
      )
    );
    const detail = el("div", "detail");
    detail.hidden = true;
    const rowsMeta = [
      ["经验", job.experience],
      ["学历", job.education],
      ["行业", job.industry],
      ["融资", job.financing],
      ["规模", job.scale],
      ["招聘者", [job.recruiter, job.recruiterTitle].filter(Boolean).join(" · ")],
      ["地址", job.address],
      ["标签", (job.tags || []).join("、")],
    ].filter(([, value]) => value);
    if (rowsMeta.length) {
      const list = el("dl", "facts");
      rowsMeta.forEach(([label, value]) => list.append(el("dt", "", label), el("dd", "", value)));
      detail.append(list);
    }
    detail.append(el("div", "desc", job.description || "（没有保存职位描述）"));
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
