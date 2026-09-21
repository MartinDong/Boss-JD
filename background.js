importScripts("db.js", "llm.js", "agent.js", "coach-agent.js");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) return;
  if (message.type === "BJD_OPEN_PAGE") {
    const page = message.page === "coach.html" ? "coach.html" : "";
    if (!page) {
      sendResponse({ ok: false, error: "未知页面" });
      return;
    }
    chrome.tabs.create({ url: chrome.runtime.getURL(page) });
    sendResponse({ ok: true });
    return;
  }
  const task = message.type === "BJD_DB"
    ? handleDb(message)
    : message.type === "BJD_RESUME"
      ? handleResume(message)
        : message.type === "BJD_AGENT"
          ? handleAgent(message)
          : message.type === "BJD_INTERVIEW"
            ? handleInterview(message)
            : message.type === "BJD_COACH"
              ? globalThis.BossJdCoach.handle(message)
              : null;
  if (!task) return;
  task
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || "操作失败" }));
  return true;
});

async function handleDb(message) {
  const db = globalThis.BossJdDB;
  if (message.op === "save") return db.saveFavorite(message.job);
  if (message.op === "list") return db.listFavorites();
  if (message.op === "get") return db.getFavorite(message.id);
  if (message.op === "remove") return db.removeFavorite(message.id);
  if (message.op === "track") return db.updateTracking(message.id, {
    applyStatus: message.applyStatus,
    applyAt: message.applyAt,
    applyNote: message.applyNote,
  });
  if (message.op === "manual") return db.saveManualJob(message.job);
  if (message.op === "clear") {
    await db.clearFavorites();
    return true;
  }
  throw new Error("未知的数据库操作");
}

async function handleResume(message) {
  const db = globalThis.BossJdDB;
  if (message.op === "list") return db.listResumes();
  if (message.op === "save") {
    const file = message.buffer
      ? new Blob([new Uint8Array(message.buffer)], { type: message.mime || "application/octet-stream" })
      : undefined;
    return db.saveResume({
      id: message.id,
      name: message.name,
      filename: message.filename,
      mime: message.mime,
      text: message.text,
      isDefault: message.isDefault,
      file,
    });
  }
  if (message.op === "remove") return db.removeResume(message.id);
  if (message.op === "default") return db.setDefaultResume(message.id);
  if (message.op === "file") return resumeFile(message.id);
  throw new Error("未知的简历操作");
}

async function resumeFile(id) {
  const resume = await globalThis.BossJdDB.getResume(id);
  if (!resume?.file) return null;
  return {
    filename: resume.filename || `${resume.name || "resume"}.txt`,
    mime: resume.mime || "application/octet-stream",
    buffer: await resume.file.arrayBuffer(),
  };
}

async function handleAgent(message) {
  if (message.op === "test") return globalThis.BossJdAgent.testConnection();
  if (message.op !== "plan") throw new Error("未知的模型操作");
  const db = globalThis.BossJdDB;
  const resumes = await db.listResumes();
  const chosen = resumes.find((item) => item.id === message.resumeId) || resumes.find((item) => item.isDefault);
  if (!chosen) throw new Error("请先上传一份简历");
  const full = await db.getResume(chosen.id);
  if (!full?.text?.trim()) throw new Error("这份简历没有可用正文。请在配置页补上文字后再填写。");
  const fields = Array.isArray(message.fields) ? message.fields : [];
  const plan = await globalThis.BossJdAgent.plan(full.text, fields);
  const file = message.hasFile ? await resumeFile(chosen.id) : null;
  return { ...plan, file, resumeName: chosen.name };
}

async function handleInterview(message) {
  const db = globalThis.BossJdDB;
  if (message.op === "list") return db.listInterviews();
  if (message.op === "save") return db.saveInterview(message.record);
  if (message.op === "remove") return db.removeInterview(message.id);
  throw new Error("未知的复盘操作");
}
