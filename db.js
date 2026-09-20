(function (root) {
  const DB_NAME = "boss-jd";
  const DB_VERSION = 1;
  const STORE = "favorites";
  const FIELDS = [
    "title",
    "salary",
    "salaryNote",
    "location",
    "experience",
    "education",
    "description",
    "company",
    "industry",
    "financing",
    "scale",
    "companyAddress",
    "distance",
    "recruiter",
    "recruiterTitle",
    "recruiterActive",
    "address",
    "updatedAt",
    "extractedAt",
  ];

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("jobId", "jobId", { unique: false });
          store.createIndex("savedAt", "savedAt", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function recordId(job) {
    const url = String(job.url || "").split("#")[0];
    return job.jobId || url;
  }

  function toRecord(job, existing) {
    const url = String(job.url || "").split("#")[0];
    const jobId = job.jobId || "";
    const id = jobId || url;
    if (!id) throw new Error("没有原始岗位链接，无法收藏");
    const now = new Date().toISOString();
    const record = {
      id,
      jobId,
      url,
      tags: Array.isArray(job.tags) ? job.tags.filter(Boolean) : [],
      savedAt: existing?.savedAt || now,
      revisedAt: now,
    };
    FIELDS.forEach((key) => {
      record[key] = job[key] == null ? "" : job[key];
    });
    return record;
  }

  async function putRecord(record) {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    await transactionDone(tx);
    db.close();
    return record;
  }

  function transactionDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("写入本地数据库失败"));
    });
  }

  async function readAll() {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const rows = await requestToPromise(tx.objectStore(STORE).getAll());
    db.close();
    return rows.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  }

  async function readOne(id) {
    if (!id) return null;
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const row = await requestToPromise(tx.objectStore(STORE).get(id));
    db.close();
    return row || null;
  }

  let ready;
  function ensureReady() {
    if (!ready) ready = migrateLegacy();
    return ready;
  }

  async function migrateLegacy() {
    const chromeStorage = root.chrome?.storage?.local;
    if (!chromeStorage) return;
    const data = await chromeStorage.get(["bjd_jobs", "bjd_db_migrated"]);
    if (data.bjd_db_migrated) return;
    const jobs = Array.isArray(data.bjd_jobs) ? data.bjd_jobs : [];
    for (const job of jobs) {
      if (!job || (!job.jobId && !job.url)) continue;
      const id = recordId(job);
      const existing = await readOne(id);
      const record = toRecord(job, existing);
      if (job.extractedAt && !existing) record.savedAt = job.extractedAt;
      await putRecord(record);
    }
    await chromeStorage.set({ bjd_db_migrated: true });
    await chromeStorage.remove("bjd_jobs");
  }

  async function saveFavorite(job) {
    await ensureReady();
    const id = recordId(job);
    const existing = await readOne(id);
    return putRecord(toRecord(job, existing));
  }

  async function listFavorites() {
    await ensureReady();
    return readAll();
  }

  async function getFavorite(id) {
    await ensureReady();
    return readOne(id);
  }

  async function removeFavorite(id) {
    await ensureReady();
    if (!id) return false;
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await transactionDone(tx);
    db.close();
    return true;
  }

  async function clearFavorites() {
    await ensureReady();
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await transactionDone(tx);
    db.close();
  }

  root.BossJdDB = {
    DB_NAME,
    saveFavorite,
    listFavorites,
    getFavorite,
    removeFavorite,
    clearFavorites,
    recordId,
  };
})(globalThis);
