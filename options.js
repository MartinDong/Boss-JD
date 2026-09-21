const db = globalThis.BossJdDB;
const textApi = globalThis.BossJdResumeText;
const agent = globalThis.BossJdAgent;

const baseUrlInput = document.getElementById("base-url");
const modelInput = document.getElementById("model");
const apiKeyInput = document.getElementById("api-key");
const modelStatus = document.getElementById("model-status");
const resumeName = document.getElementById("resume-name");
const resumeFocus = document.getElementById("resume-focus");
const resumeText = document.getElementById("resume-text");
const resumeStatus = document.getElementById("resume-status");
const resumeList = document.getElementById("resume-list");
const fileInput = document.getElementById("resume-file");

let editingId = "";
let editingFile = undefined;

function say(node, message, isError) {
  node.textContent = message;
  node.style.color = isError ? "#b91c1c" : "#0f766e";
}

function resetEditor() {
  editingId = "";
  editingFile = undefined;
  resumeName.value = "";
  resumeFocus.value = "";
  resumeText.value = "";
  fileInput.value = "";
}

function renderResume(resume) {
  const item = document.createElement("article");
  item.className = "resume";
  const main = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = resume.name || "未命名简历";
  if (resume.isDefault) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = " · 默认";
    title.append(badge);
  }
  const meta = document.createElement("p");
  const preview = String(resume.text || "").replace(/\s+/g, " ").slice(0, 80);
  meta.textContent = preview || "还没有正文，点编辑后粘贴。";
  main.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "actions";
  const edit = button("编辑", () => {
    editingId = resume.id;
    editingFile = undefined;
    resumeName.value = resume.name || "";
    resumeFocus.value = resume.focus || "";
    resumeText.value = resume.text || "";
    say(resumeStatus, "正在编辑。不重新上传文件的话，原来的附件会保留。");
  });
  const use = button(resume.isDefault ? "已是默认" : "设为默认", async () => {
    await db.setDefaultResume(resume.id);
    await refreshResumes();
  });
  use.disabled = resume.isDefault;
  const remove = button("删除", async () => {
    if (!confirm(`删除「${resume.name || "未命名简历"}」？`)) return;
    await db.removeResume(resume.id);
    if (editingId === resume.id) resetEditor();
    await refreshResumes();
  });
  actions.append(edit, use, remove);
  item.append(main, actions);
  return item;
}

function button(text, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = text;
  node.addEventListener("click", () => {
    Promise.resolve(onClick()).catch((error) => say(resumeStatus, error.message || "操作失败", true));
  });
  return node;
}

async function refreshResumes() {
  const rows = await db.listResumes();
  resumeList.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "还没有简历。";
    resumeList.append(empty);
    return;
  }
  rows.forEach((resume) => resumeList.append(renderResume(resume)));
}

async function loadSettings() {
  const saved = await agent.readSettings();
  baseUrlInput.value = saved.baseUrl;
  modelInput.value = saved.model;
  apiKeyInput.value = "";
  apiKeyInput.placeholder = saved.apiKey ? "已保存在本机，留空则不修改" : "粘贴你的 API 密钥";
}

document.getElementById("save-model").addEventListener("click", async () => {
  const baseUrl = baseUrlInput.value.trim();
  const model = modelInput.value.trim();
  let origin = "";
  try {
    origin = agent.originPattern(baseUrl);
  } catch {
    say(modelStatus, "接口地址需要是完整的 http 或 https 链接。", true);
    return;
  }
  if (!model) {
    say(modelStatus, "请先填写模型名称。", true);
    return;
  }
  if (!apiKeyInput.value.trim() && !apiKeyInput.placeholder.startsWith("已保存")) {
    say(modelStatus, "请先填写 API 密钥。", true);
    return;
  }
  const granted = await chrome.permissions.request({ origins: [origin] });
  const current = await agent.readSettings();
  const apiKey = apiKeyInput.value.trim() || current.apiKey;
  if (!model || !apiKey) {
    say(modelStatus, "模型和密钥都要填写。密钥留空时会继续用本机已保存的那一个。", true);
    return;
  }
  await agent.writeSettings({ baseUrl, model, apiKey });
  apiKeyInput.value = "";
  await loadSettings();
  say(modelStatus, granted ? "已保存，并允许插件访问这个模型地址。" : "已保存在本机，但没有获得访问权限。测试和填写前需要点一次授权。");
});

