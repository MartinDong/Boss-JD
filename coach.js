const FIELDS = ["role", "cities", "salary", "industry", "workMode", "experience", "mustHave", "avoid", "notes"];
const TASKS = [
  ["recommend", "岗位推荐"],
  ["resume", "简历修改"],
  ["apply", "投递建议"],
  ["interview", "面试准备"],
];

const targetStatus = document.getElementById("target-status");
const statusNode = document.getElementById("status");
const resultNode = document.getElementById("result");
const picksNode = document.getElementById("job-picks");
const historyNode = document.getElementById("history");

function say(node, message, isError) {
  node.textContent = message || "";
  node.style.color = isError ? "#b91c1c" : "#0f766e";
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

function readForm() {
  const target = {};
  FIELDS.forEach((key) => {
    target[key] = document.getElementById(key).value;
  });
  return target;
}

function writeForm(target) {
  FIELDS.forEach((key) => {
    document.getElementById(key).value = target?.[key] || "";
  });
}

function selectedJobIds() {
  return [...picksNode.querySelectorAll("input:checked")].map((node) => node.value);
}

function renderPicks(jobs) {
  picksNode.replaceChildren();
  if (!jobs.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "还没有收藏。先在岗位页提取并收藏，再回来生成建议。";
    picksNode.append(empty);
    return;
  }
  jobs.forEach((job) => {
    const label = document.createElement("label");
    label.className = "pick";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = job.id;
    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = job.title || "未命名岗位";
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = [job.company, job.salary, job.location].filter(Boolean).join(" · ");
    text.append(title, meta);
    label.append(input, text);
    picksNode.append(label);
  });
}

function list(title, items) {
  if (!items?.length) return null;
  const box = document.createElement("div");
  const heading = document.createElement("h3");
  heading.textContent = title;
  const ul = document.createElement("ul");
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    ul.append(li);
  });
  box.append(heading, ul);
  return box;
}

function renderResult(result) {
  resultNode.replaceChildren();
  if (!result) return;
  const root = document.createElement("div");
  root.className = "result";
  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = result.summary || "没有总述。";
  root.append(summary);
  if (result.warning) {
    const warning = document.createElement("p");
    warning.className = "warn";
    warning.textContent = result.warning;
    root.append(warning);
  }
  if (result.omittedJobCount) {
    const omitted = document.createElement("p");
    omitted.className = "hint";
    omitted.textContent = `还有 ${result.omittedJobCount} 条收藏这次没有放进分析。可以勾选最想比较的几条再生成一次。`;
    root.append(omitted);
  }
  const lists = document.createElement("div");
  lists.className = "lists";
  const advantages = list("可以强调的优势", result.advantages);
  const gaps = list("还要补的差距", result.gaps);
  if (advantages) lists.append(advantages);
  if (gaps) lists.append(gaps);
  if (lists.childNodes.length) root.append(lists);
  (result.jobs || []).forEach((job) => {
    const card = document.createElement("article");
    card.className = "job";
    const top = document.createElement("div");
    top.className = "job-top";
    const heading = document.createElement("h3");
    heading.textContent = [job.title || "未命名岗位", job.company].filter(Boolean).join(" · ");
    const fit = document.createElement("span");
    fit.className = `fit fit-${job.fit}`;
    fit.textContent = job.fit || "待看";
    top.append(heading, fit);
    const why = document.createElement("p");
    why.textContent = job.why || "";
    card.append(top, why);
    const detail = document.createElement("div");
    detail.className = "lists";
    const jobAdvantages = list("优势", job.advantages);
    const jobGaps = list("差距", job.gaps);
    if (jobAdvantages) detail.append(jobAdvantages);
    if (jobGaps) detail.append(jobGaps);
    if (detail.childNodes.length) card.append(detail);
    if (job.url) {
      const link = document.createElement("a");
      link.className = "link";
      link.href = job.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "打开原岗位";
      card.append(link);
    }
    root.append(card);
  });
  (result.sections || []).forEach((section) => {
    const block = document.createElement("section");
    block.className = "section";
    const heading = document.createElement("h3");
    heading.textContent = section.heading;
    block.append(heading);
    section.items.forEach((item) => {
      const title = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = item.title ? `${item.title}：` : "";
      title.append(strong, document.createTextNode(item.detail));
      block.append(title);
    });
    root.append(block);
  });
  resultNode.append(root);
}

function renderHistory(rows) {
  historyNode.replaceChildren();
  rows.forEach((row) => {
    const label = TASKS.find((item) => item[0] === row.task)?.[1] || row.task;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `上次${label}`;
    button.addEventListener("click", () => {
      renderResult(row);
      say(statusNode, "这是上次保存在本机的建议，没有重新请求模型。");
    });
    historyNode.append(button);
  });
}

function setBusy(busy) {
  document.querySelectorAll("#tasks button, #save-target").forEach((button) => {
    button.disabled = busy;
  });
}

async function saveTarget() {
  const saved = await request("BJD_COACH", "saveTarget", { target: readForm() });
  writeForm(saved);
  say(targetStatus, "条件已保存在本机。");
  return saved;
}

async function runTask(task) {
  setBusy(true);
  say(statusNode, "正在对照目标和收藏岗位…");
  resultNode.replaceChildren();
  try {
    await saveTarget();
    const result = await request("BJD_COACH", "advise", { task, jobIds: selectedJobIds() });
    renderResult(result);
    const rows = await request("BJD_COACH", "list");
    renderHistory(Array.isArray(rows) ? rows : []);
    say(statusNode, result.resumeName ? `已按默认简历「${result.resumeName}」生成。请自己核对后再投递或修改简历。` : "还没有简历正文，这次只比较了目标和岗位。");
  } catch (error) {
    say(statusNode, error.message || "生成失败", true);
  } finally {
    setBusy(false);
  }
}

function mountTasks() {
  const box = document.getElementById("tasks");
  TASKS.forEach(([task, label], index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (index === 0) button.className = "primary";
    button.addEventListener("click", () => runTask(task));
    box.append(button);
  });
}

async function boot() {
  mountTasks();
  document.getElementById("open-settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
  document.getElementById("save-target").addEventListener("click", () => {
    saveTarget().catch((error) => say(targetStatus, error.message || "保存失败", true));
  });
  const [target, jobs, history] = await Promise.all([
    request("BJD_COACH", "getTarget"),
    request("BJD_DB", "list"),
    request("BJD_COACH", "list"),
  ]);
  writeForm(target);
  renderPicks(Array.isArray(jobs) ? jobs : []);
  renderHistory(Array.isArray(history) ? history : []);
}

if (!globalThis.chrome?.runtime?.sendMessage) {
  say(statusNode, "请从插件里打开这个页面，不要直接双击文件。", true);
} else {
  boot().catch((error) => say(statusNode, error.message || "页面没有打开", true));
}
