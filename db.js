(function (root) {
  const DB_NAME = "boss-jd";
  const DB_VERSION = 3;
  const STORE = "favorites";
  const RESUMES = "resumes";
  const ADVICE = "advice";
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
        if (!db.objectStoreNames.contains(RESUMES)) {
          const resumes = db.createObjectStore(RESUMES, { keyPath: "id" });
          resumes.createIndex("updatedAt", "updatedAt", { unique: false });
        }
        if (!db.objectStoreNames.contains(ADVICE)) {
          db.createObjectStore(ADVICE, { keyPath: "id" });
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

  function publicResume(record) {
    if (!record) return null;
    return {
      id: record.id,
      name: record.name || "未命名简历",
      filename: record.filename || "",
      mime: record.mime || "",
      text: record.text || "",
      updatedAt: record.updatedAt || "",
      isDefault: Boolean(record.isDefault),
      hasFile: Boolean(record.file),
    };
  }

  async function readResumes() {
    const db = await openDb();
    const tx = db.transaction(RESUMES, "readonly");
    const rows = await requestToPromise(tx.objectStore(RESUMES).getAll());
    await transactionDone(tx);
    db.close();
    return rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async function readResume(id) {
    const db = await openDb();
    const tx = db.transaction(RESUMES, "readonly");
    const row = await requestToPromise(tx.objectStore(RESUMES).get(id));
    await transactionDone(tx);
    db.close();
    return row || null;
  }

  async function writeResume(record) {
    const db = await openDb();
    const tx = db.transaction(RESUMES, "readwrite");
    tx.objectStore(RESUMES).put(record);
    await transactionDone(tx);
    db.close();
  }

  async function saveResume(input) {
    await ensureReady();
    const existing = input?.id ? await readResume(input.id) : null;
    const rows = existing ? [] : await readResumes();
    const now = new Date().toISOString();
    const record = {
      id: existing?.id || input.id || crypto.randomUUID(),
      name: String(input.name || input.filename || existing?.name || "未命名简历").slice(0, 80),
      filename: input.filename || existing?.filename || "",
      mime: input.mime || existing?.mime || "text/plain",
      text: String(input.text ?? existing?.text ?? "").slice(0, 200000),
      updatedAt: now,
      isDefault: input.isDefault != null ? Boolean(input.isDefault) : Boolean(existing?.isDefault),
      file: input.file === undefined ? existing?.file || null : input.file,
    };
    if (!existing && !rows.length) record.isDefault = true;
    if (record.isDefault) {
      const all = await readResumes();
      for (const row of all) {
        if (row.id !== record.id && row.isDefault) {
          row.isDefault = false;
          await writeResume(row);
        }
      }
    }
    await writeResume(record);
    return publicResume(record);
  }

  async function listResumes() {
    await ensureReady();
    return (await readResumes()).map(publicResume);
  }

  async function getResume(id) {
    await ensureReady();
    return readResume(id);
  }

  async function setDefaultResume(id) {
    await ensureReady();
    const rows = await readResumes();
    if (!rows.some((row) => row.id === id)) throw new Error("没有找到这份简历");
    for (const row of rows) {
      const next = row.id === id;
      if (Boolean(row.isDefault) !== next) {
        row.isDefault = next;
        await writeResume(row);
      }
    }
    return true;
  }

  async function removeResume(id) {
    await ensureReady();
    const current = await readResume(id);
    if (!current) return false;
    const db = await openDb();
    const tx = db.transaction(RESUMES, "readwrite");
    tx.objectStore(RESUMES).delete(id);
    await transactionDone(tx);
    db.close();
    if (current.isDefault) {
      const [next] = await readResumes();
      if (next) await setDefaultResume(next.id);
    }
    return true;
  }

  async function saveAdvice(result) {
    await ensureReady();
    const record = { ...result, id: result.task };
    const db = await openDb();
    const tx = db.transaction(ADVICE, "readwrite");
    tx.objectStore(ADVICE).put(record);
    await transactionDone(tx);
    db.close();
    return record;
  }

  async function listAdvice() {
    await ensureReady();
    const db = await openDb();
    const tx = db.transaction(ADVICE, "readonly");
    const rows = await requestToPromise(tx.objectStore(ADVICE).getAll());
    await transactionDone(tx);
    db.close();
    return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  root.BossJdDB = {
    DB_NAME,
    saveFavorite,
    listFavorites,
    getFavorite,
    removeFavorite,
    clearFavorites,
    recordId,
    saveResume,
    listResumes,
    getResume,
    setDefaultResume,
    removeResume,
    publicResume,
    saveAdvice,
    listAdvice,
  };
})(globalThis);