document.getElementById("test-model").addEventListener("click", async () => {
  say(modelStatus, "正在测试…");
  try {
    const text = await chrome.runtime.sendMessage({ type: "BJD_AGENT", op: "test" });
    if (!text?.ok) throw new Error(text?.error || "连接失败");
    say(modelStatus, `连接成功：${text.result}`);
  } catch (error) {
    say(modelStatus, error.message || "连接失败", true);
  }
});

fileInput.addEventListener("change", async () => {
  const files = [...(fileInput.files || [])];
  if (!files.length) return;
  if (files.some((file) => file.size > 8 * 1024 * 1024)) {
    say(resumeStatus, "单个文件请小于 8MB。", true);
    return;
  }
  if (files.length > 1) {
    say(resumeStatus, "正在保存多份简历…");
    try {
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const text = await textApi.extract(buffer, file.name);
        await db.saveResume({
          name: file.name.replace(/\.[^.]+$/, ""),
          filename: file.name,
          mime: file.type || "application/octet-stream",
          text,
          file: new Blob([buffer], { type: file.type || "application/octet-stream" }),
        });
      }
      resetEditor();
      say(resumeStatus, `已保存 ${files.length} 份到本机。`);
      await refreshResumes();
    } catch (error) {
      say(resumeStatus, error.message || "保存失败", true);
    }
    return;
  }
  const file = files[0];
  say(resumeStatus, "正在读取文件…");
  try {
    const buffer = await file.arrayBuffer();
    const text = await textApi.extract(buffer, file.name);
    editingFile = new Blob([buffer], { type: file.type || "application/octet-stream" });
    if (!resumeName.value.trim()) resumeName.value = file.name.replace(/\.[^.]+$/, "");
    resumeText.value = text;
    fileInput.dataset.filename = file.name;
    fileInput.dataset.mime = file.type || "application/octet-stream";
    say(resumeStatus, text ? "已抽出正文，确认后点保存。" : "没有抽出文字。可以把正文贴到上面再保存，附件仍会用于上传。");
  } catch (error) {
    say(resumeStatus, error.message || "读取失败", true);
  }
});

document.getElementById("new-resume").addEventListener("click", () => {
  resetEditor();
  say(resumeStatus, "可以上传新文件，或直接粘贴正文。");
});

document.getElementById("save-resume").addEventListener("click", async () => {
  const name = resumeName.value.trim();
  const text = resumeText.value.trim();
  if (!name && !text) {
    say(resumeStatus, "先写一个名称，或贴上正文。", true);
    return;
  }
  const saved = await db.saveResume({
    id: editingId || undefined,
    name: name || fileInput.dataset.filename || "未命名简历",
    focus: resumeFocus.value,
    filename: editingFile ? fileInput.dataset.filename || "" : undefined,
    mime: editingFile ? fileInput.dataset.mime || "application/octet-stream" : undefined,
    text,
    file: editingFile,
  });
  editingId = saved.id;
  editingFile = undefined;
  say(resumeStatus, "已保存到本机。");
  await refreshResumes();
});

if (!globalThis.chrome?.storage?.local || !globalThis.chrome?.runtime?.sendMessage) {
  say(modelStatus, "请在扩展管理页里打开「扩展选项」，不要直接双击这个文件。", true);
} else {
  loadSettings().then(refreshResumes).catch((error) => {
    say(modelStatus, error.message || "配置页打不开", true);
  });
}
