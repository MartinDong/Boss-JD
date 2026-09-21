(function (root) {
  const DEGREE_RE = /学历不限|初中及以下|初中|中专\/中技|中专|中技|高中|大专|本科|硕士|博士/;
  const EXP_RE = /经验不限|在校\/应届|在校生|应届生|应届|\d+\s*[-~～]\s*\d+\s*年|\d+\s*年以内|\d+\s*年以上/;

  function clean(value) {
    return String(value || "")
      .replace(/[\u200b\u200c\u200d\ufeff\u00ad]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function textOf(el) {
    return el ? clean(el.innerText) : "";
  }

  function first(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function jobIdFromUrl(url) {
    const match = String(url || "").match(/\/job_detail\/([^/?#]+)/);
    return match ? match[1].replace(/\.html$/i, "") : "";
  }

  function looksEncrypted(value) {
    return /[\uE000-\uF8FF]/.test(value);
  }

  function splitMetaParts(value) {
    return String(value || "")
      .split(/[·•|]|\s{2,}|\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function classifyMeta(parts) {
    const location = [];
    let experience = "";
    let education = "";
    parts.forEach((rawPart) => {
      const pieces = splitMetaParts(rawPart);
      pieces.forEach((part) => {
        if (!experience && EXP_RE.test(part)) {
          experience = part;
          return;
        }
        if (!education && DEGREE_RE.test(part)) {
          education = part;
          return;
        }
        location.push(part);
      });
    });
    return {
      location: [...new Set(location)].join(" · "),
      experience,
      education,
    };
  }

  function metaParts() {
    const nodes = [
      ...document.querySelectorAll(
        ".info-primary p .text-city, .info-primary p .text-desc, .info-primary p a, .info-primary p span, .job-banner .info-primary p span, .job-banner .info-primary p a"
      ),
    ];
    const parts = nodes.map(textOf).filter(Boolean);
    if (parts.length) return [...new Set(parts)];

    const paragraph = first([".info-primary p", ".job-banner p"]);
    if (!paragraph) return [];
    return textOf(paragraph)
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function findDescription() {
    const direct = first([
      ".job-sec-text",
      ".job-detail-section .job-sec-text",
      ".job-detail .text",
    ]);
    if (direct && textOf(direct).length >= 8) return direct;

    const headings = [...document.querySelectorAll("h2, h3, .title, .job-sec-title")];
    const heading = headings.find((el) => textOf(el).includes("职位描述"));
    if (!heading) return null;

    let sibling = heading.nextElementSibling;
    while (sibling && textOf(sibling).length < 8) sibling = sibling.nextElementSibling;
    if (sibling) return sibling;

    const parent = heading.parentElement;
    if (!parent) return null;
    const clone = parent.cloneNode(true);
    clone.querySelectorAll("h2, h3, .title, .job-tags, ul, button").forEach((el) => el.remove());
    return textOf(clone).length >= 8 ? clone : null;
  }

  function tags() {
    const nodes = [
      ...document.querySelectorAll(
        ".job-tags span, .job-tags li, .job-keyword-list li, .job-detail-section ul li"
      ),
    ];
    return [...new Set(nodes.map(textOf).filter((item) => item && item.length <= 30))];
  }

  function companyBlock() {
    const rootEl = first([".sider-company", ".job-detail-company", ".company-info"]);
    if (!rootEl) {
      return { company: "", industry: "", financing: "", scale: "", companyAddress: "" };
    }
    const company = textOf(
      rootEl.querySelector(
        "a[ka*='company'], .company-name, h3.name a, h3 a, .name"
      )
    );
    const gray = rootEl.querySelector("p");
    const bits = gray
      ? [...gray.querySelectorAll("a, span")]
          .map(textOf)
          .filter(Boolean)
      : [];
    const industry = bits[0] || "";
    const rest = bits.slice(1);
    const scale = rest.find((item) => /人|规模/.test(item)) || "";
    const financing = rest.find((item) => item !== scale) || "";
    const companyAddress = textOf(
      rootEl.querySelector(".company-location, .location-address, .address, .company-address")
    );
    return { company, industry, financing, scale, companyAddress };
  }

  function recruiterBlock() {
    const rootEl = first([".job-boss-info", ".boss-info"]);
    if (!rootEl) return { recruiter: "", recruiterTitle: "", recruiterActive: "" };
    const nameEl = rootEl.querySelector("h2.name, .name");
    const titleEl = nameEl?.querySelector("em, span");
    const recruiterTitle = textOf(titleEl);
    const recruiter = textOf(nameEl).replace(recruiterTitle, "").trim();
    const recruiterActive = textOf(
      rootEl.querySelector(".boss-info-attr, .boss-active-time, .boss-online-tag")
    );
    return { recruiter, recruiterTitle, recruiterActive };
  }

  function addressText() {
    return textOf(
      first([
        ".location-address",
        ".job-location .location-address",
        ".job-address .address",
      ])
    );
  }

  function distanceText() {
    const labeled = [...document.querySelectorAll(
      ".location-distance, .job-location-distance, .distance, [class*='distance']"
    )]
      .map(textOf)
      .find((item) => item && item.length <= 40);
    if (labeled) return labeled;
    const area = textOf(first([".job-location", ".job-address", ".job-detail-location"]));
    const match = area.match(/距(?:你|您|我|离)[^\n]{0,24}|直线距离[^\n]{0,24}|距离当前位置[^\n]{0,24}/);
    return match ? match[0].trim() : "";
  }

  function updatedAt() {
    const nodes = [...document.querySelectorAll(".job-banner p, .gray, .time")];
    const hit = nodes.map(textOf).find((item) => /更新于|发布于/.test(item));
    return hit || "";
  }

  function extractJob() {
    const titleText = document.title || "";
    if (/安全验证/.test(titleText)) {
      return {
        ok: false,
        reason: "verify",
        message: "当前是安全验证页。请先在页面里手动完成验证，等职位内容显示出来后再提取。",
      };
    }
    if (/请稍候|正在加载/.test(titleText) && !document.querySelector(".job-sec-text, .info-primary h1")) {
      return {
        ok: false,
        reason: "loading",
        message: "页面还在加载。请等职位详情显示完整后再点一次提取。",
      };
    }

    const title = textOf(
      first([
        ".info-primary .name h1",
        ".job-banner h1.name",
        ".job-banner h1",
        "h1[title]",
        "h1",
      ])
    );
    const salaryRaw = textOf(first([".info-primary .salary", ".job-banner .salary", ".salary"]));
    const description = textOf(findDescription());

    if (!title && !description) {
      return {
        ok: false,
        reason: "empty",
        message: "这一页上还没有可提取的岗位内容。请确认打开的是职位详情，而不是首页或验证页。",
      };
    }

    const meta = classifyMeta(metaParts());
    const company = companyBlock();
    const recruiter = recruiterBlock();
    const address = addressText();
    const job = {
      ok: true,
      jobId: jobIdFromUrl(location.href),
      title,
      salary: looksEncrypted(salaryRaw) ? "" : salaryRaw,
      salaryNote: looksEncrypted(salaryRaw)
        ? "薪资被页面字体加密，请直接看网页上的显示。"
        : "",
      location: meta.location,
      experience: meta.experience,
      education: meta.education,
      tags: tags(),
      description,
      company: company.company,
      industry: company.industry,
      financing: company.financing,
      scale: company.scale,
      companyAddress: company.companyAddress || address,
      distance: distanceText(),
      recruiter: recruiter.recruiter,
      recruiterTitle: recruiter.recruiterTitle,
      recruiterActive: recruiter.recruiterActive,
      address,
      updatedAt: updatedAt(),
      url: location.href.split("#")[0],
      extractedAt: new Date().toISOString(),
    };
    return job;
  }

  function filled(rows) {
    return rows.filter(([, value]) => value);
  }

  function detailSections(job) {
    return [
      {
        title: "公司信息",
        rows: filled([
          ["名称", job.company],
          ["位置", job.companyAddress || job.address],
          ["距我", job.distance],
          ["行业", job.industry],
          ["融资", job.financing],
          ["规模", job.scale],
          ["招聘者", [job.recruiter, job.recruiterTitle].filter(Boolean).join(" · ")],
          ["活跃", job.recruiterActive],
        ]),
      },
      {
        title: "岗位信息",
        rows: filled([
          ["薪资", job.salary],
          ["城市", job.location],
          ["经验", job.experience],
          ["学历", job.education],
          ["标签", (job.tags || []).join("、")],
          ["更新", job.updatedAt],
        ]),
      },
    ];
  }

  function appendDetails(parent, job) {
    detailSections(job).forEach((section) => {
      if (!section.rows.length) return;
      const block = document.createElement("section");
      block.className = "block";
      const heading = document.createElement("h3");
      heading.textContent = section.title;
      const list = document.createElement("dl");
      list.className = "facts";
      section.rows.forEach(([label, value]) => {
        const term = document.createElement("dt");
        term.textContent = label;
        const detail = document.createElement("dd");
        detail.textContent = value;
        list.append(term, detail);
      });
      block.append(heading, list);
      parent.append(block);
    });
    const block = document.createElement("section");
    block.className = "block";
    const heading = document.createElement("h3");
    heading.textContent = "职位描述";
    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = job.description || "（没有职位描述）";
    block.append(heading, desc);
    parent.append(block);
    if (job.salaryNote) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = job.salaryNote;
      parent.append(note);
    }
  }

  function lines(job) {
    const rows = [
      ["薪资", job.salary],
      ["地点", job.location],
      ["经验", job.experience],
      ["学历", job.education],
      ["公司", job.company],
      ["公司位置", job.companyAddress || job.address],
      ["距我", job.distance],
      ["行业", job.industry],
      ["融资", job.financing],
      ["规模", job.scale],
      ["招聘者", [job.recruiter, job.recruiterTitle].filter(Boolean).join(" · ")],
      ["活跃", job.recruiterActive],
      ["标签", (job.tags || []).join("、")],
      ["页面更新", job.updatedAt],
      ["链接", job.url],
    ];
    return rows.filter(([, value]) => value);
  }

  function toMarkdown(job) {
    const head = lines(job)
      .map(([label, value]) => `- ${label}：${value}`)
      .join("\n");
    return `# ${job.title || "未命名岗位"}\n\n${head}\n\n## 职位描述\n\n${job.description || "（页面上没有读到职位描述）"}\n`;
  }

  function summaryLine(job) {
    const parts = [
      job.salary,
      job.location,
      [job.experience, job.education].filter(Boolean).join("/") || (job.summary || ""),
      job.company,
    ];
    const line = parts.filter(Boolean).join(" · ");
    return line || (job.summary || "");
  }

  function fileStem(job) {
    const base = job.title || job.jobId || "boss-job";
    return base.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40) || "boss-job";
  }

  root.BossJdExtract = {
    extractJob,
    toMarkdown,
    fileStem,
    detailSections,
    appendDetails,
    summaryLine,
    clean,
    textOf,
    looksEncrypted,
    classifyMeta,
  };
})(globalThis);
