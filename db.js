(function (root) {
  const DB_NAME = "boss-jd";
  const DB_VERSION = 4;
  const STORE = "favorites";
  const RESUMES = "resumes";
  const ADVICE = "advice";
  const INTERVIEWS = "interviews";
  const APPLICATION_STATUSES = ["已投", "约面", "终面", "挂了", "拿offer", ""];
  const TRACK_FIELDS = ["applyStatus", "applyAt", "applyNote"];
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
    "source",
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
        if (!db.objectStoreNames.contains(INTERVIEWS)) {
          const interviews = db.createObjectStore(INTERVIEWS, { keyPath: "id" });
          interviews.createIndex("date", "date", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("本地数据库打不开"));
    });
  }

  function recordId(job) {
    const url = String(job.url || "").split("#")[0];
    return job.jobId || url;
  }

  function toRecord(job, existing) {
    const url = String(job.url || "").split("#")[0];
    const id = job.jobId || url;
    if (!id) throw new Error("没有原始岗位链接，无法收藏");
    const now = new Date().toISOString();
    const record = {
      id: existing?.id || id,
      jobId: job.jobId || "",
      url,
      tags: Array.isArray(job.tags) ? job.tags.filter(Boolean) : [],
      savedAt: existing?.savedAt || now,
      revisedAt: now,
      applyStatus: existing?.applyStatus || "",
      applyAt: existing?.applyAt || "",
      applyNote: existing?.applyNote || "",
      source: existing?.source || (job.source === "manual" ? "manual" : "boss"),
    };
    FIELDS.forEach((key) => {
      record[key] = job[key] == null ? "" : job[key];
    });
    TRACK_FIELDS.forEach((key) => {
      if (job[key] !== undefined) record[key] = job[key];
    });
    return record;
  }

  function manualId(company, title) {
    const raw = `manual-${company}-${title}`.toLowerCase().replace(/\s+/g, "-");
    return `${raw}-${Math.abs([...raw].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7)) % 100000}`;
  }

  async function saveManualJob(input) {
    if (!input || typeof input !== "object") throw new Error("公司和职位都要填写");
    await ensureReady();
    const company = String(input.company || "").trim().slice(0, 120);
    const title = String(input.title || "").trim().slice(0, 120);
    const description = String(input.description || "").trim().slice(0, 50000);
    if (!company || !title) throw new Error("公司和职位都要填写");
    if (!description) throw new Error("请粘贴岗位正文");
    const url = String(input.url || "").trim();
    const id = manualId(company, title);
    const existing = await readOne(id);
    const now = new Date().toISOString();
    const record = {
      id,
      jobId: "",
      url: url && /^https?:\/\//i.test(url) ? url.split("#")[0] : "",
      title,
      company,
      description,
      tags: [],
      savedAt: existing?.savedAt || now,
      revisedAt: now,
      applyStatus: existing?.applyStatus || "",
      applyAt: existing?.applyAt || "",
      applyNote: existing?.applyNote || "",
      source: "manual",
    };
    ["salary", "location", "experience", "education", "industry", "financing", "scale", "address"].forEach((key) => {
      record[key] = String(input[key] || existing?.[key] || "").slice(0, 200);
    });
    await putRecord(record);
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

  async function updateTracking(id, patch) {
    await ensureReady();
    if (!id) throw new Error("缺少岗位标识");
    if (patch?.applyStatus !== undefined && !APPLICATION_STATUSES.includes(patch.applyStatus)) {
      throw new Error("未知的投递状态");
    }
    const existing = await readOne(id);
    if (!existing) throw new Error("这条收藏已经不存在");
    TRACK_FIELDS.forEach((key) => {
      existing[key] = String(patch?.[key] ?? "").slice(0, 200);
    });
    await putRecord(existing);
    return existing;
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
      focus: record.focus || "",
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
      focus: String(input.focus ?? existing?.focus ?? "").slice(0, 300),
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

  function publicInterview(record) {
    if (!record) return null;
    return {
      id: record.id,
      jobId: record.jobId || "",
      companyName: record.companyName || "",
      role: record.role || "",
      date: record.date || "",
      questions: Array.isArray(record.questions) ? record.questions.slice(0, 40) : [],
      outcome: record.outcome || "没回音",
      feedback: record.feedback || "",
      salaryStage: record.salaryStage || "",
      takeaway: record.takeaway || "",
      createdAt: record.createdAt || "",
    };
  }

  async function saveInterview(input) {
    await ensureReady();
    const now = new Date().toISOString();
    const record = {
      id: input.id || crypto.randomUUID(),
      jobId: String(input.jobId || ""),
      companyName: String(input.companyName || "").trim().slice(0, 120),
      role: String(input.role || "").trim().slice(0, 120),
      date: String(input.date || "").slice(0, 20),
      questions: (Array.isArray(input.questions) ? input.questions : [])
        .map((item) => String(item || "").trim().slice(0, 500))
        .filter(Boolean)
        .slice(0, 40),
      outcome: ["过", "挂", "没回音"].includes(input.outcome) ? input.outcome : "没回音",
      feedback: String(input.feedback || "").trim().slice(0, 2000),
      salaryStage: String(input.salaryStage || "").trim().slice(0, 200),
      takeaway: String(input.takeaway || "").trim().slice(0, 500),
      createdAt: input.createdAt || now,
    };
    if (!record.companyName && !record.jobId) throw new Error("选一个岗位，或填公司名");
    if (!record.date) throw new Error("填一下日期");
    const db = await openDb();
    const tx = db.transaction(INTERVIEWS, "readwrite");
    tx.objectStore(INTERVIEWS).put(record);
    await transactionDone(tx);
    db.close();
    return publicInterview(record);
  }

  async function listInterviews() {
    await ensureReady();
    const db = await openDb();
    const tx = db.transaction(INTERVIEWS, "readonly");
    const rows = await requestToPromise(tx.objectStore(INTERVIEWS).getAll());
    await transactionDone(tx);
    db.close();
    return rows.map(publicInterview).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  async function removeInterview(id) {
    await ensureReady();
    if (!id) return false;
    const db = await openDb();
    const tx = db.transaction(INTERVIEWS, "readwrite");
    tx.objectStore(INTERVIEWS).delete(id);
    await transactionDone(tx);
    db.close();
    return true;
  }

  root.BossJdDB = {
    DB_NAME,
    saveFavorite,
    listFavorites,
    getFavorite,
    removeFavorite,
    clearFavorites,
    updateTracking,
    saveManualJob,
    recordId,
    APPLICATION_STATUSES,
    saveResume,
    listResumes,
    getResume,
    setDefaultResume,
    removeResume,
    publicResume,
    saveAdvice,
    listAdvice,
    saveInterview,
    listInterviews,
    removeInterview,
    publicInterview,
  };
})(globalThis);
