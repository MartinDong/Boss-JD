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
    empty.textContent = "还没有收藏。先在岗位页提取或「导入岗位」，再回来生成建议。";
    picksNode.append(empty);
    return;
  }
  const pickHead = document.createElement("div");
  pickHead.className = "pick-head";
  const pickAll = document.createElement("label");
  pickAll.className = "pick-all";
  const allInput = document.createElement("input");
  allInput.type = "checkbox";
  allInput.checked = false;
  const allText = document.createElement("span");
  allText.textContent = "全选";
  pickAll.append(allInput, allText);
  const count = document.createElement("span");
  count.className = "count";
  const syncCount = () => {
    const total = picksNode.querySelectorAll(".pick input").length;
    const picked = picksNode.querySelectorAll(".pick input:checked").length;
    count.textContent = total ? `已选 ${picked}/${total}` : "";
  };
  allInput.addEventListener("change", () => {
    picksNode.querySelectorAll(".pick input").forEach((node) => {
      node.checked = allInput.checked;
    });
    syncCount();
  });
  pickHead.append(count, pickAll);
  picksNode.append(pickHead);
  jobs.forEach((job) => {
    const label = document.createElement("label");
    label.className = "pick";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = job.id;
    input.addEventListener("change", syncCount);
    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = job.title || "未命名岗位";
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = [
      job.company,
      job.salary,
      job.location,
      job.source === "manual" ? "手动" : "",
      job.applyStatus ? `已标记：${job.applyStatus}` : "",
    ].filter(Boolean).join(" · ");
    text.append(title, meta);
    label.append(input, text);
    picksNode.append(label);
  });
  syncCount();
}

function renderResumePicker(resumes) {
  const box = document.getElementById("resume-picker");
  const select = document.getElementById("resume-select");
  const aside = document.getElementById("resume-aside");
  if (!box || !select || !aside) return;
  const list = Array.isArray(resumes) ? resumes : [];
  if (list.length < 2) {
    box.style.display = "none";
    return;
  }
  box.style.display = "";
  select.replaceChildren();
  const first = document.createElement("option");
  first.value = "";
  first.textContent = "默认简历";
  select.append(first);
  (Array.isArray(resumes) ? resumes : []).forEach((resume) => {
    const option = document.createElement("option");
    option.value = resume.id;
    option.textContent = resume.isDefault ? `${resume.name}（默认）` : resume.name;
    select.append(option);
  });
  select.value = "";
  const refreshAside = () => {
    const chosen = (Array.isArray(resumes) ? resumes : []).find((item) => item.id === select.value);
    const used = chosen || (Array.isArray(resumes) ? resumes : []).find((item) => item.isDefault) || null;
    aside.textContent = used?.focus ? `适合方向：${used.focus}` : "";
  };
  select.addEventListener("change", refreshAside);
  refreshAside();
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

function renderMatrix(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) return null;
  const table = document.createElement("table");
  table.className = "matrix";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["要求", "类型", "满足", "依据"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.append(th);
  });
  thead.append(headRow);
  table.append(thead);
  const tbody = document.createElement("tbody");
  matrix.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = `met-${row.met}`;
    [row.requirement, row.kind, row.met, row.evidence].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value || "";
      tr.append(td);
    });
    tr.title = row.evidence || "";
    tbody.append(tr);
  });
  table.append(tbody);
  return table;
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
  if (result.referencedHistory?.length) {
    const used = document.createElement("p");
    used.className = "hint";
    used.textContent = `参考了最近 ${result.referencedHistory.length} 条历史结局：${result.referencedHistory.join("；")}。挂过的岗位只标注，不会自动排除。`;
    root.append(used);
  }
  const matrix = renderMatrix(result.matrix);
  if (matrix) {
    const block = document.createElement("section");
    block.className = "section matrix-block";
    const heading = document.createElement("h3");
    heading.textContent = "要求对比（必备项 / 加分项）";
    block.append(heading, matrix);
    root.append(block);
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
    heading.textContent = [job.title || "未命名岗位", job.company, job.source === "手动" ? "（手动）" : ""].filter(Boolean).join(" · ");
    const fit = document.createElement("span");
    fit.className = `fit fit-${job.fit}`;
    fit.textContent = job.fit || "待看";
    if (job.applied) {
      const applied = document.createElement("span");
      applied.className = "applied";
      applied.textContent = `已标记：${job.applied}`;
      top.append(applied);
    }
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
    const result = await request("BJD_COACH", "advise", {
      task,
      jobIds: selectedJobIds(),
      resumeId: document.getElementById("resume-select")?.value || "",
    });
    renderResult(result);
    const rows = await request("BJD_COACH", "list");
    renderHistory(Array.isArray(rows) ? rows : []);
    say(statusNode, result.resumeName ? `已按「${result.resumeName}」生成。请自己核对后再投递或修改简历。` : "还没有简历正文，这次只比较了目标和岗位。");
  } catch (error) {
    say(statusNode, error.message || "生成失败", true);
  } finally {
    setBusy(false);
  }
}

