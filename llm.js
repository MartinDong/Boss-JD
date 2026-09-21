(function (root) {
  const SETTINGS_KEY = "bjd_llm";

  async function readSettings() {
    const data = await chrome.storage.local.get(SETTINGS_KEY);
    const saved = data[SETTINGS_KEY] || {};
    return {
      baseUrl: String(saved.baseUrl || "").trim(),
      model: String(saved.model || "").trim(),
      apiKey: String(saved.apiKey || "").trim(),
    };
  }

  async function writeSettings(settings) {
    await chrome.storage.local.set({
      [SETTINGS_KEY]: {
        baseUrl: String(settings.baseUrl || "").trim(),
        model: String(settings.model || "").trim(),
        apiKey: String(settings.apiKey || "").trim(),
      },
    });
  }

  function configured(settings) {
    return Boolean(settings.baseUrl && settings.model && settings.apiKey);
  }

  function chatEndpoint(baseUrl) {
    const trimmed = String(baseUrl || "").replace(/\/+$/, "");
    if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
    return `${trimmed}/chat/completions`;
  }

  function originPattern(baseUrl) {
    return `${new URL(baseUrl).origin}/*`;
  }

  async function complete(settings, messages) {
    const granted = await chrome.permissions.contains({ origins: [originPattern(settings.baseUrl)] });
    if (!granted) throw new Error("还没有这个模型地址的访问权限。请在配置页点「保存并授权」。");
    const body = { model: settings.model, messages };
    let response = await fetch(chatEndpoint(settings.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({ ...body, temperature: 0 }),
    });
    if (response.status === 400) {
      response = await fetch(chatEndpoint(settings.baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    }
    if (!response.ok) throw new Error(`模型接口返回 ${response.status}。请检查地址、模型和密钥。`);
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || "";
    if (!text) throw new Error("模型没有返回内容");
    return text;
  }

  function parseJson(text) {
    const fenced = String(text || "").match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced ? fenced[1] : String(text || "");
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("模型没有返回可解析的 JSON");
    return JSON.parse(raw.slice(start, end + 1));
  }

  async function askJson(settings, messages) {
    const first = await complete(settings, messages);
    try {
      return parseJson(first);
    } catch {
      const second = await complete(settings, messages.concat([
        { role: "assistant", content: String(first).slice(0, 2000) },
        { role: "user", content: "刚才的回复无法解析。请只返回一个 JSON 对象，不要使用 Markdown。" },
      ]));
      return parseJson(second);
    }
  }

  root.BossJdLlm = {
    SETTINGS_KEY,
    readSettings,
    writeSettings,
    configured,
    originPattern,
    complete,
    parseJson,
    askJson,
  };
})(globalThis);
