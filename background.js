importScripts("db.js");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "BJD_DB") return;
  handleDb(message)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || "本地数据库操作失败" }));
  return true;
});

async function handleDb(message) {
  const db = globalThis.BossJdDB;
  if (message.op === "save") return db.saveFavorite(message.job);
  if (message.op === "list") return db.listFavorites();
  if (message.op === "get") return db.getFavorite(message.id);
  if (message.op === "remove") return db.removeFavorite(message.id);
  if (message.op === "clear") {
    await db.clearFavorites();
    return true;
  }
  throw new Error("未知的数据库操作");
}
