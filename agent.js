(function (root) {
  function llm() {
    if (!root.BossJdLlm) throw new Error("模型通道未加载");
    return root.BossJdLlm;
  }

  function facts(text) {
    const source = String(text || "");
    const email = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
    const phone = source.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}/)?.[0]?.replace(/[-\s]/g, "") || "";
    const named = source.match(/(?:姓名|名字)\s*[:：]\s*([\u4e00-\u9fa5·]{2,8}|[A-Za-z][A-Za-z .'-]{1,40})/);
    const firstLine = source.split(/\n/).map((line) => line.trim()).find(Boolean) || "";
    const name = named?.[1]?.trim() || (/^[\u4e00-\u9fa5·]{2,4}$/.test(firstLine) ? firstLine : "");
    const education = ["博士", "硕士", "本科", "大专", "高中"].find((item) => source.includes(item)) || "";
    return { email, phone, name, education };
  }

  function sensitive(label) {
    return /性别|民族|宗教|残疾|政治面貌|婚育|婚姻|种族|gender|ethnicity|race|veteran|disability/i.test(label);
  }

  function localValue(field, known) {
    const label = `${field.label || ""} ${field.placeholder || ""} ${field.name || ""}`.toLowerCase();
    if (sensitive(label)) return "";
    if (/邮箱|e-?mail/.test(label)) return known.email;
    if (/手机|电话|phone|mobile|tel/.test(label) && !/公司|座机/.test(label)) return known.phone;
    if (/(姓名|名字|full name|your name)/.test(label) && !/公司|学校|用户|账号|file/.test(label)) return known.name;
    if (/学历|degree/.test(label)) return known.education;
    return "";
  }

  function localAnswers(resumeText, fields) {
    const known = facts(resumeText);
    return fields
      .map((field) => ({ id: field.id, value: localValue(field, known) }))
      .filter((item) => item.value);
  }

  function parseAnswers(text) {
    const fenced = String(text || "").match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced ? fenced[1] : String(text || "");
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("模型没有返回可解析的填写结果");
    const data = JSON.parse(raw.slice(start, end + 1));
    const list = Array.isArray(data) ? data : data.answers || data.fields || [];
    return list
      .map((item) => ({ id: String(item.id || ""), value: String(item.value ?? "").trim() }))
      .filter((item) => item.id && item.value);
  }

  async function plan(resumeText, fields) {
    const api = llm();
    const answers = localAnswers(resumeText, fields);
    const done = new Set(answers.map((item) => item.id));
    const pending = fields.filter((field) => !done.has(field.id));
    const settings = await api.readSettings();
    if (!pending.length || !api.configured(settings)) {
      return {
        answers,
        note: api.configured(settings) || !pending.length
          ? ""
          : "还没有配置模型，这次只填写了简历里能直接认出的姓名、电话、邮箱和学历。",
      };
    }
    const content = await api.complete(settings, [
      {
        role: "system",
        content: "你帮助用户把自己的简历填进当前打开的招聘表单。只依据简历原文，不要编造公司、学校、时间、电话、邮箱或项目。无法确定时不要返回该字段。不要回答性别、民族、宗教、残疾、政治面貌、婚姻等人口统计问题。短字段不超过80字，开放题不超过400字。只返回JSON：{\"answers\":[{\"id\":\"f1\",\"value\":\"...\"}]}",
      },
      {
        role: "user",
        content: `简历：\n${String(resumeText || "").slice(0, 12000)}\n\n待填字段：\n${JSON.stringify(pending)}`,
      },
    ]);
    const modelAnswers = parseAnswers(content).filter((item) => pending.some((field) => field.id === item.id));
    return { answers: answers.concat(modelAnswers), note: "" };
  }

  async function testConnection() {
    const api = llm();
    const settings = await api.readSettings();
    if (!api.configured(settings)) throw new Error("请先填写接口地址、模型和密钥");
    const text = await api.complete(settings, [
      { role: "user", content: "只回复 OK" },
    ]);
    return text.slice(0, 40);
  }

  root.BossJdAgent = {
    get SETTINGS_KEY() {
      return llm().SETTINGS_KEY;
    },
    readSettings: () => llm().readSettings(),
    writeSettings: (settings) => llm().writeSettings(settings),
    configured: (settings) => llm().configured(settings),
    originPattern: (baseUrl) => llm().originPattern(baseUrl),
    plan,
    testConnection,
    localAnswers,
  };
})(globalThis);
