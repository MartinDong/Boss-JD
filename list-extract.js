(function (root) {
  const extract = root.BossJdExtract || {};

  // 列表页 URL 特征：推荐/搜索结果页（/web/geek/jobs），不含岗位详情页。
  function isListPage() {
    return /\/web\/geek\/jobs/.test(location.pathname + location.search);
  }

  function cardSelector() {
    return [
      ".job-card-wrapper",
      "ul.job-list-box > li",
      ".job-list-box li",
      ".search-job-result .job-card-wrapper",
      "[ka^='search_list_']",
      ".job-card-body",
    ].join(", ");
  }

  function one(selectors, scope) {
    const rootEl = scope || document;
    for (const selector of selectors) {
      const el = rootEl.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function pickText(selectors, scope) {
    const el = one(selectors, scope);
    const value = extract.textOf ? extract.textOf(el) : (el?.innerText || "").trim();
    return value.replace(/\s+/g, " ").trim();
  }

  // 卡片上的原始概要行（地点 / 经验 / 学历 / 标签等），兜底解析的输入。
  function rawLines(card) {
    const text = extract.textOf ? extract.textOf(card) : (card?.innerText || "");
    return String(text || "")
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  const SALARY_RE = /^\d+\s*[-~～]\s*\d+\s*(K|k|万|W|w)?(?:·\s*\d+\s*薪)?$/;
  const PAY_TERM_RE = /\d+\s*薪|按天|按月|日结|周结|五险一金?/;
  const AREA_HINT_RE = /区|县|镇|科技园|软件园|开发区|工业园|大道|路|街|栋|座|层|广场|中心/;
  const DISTANCE_RE = /距(?:你|您|我|离)|直线距离|距离当前位置|[\d.]+\s*km/;

  function isSalary(line) {
    if (extract.looksEncrypted && extract.looksEncrypted(line)) return true;
    return SALARY_RE.test(line.replace(/\s+/g, ""));
  }

  function isExperience(line) {
    return /经验不限|在校\/应届|在校生|应届生|应届|^\d+\s*[-~～]\s*\d+\s*年$|^\d+\s*年(以内|以上|经验)?$|^\d+年$/.test(line);
  }

  function isEducation(line) {
    return /学历不限|初中及以下|初中|中专\/中技|中专|中技|高中|大专|本科|硕士|博士/.test(line) && line.length <= 8;
  }

  function isCompanyLine(line) {
    if (/^\d/.test(line)) return false;
    return line.length >= 2 && line.length <= 40 && !SALARY_RE.test(line) && !isExperience(line) && !isEducation(line);
  }

  function cardTitle(card) {
    const direct = pickText(
      [".job-name", ".job-title", ".position-name", "h3", ".name"],
      card
    );
    if (direct) return direct;
    const link = one(["a[href*='/job_detail/']", "a"], card);
    const fromLink = link
      ? (link.getAttribute("title") || link.textContent || "").replace(/\s+/g, " ").trim()
      : "";
    if (fromLink) return fromLink;
    // 兜底：卡片的第一个非薪资短行是职位名。
    return rawLines(card).find((line) => line && !isSalary(line) && line.length <= 30) || "";
  }

  function cardUrl(card) {
    const link = one(["a[href*='/job_detail/']", "a[ka]"], card);
    const href = link?.getAttribute("href") || "";
    if (!href) return "";
    return new URL(href, location.origin).href.split("#")[0];
  }

  function cardSalary(card) {
    const raw = pickText([".salary", ".job-salary", ".job-card-salary"], card);
    if (raw) return raw;
    return rawLines(card).find(isSalary) || "";
  }

  function cardArea(card) {
    const direct = pickText([".job-area", ".job-area-wrapper", ".job-location", ".job-position-area"], card);
    if (direct) return direct;
    return rawLines(card).find((line) => /市|区|县/.test(line) && !isSalary(line) && !isExperience(line) && !isEducation(line)) || "";
  }

  function cardTags(card) {
    const nodes = [
      ...card.querySelectorAll(
        ".job-card-footer .tag-list li, .job-info .tag-list li, .tag-list li, .job-tags li, .job-card-footer span, .filter-labels span, .job-tags span"
      ),
    ];
    const title = cardTitle(card);
    const area = cardArea(card);
    const tags = nodes
      .map((node) => (extract.textOf ? extract.textOf(node) : node.innerText || "").replace(/\s+/g, " ").trim())
      .filter((item) => item && item.length <= 20 && !SALARY_RE.test(item) && item !== title && item !== area);
    if (tags.length) return [...new Set(tags)];
    // 兜底：取位于经验/学历行之后、公司行之前的短语行。
    const lines = rawLines(card);
    const salaryIndex = lines.findIndex(isSalary);
    const companyIndex = lines.findIndex((line) => isCompanyLine(line) && !AREA_HINT_RE.test(line) && line !== area);
    const pool = lines.slice(salaryIndex + 1, companyIndex > salaryIndex ? companyIndex : undefined);
    return pool
      .filter((line) => !isExperience(line) && !isEducation(line) && !DISTANCE_RE.test(line) && line !== area && line.length >= 2 && line.length <= 12)
      .slice(0, 8);
  }

  function cardCompany(card) {
    const scope = one([".company-info", ".job-card-company", ".company", ".company-box"], card) || card;
    const direct = pickText([".name", ".company-name", "a[ka*='company']"], scope);
    if (direct && direct !== cardTitle(card)) return direct;
    // 兜底：经验/学历之后、品牌行之前的最短短语行更像公司名。
    const lines = rawLines(card);
    const expIdx = lines.findIndex(isExperience);
    const brandIdx = lines.findIndex((line) => /人|融资|轮|上市|国企|外资|民营/.test(line));
    const pool = lines.slice(expIdx + 1, brandIdx > expIdx ? brandIdx : undefined);
    const candidates = pool
      .filter((line) => !isEducation(line) && !DISTANCE_RE.test(line) && line.length >= 2 && line.length <= 20);
    return candidates.sort((a, b) => a.length - b.length)[0] || "";
  }

  function cardMeta(card) {
    const raw = pickText([".job-info .meta", ".job-card-left .meta", ".company-info p", ".start-chat-btn + p"], card);
    if (raw) return raw;
    const line = rawLines(card).find((item) => /人|融资|轮|上市|天使|A轮|B轮|C轮|D轮|不需要融资|国企|外资|民营|已上市/.test(item));
    return line || "";
  }

  function cardRecruiter(card) {
    const direct = pickText([".info-public", ".job-info-header", ".recruiter-name", ".boss-name"], card);
    if (direct) return direct;
    const line = rawLines(card).find((item) => /·|先生|女士|经理|主管|总监|HR|hr/.test(item) && item.length <= 24);
    return line || "";
  }

  function cardDistance(card) {
    const line = rawLines(card).find((item) => DISTANCE_RE.test(item) && item.length <= 30);
    return line || "";
  }

  function cardBrand(card) {
    return pickText([".company-info p", ".job-company-info", ".brand-meta"], card);
  }

  function toJob(card) {
    const title = cardTitle(card);
    const url = cardUrl(card);
    const jobIdMatch = url.match(/\/job_detail\/([^/?#]+)/);
    const area = cardArea(card);
    const meta = extract.classifyMeta
      ? extract.classifyMeta([area, cardBrand(card), cardRecruiter(card)])
      : { location: "", experience: "", education: "" };
    // classifyMeta 用分隔符切开后，薪资碎片（25-50K / 16薪）会被误当地点，剔除。
    const locationOnly = (meta.location || "")
      .split(" · ")
      .filter((piece) => piece && !/\d+\s*[-~～]\s*\d+/.test(piece) && !/薪|元|月/.test(piece))
      .filter((piece) => !/经验不限|应届|经验/.test(piece) && !/学历|本科|大专|硕士|博士|中专|高中/.test(piece))
      .join(" · ");
    const salaryRaw = cardSalary(card);
    const tags = cardTags(card);
    const encrypted = extract.looksEncrypted ? extract.looksEncrypted(salaryRaw) : /[\uE000-\uF8FF]/.test(salaryRaw);
    // 概要行：地点 + 经验/学历/标签，收藏列表折叠行直接展示。
    const summary = [area, ...tags, cardBrand(card)].filter(Boolean).join(" · ");
    const job = {
      ok: true,
      source: "list",
      jobId: jobIdMatch ? jobIdMatch[1].replace(/\.html$/i, "") : "",
      title,
      salary: encrypted ? "" : salaryRaw,
      salaryNote: encrypted ? "薪资被页面字体加密，请直接看网页上的显示。" : "",
      location: locationOnly || area,
      experience: meta.experience || rawLines(card).find(isExperience) || "",
      education: meta.education || rawLines(card).find(isEducation) || "",
      summary,
      tags,
      description: "",
      company: cardCompany(card),
      industry: "",
      financing: "",
      scale: "",
      companyAddress: "",
      distance: cardDistance(card),
      recruiter: "",
      recruiterTitle: "",
      recruiterActive: "",
      address: "",
      updatedAt: "",
      url,
      extractedAt: new Date().toISOString(),
    };
    return job;
  }

  function collectCards() {
    const scope = typeof document !== "undefined" ? document : root.__testDocument;
    const found = scope ? [...(scope.querySelectorAll(cardSelector()) || [])] : [];
    return found.filter(
      (card) => card.querySelector("a[href*='/job_detail/']") || pickText([".job-name", "h3"], card)
    );
  }

  function securityCheck() {
    const title = (typeof document !== "undefined" ? document.title : "") || "";
    if (/安全验证/.test(title)) {
      return {
        ok: false,
        reason: "verify",
        message: "当前是安全验证页。请先在页面里手动完成验证，等职位列表显示出来后再提取。",
      };
    }
    return null;
  }

  function extractList() {
    const verify = securityCheck();
    if (verify) return verify;
    if (!isListPage()) {
      return { ok: false, reason: "page", message: "这一页不是岗位列表页。" };
    }
    const cards = collectCards();
    if (!cards.length) {
      return {
        ok: false,
        reason: "empty",
        message: "列表还没有岗位卡片。请等推荐/搜索结果加载出来，或先手动完成安全验证。",
      };
    }
    return { ok: true, jobs: cards.map(toJob), count: cards.length };
  }

  root.BossJdList = {
    isListPage,
    extractList,
    cardSelector,
  };
})(globalThis);
