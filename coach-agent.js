(function (root) {
  const TARGET_KEY = "bjd_target";
  const TARGET_FIELDS = ["role", "cities", "salary", "industry", "workMode", "experience", "mustHave", "avoid", "notes"];
  const TASKS = {
    recommend: "比较求职目标和收藏岗位，给出匹配高低、能拿出的优势、差距，以及建议的投递顺序。明确写出哪些先别投。",
    resume: "只根据已有简历提出修改建议：改哪一段、为什么、怎样写得更贴近目标岗位。可以建议删减和重排，禁止编造项目、公司、数据或时间。",
    apply: "给出投递顺序、沟通时第一句该强调的真实优势，以及哪些要求还没满足、不要先承诺。不要生成自动打招呼或自动投递脚本。",
    interview: "按这些岗位准备面试问题、只能依据简历作答的要点，以及求职者可以反问的问题。回答用提纲，不要写成虚假经历。",
  };
  const JOB_LIMIT = 6;

  function strings(value, limit = 6) {
    const list = Array.isArray(value) ? value : value ? [value] : [];
    return list.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit).map((item) => item.slice(0, 240));
  }

  function normalizeTarget(input) {
    const target = {};
    TARGET_FIELDS.forEach((key) => {
      const max = key === "notes" || key === "mustHave" || key === "avoid" ? 1000 : 120;
      const text = String(input?.[key] || "").trim().slice(0, max);
      target[key] = key === "notes" || key === "mustHave" || key === "avoid" ? text : text.replace(/\s+/g, " ");
    });
    return target;
  }

  function targetReady(target) {
    return Boolean(target.role || target.mustHave);
  }

  function tokens(value) {
    return String(value || "").split(/[\s,，、/|]+/).map((item) => item.trim()).filter((item) => item.length >= 2);
  }

  function scoreJob(job, target) {
    const hay = [job.title, job.company, job.location, job.industry, job.description, ...(job.tags || [])].join(" ").toLowerCase();
    let score = 0;
    tokens(target.role).forEach((token) => {
      if (hay.includes(token.toLowerCase())) score += 3;
    });
    tokens(target.cities).forEach((token) => {
      if (hay.includes(token.toLowerCase())) score += 2;
    });
    tokens(target.industry).forEach((token) => {
      if (hay.includes(token.toLowerCase())) score += 2;
    });
    tokens(target.mustHave).forEach((token) => {
      if (hay.includes(token.toLowerCase())) score += 2;
    });
    tokens(target.avoid).forEach((token) => {
      if (hay.includes(token.toLowerCase())) score -= 4;
    });
    return score;
  }

  function briefJob(job) {
    return {
      id: job.id,
      title: job.title || "",
      company: job.company || "",
      salary: job.salary || "",
      location: job.location || "",
      experience: job.experience || "",
      education: job.education || "",
      industry: job.industry || "",
      tags: Array.isArray(job.tags) ? job.tags.slice(0, 12) : [],
      description: String(job.description || "").slice(0, 800),
    };
  }

  async function readTarget() {
    const data = await chrome.storage.local.get(TARGET_KEY);
    return normalizeTarget(data[TARGET_KEY]);
  }

  async function writeTarget(input) {
    const target = normalizeTarget(input);
    await chrome.storage.local.set({ [TARGET_KEY]: target });
    return target;
  }

  async function buildContext(jobIds) {
    const db = root.BossJdDB;
    const target = await readTarget();
    if (!targetReady(target)) throw new Error("请先填写目标职位，或写上必须满足的条件。");
    const favorites = await db.listFavorites();
    const chosen = Array.isArray(jobIds) && jobIds.length
      ? favorites.filter((job) => jobIds.includes(job.id))
      : favorites;
    if (!chosen.length) throw new Error(jobIds?.length ? "选中的收藏已经不在了。" : "请先收藏至少一个岗位。");
    const ranked = chosen
      .map((job) => ({ job, score: scoreJob(job, target) }))
      .sort((a, b) => b.score - a.score || String(b.job.savedAt).localeCompare(String(a.job.savedAt)));
    const selected = ranked.slice(0, JOB_LIMIT).map((item) => item.job);
    const resumes = await db.listResumes();
    const resume = resumes.find((item) => item.isDefault) || resumes[0] || null;
    const full = resume ? await db.getResume(resume.id) : null;
    return {
      target,
      jobs: selected.map(briefJob),
      omitted: Math.max(0, chosen.length - selected.length),
      resumeName: resume?.name || "",
      resumeText: String(full?.text || "").slice(0, 6000),
    };
  }

  function present(context, analysis, sections) {
    const modelJobs = new Map((Array.isArray(analysis?.jobs) ? analysis.jobs : []).map((job) => [String(job.id || ""), job]));
    return {
      summary: String(analysis?.summary || "").trim().slice(0, 500),
      advantages: strings(analysis?.advantages),
      gaps: strings(analysis?.gaps),
      jobs: context.jobs.map((job) => {
        const extra = modelJobs.get(job.id) || {};
        const fit = ["高", "中", "低"].includes(extra.fit) ? extra.fit : "待看";
        return {
          id: job.id,
          title: job.title,
          company: job.company,
          salary: job.salary,
          location: job.location,
          url: context.urls?.get(job.id) || "",
          fit,
          why: String(extra.why || "这一条没有单独写出匹配理由。").trim().slice(0, 300),
          advantages: strings(extra.advantages, 4),
          gaps: strings(extra.gaps, 4),
        };
      }),
      sections: (Array.isArray(sections) ? sections : []).slice(0, 4).map((section) => ({
        heading: String(section.heading || "建议").trim().slice(0, 40),
        items: (Array.isArray(section.items) ? section.items : []).slice(0, 6).map((item) => ({
          title: String(item.title || "").trim().slice(0, 40),
          detail: String(item.detail || "").trim().slice(0, 500),
        })).filter((item) => item.detail),
      })).filter((section) => section.items.length),
    };
  }

  async function analyze(settings, context) {
    const data = await root.BossJdLlm.askJson(settings, [
      {
        role: "system",
        content: "你是求职分析助手。只依据给定的求职目标、简历原文和岗位摘录。没有简历时不要猜测经历。优势必须能从简历或岗位要求里指出来。禁止编造公司、项目、年限和数字。只返回 JSON：{\"summary\":\"\",\"advantages\":[\"\"],\"gaps\":[\"\"],\"jobs\":[{\"id\":\"\",\"fit\":\"高|中|低\",\"why\":\"\",\"advantages\":[\"\"],\"gaps\":[\"\"]}]}",
      },
      {
        role: "user",
        content: JSON.stringify({
          target: context.target,
          resumeName: context.resumeName,
          resumeText: context.resumeText,
          jobs: context.jobs,
        }),
      },
    ]);
    return data && typeof data === "object" ? data : {};
  }

  async function deliver(settings, task, context, analysis) {
    const data = await root.BossJdLlm.askJson(settings, [
      {
        role: "system",
        content: `你正在完成这一步：${TASKS[task]}。沿用上一步的分析，不要推翻已指出的差距，也不要新增简历里没有的经历。只返回 JSON：{\"sections\":[{\"heading\":\"\",\"items\":[{\"title\":\"\",\"detail\":\"\"}]}]}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          task,
          target: context.target,
          resumeText: context.resumeText,
          analysis,
        }),
      },
    ]);
    return Array.isArray(data?.sections) ? data.sections : [];
  }

  async function advise(task, jobIds) {
    if (!TASKS[task]) throw new Error("未知的建议类型");
    const settings = await root.BossJdLlm.readSettings();
    if (!root.BossJdLlm.configured(settings)) throw new Error("请先在「简历和模型」里填写并授权模型。");
    const context = await buildContext(jobIds);
    const favorites = await root.BossJdDB.listFavorites();
    context.urls = new Map(favorites.map((job) => [job.id, job.url || ""]));
    const analysis = await analyze(settings, context);
    let sections = [];
    let warning = "";
    try {
      sections = await deliver(settings, task, context, analysis);
    } catch (error) {
      warning = error.message || "详细建议没有生成，下面仍保留匹配分析。";
    }
    const result = {
      task,
      createdAt: new Date().toISOString(),
      warning,
      omittedJobCount: context.omitted,
      resumeName: context.resumeName,
      ...present(context, analysis, sections),
    };
    await root.BossJdDB.saveAdvice(result);
    return result;
  }

  async function handle(message) {
    if (message.op === "getTarget") return readTarget();
    if (message.op === "saveTarget") return writeTarget(message.target);
    if (message.op === "list") return root.BossJdDB.listAdvice();
    if (message.op === "advise") return advise(message.task, message.jobIds);
    throw new Error("未知的建议操作");
  }

  root.BossJdCoach = {
    TARGET_FIELDS,
    TASKS,
    normalizeTarget,
    present,
    handle,
  };
})(globalThis);