function mountInterviewCard(jobs, interviews) {
  const box = document.getElementById("interview-card");
  if (!box) return;
  const renderAll = (rows) => {
    const listNode = document.getElementById("interview-list");
    listNode.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "还没有复盘。面完一次记一条，下次生成建议时会参考。";
      listNode.append(empty);
      return;
    }
    rows.forEach((row) => {
      const item = document.createElement("article");
      item.className = "interview";
      const head = document.createElement("div");
      head.className = "job-top";
      const title = document.createElement("strong");
      title.textContent = `${row.companyName || "未填公司"} · ${row.role || "未填职位"}`;
      const outcome = document.createElement("span");
      outcome.className = `fit outcome-${row.outcome}`;
      outcome.textContent = `${row.date} ${row.outcome}`;
      head.append(title, outcome);
      const detail = document.createElement("p");
      detail.className = "meta";
      const questions = row.questions.length ? `被问：${row.questions.join(" / ")}` : "";
      detail.textContent = [questions, row.feedback ? `原话：${row.feedback}` : "", row.takeaway ? `下次改：${row.takeaway}` : ""].filter(Boolean).join("；");
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "删除";
      del.addEventListener("click", async () => {
        if (!confirm("删除这条复盘？")) return;
        await request("BJD_INTERVIEW", "remove", { id: row.id });
        renderAll(await request("BJD_INTERVIEW", "list"));
      });
      item.append(head, detail, del);
      listNode.append(item);
    });
  };

  const form = document.createElement("div");
  form.className = "interview-form";
  const rowOne = document.createElement("div");
  rowOne.className = "split";
  const jobSelect = document.createElement("select");
  jobSelect.setAttribute("aria-label", "关联岗位");
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "手填公司（不关联收藏）";
  jobSelect.append(emptyOption);
  jobs.forEach((job) => {
    const option = document.createElement("option");
    option.value = job.id;
    option.textContent = [job.company, job.title].filter(Boolean).join(" · ");
    jobSelect.append(option);
  });
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.setAttribute("aria-label", "日期");
  rowOne.append(jobSelect, dateInput);
  const companyInput = document.createElement("input");
  companyInput.type = "text";
  companyInput.placeholder = "公司（手填）";
  const roleInput = document.createElement("input");
  roleInput.type = "text";
  roleInput.placeholder = "职位（手填）";
  const questionInput = document.createElement("input");
  questionInput.type = "text";
  questionInput.placeholder = "被问的问题，回车逐条添加";
  const questionList = document.createElement("ul");
  questionList.className = "question-list";
  questionInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !questionInput.value.trim()) return;
    event.preventDefault();
    const li = document.createElement("li");
    li.textContent = questionInput.value.trim().slice(0, 500);
    questionList.append(li);
    questionInput.value = "";
  });
  const outcomeSelect = document.createElement("select");
  outcomeSelect.setAttribute("aria-label", "结果");
  ["没回音", "过", "挂"].forEach((label) => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    outcomeSelect.append(option);
  });
  const feedbackInput = document.createElement("input");
  feedbackInput.type = "text";
  feedbackInput.placeholder = "对方给的原话反馈（选填）";
  const salaryInput = document.createElement("input");
  salaryInput.type = "text";
  salaryInput.placeholder = "薪资阶段（选填，例如：谈了25K）";
  const takeawayInput = document.createElement("input");
  takeawayInput.type = "text";
  takeawayInput.placeholder = "下次要改的一点";
  const save = document.createElement("button");
  save.type = "button";
  save.className = "primary";
  save.textContent = "记录这次复盘";
  save.addEventListener("click", async () => {
    save.disabled = true;
    try {
      const chosenJob = jobs.find((item) => item.id === jobSelect.value);
      await request("BJD_INTERVIEW", "save", {
        record: {
          jobId: jobSelect.value,
          companyName: chosenJob?.company || companyInput.value,
          role: chosenJob?.title || roleInput.value,
          date: dateInput.value,
          questions: [...questionList.querySelectorAll("li")].map((li) => li.textContent),
          outcome: outcomeSelect.value,
          feedback: feedbackInput.value,
          salaryStage: salaryInput.value,
          takeaway: takeawayInput.value,
        },
      });
      [companyInput, roleInput, feedbackInput, salaryInput, takeawayInput].forEach((input) => {
        input.value = "";
      });
      questionList.replaceChildren();
      renderAll(await request("BJD_INTERVIEW", "list"));
      say(statusNode, "复盘已保存，下次生成建议会参考最近几条。");
    } catch (error) {
      say(statusNode, error.message || "保存失败", true);
    } finally {
      save.disabled = false;
    }
  });
  form.append(rowOne, companyInput, roleInput, questionInput, questionList, outcomeSelect, feedbackInput, salaryInput, takeawayInput, save);
  box.append(form, document.createElement("hr"), Object.assign(document.createElement("div"), { id: "interview-list" }));
  renderAll(interviews);
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
  const [target, jobs, history, resumes, interviews] = await Promise.all([
    request("BJD_COACH", "getTarget"),
    request("BJD_DB", "list"),
    request("BJD_COACH", "list"),
    request("BJD_COACH", "resumes"),
    request("BJD_INTERVIEW", "list"),
  ]);
  writeForm(target);
  renderPicks(Array.isArray(jobs) ? jobs : []);
  renderHistory(Array.isArray(history) ? history : []);
  renderResumePicker(Array.isArray(resumes) ? resumes : []);
  mountInterviewCard(jobs || [], interviews || []);
}

if (!globalThis.chrome?.runtime?.sendMessage) {
  say(statusNode, "请从插件里打开这个页面，不要直接双击文件。", true);
} else {
  boot().catch((error) => say(statusNode, error.message || "页面没有打开", true));
}
