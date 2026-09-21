(function (root) {
  const SENSITIVE = /性别|民族|宗教|残疾|政治面貌|婚育|婚姻|种族|gender|ethnicity|race|veteran|disability/i;

  function visible(node) {
    if (!node || node.closest?.("#bjd-root")) return false;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    return Boolean(node.getClientRects().length);
  }

  function labelFor(node) {
    const labelledBy = node.getAttribute("aria-labelledby");
    const aria = node.getAttribute("aria-label") || "";
    const byId = labelledBy
      ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.innerText || "").join(" ")
      : "";
    const wrapped = node.closest("label")?.innerText || "";
    const htmlLabel = node.id ? document.querySelector(`label[for="${CSS.escape(node.id)}"]`)?.innerText || "" : "";
    const sibling = node.previousElementSibling?.innerText || "";
    return [aria, byId, htmlLabel, wrapped, node.getAttribute("placeholder") || "", sibling]
      .map((item) => String(item || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(" ")
      .slice(0, 180);
  }

  function clearMarks() {
    document.querySelectorAll("[data-bjd-field],[data-bjd-file]").forEach((node) => {
      node.removeAttribute("data-bjd-field");
      node.removeAttribute("data-bjd-file");
    });
  }

  function isEmpty(node) {
    if (node.type === "checkbox" || node.type === "radio") return !node.checked;
    if (node.tagName === "SELECT") return !node.value || node.selectedIndex <= 0 && !node.options[node.selectedIndex]?.value;
    return !String(node.value || "").trim();
  }

  function collectFields() {
    clearMarks();
    const pageText = (document.body?.innerText || "").slice(0, 400);
    const fields = [];
    const seenRadio = new Set();
    let index = 0;
    const controls = document.querySelectorAll("input, textarea, select");
    controls.forEach((node) => {
      const type = (node.getAttribute("type") || node.tagName).toLowerCase();
      if (type === "file") {
        node.setAttribute("data-bjd-file", "1");
        return;
      }
      if (["hidden", "password", "submit", "button", "reset", "image"].includes(type)) return;
      if (!visible(node) || !isEmpty(node)) return;
      const label = labelFor(node);
      if (SENSITIVE.test(label)) return;
      if (type === "radio") {
        if (!node.name || seenRadio.has(node.name)) return;
        seenRadio.add(node.name);
      }
      const id = `f${index += 1}`;
      const group = type === "radio" && node.name
        ? [...document.querySelectorAll(`input[type="radio"][name="${CSS.escape(node.name)}"]`)]
        : [node];
      group.forEach((item) => item.setAttribute("data-bjd-field", id));
      const options = node.tagName === "SELECT"
        ? [...node.options].map((option) => option.text.trim()).filter(Boolean).slice(0, 12)
        : group.map((item) => labelFor(item)).filter(Boolean).slice(0, 12);
      fields.push({
        id,
        label: label || node.name || "",
        name: node.name || "",
        placeholder: node.getAttribute("placeholder") || "",
        kind: node.tagName === "TEXTAREA" ? "textarea" : node.tagName === "SELECT" ? "select" : type,
        options,
      });
    });
    const blocked = fields.length < 2 && /安全验证|请稍候/.test(pageText);
    return {
      blocked,
      hasFile: Boolean(document.querySelector("input[type='file'][data-bjd-file='1']")),
      fields: fields.slice(0, 40),
    };
  }

  function setValue(node, value) {
    const prototype = node.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(node, value);
    else node.value = value;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    node.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function mark(node) {
    const previous = node.style.outline;
    node.style.outline = "2px solid #0f766e";
    setTimeout(() => {
      node.style.outline = previous;
    }, 1600);
  }

  function fillControl(node, value) {
    const text = String(value || "").trim();
    if (!text) return false;
    if (node.tagName === "SELECT") {
      const wanted = text.toLowerCase();
      const option = [...node.options].find((item) => item.text.trim().toLowerCase() === wanted || item.value.toLowerCase() === wanted)
        || [...node.options].find((item) => item.text.trim() && (item.text.includes(text) || text.includes(item.text.trim())));
      if (!option) return false;
      node.value = option.value;
      node.dispatchEvent(new Event("change", { bubbles: true }));
      mark(node);
      return true;
    }
    if (node.type === "radio" || node.type === "checkbox") {
      const group = document.querySelectorAll(`[data-bjd-field="${node.getAttribute("data-bjd-field")}"]`);
      const target = [...group].find((item) => labelFor(item).includes(text) || item.value === text);
      if (!target) return false;
      if (!target.checked) target.click();
      mark(target);
      return true;
    }
    setValue(node, text);
    mark(node);
    return true;
  }

  function attachFile(file) {
    const inputs = [...document.querySelectorAll("input[type='file'][data-bjd-file='1']")];
    const input = inputs.find((item) => /pdf|docx|resume|简历|cv/i.test(`${item.accept} ${item.name} ${labelFor(item)}`)) || inputs[0];
    if (!input || !file?.buffer) return false;
    const bytes = file.buffer instanceof ArrayBuffer ? new Uint8Array(file.buffer) : new Uint8Array(file.buffer);
    const blob = new File([bytes], file.filename || "resume.pdf", { type: file.mime || "application/octet-stream" });
    const transfer = new DataTransfer();
    transfer.items.add(blob);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    mark(input);
    return true;
  }

  function applyPlan(payload) {
    const answers = Array.isArray(payload?.answers) ? payload.answers : [];
    let filled = 0;
    answers.forEach((item) => {
      const node = document.querySelector(`[data-bjd-field="${CSS.escape(String(item.id || ""))}"]`);
      if (node && fillControl(node, item.value)) filled += 1;
    });
    const uploaded = payload?.file ? attachFile(payload.file) : false;
    return { filled, uploaded, planned: answers.length };
  }

  root.BossJdFill = { collectFields, applyPlan };
})(globalThis);
