(function (root) {
  function latin1(bytes) {
    let text = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      text += String.fromCharCode(...bytes.subarray(index, index + chunk));
    }
    return text;
  }

  function cleanup(text) {
    return String(text || "")
      .replace(/\u0000/g, "")
      .replace(/[^\S\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function inflate(bytes) {
    const modes = ["deflate", "deflate-raw"];
    let lastError = null;
    for (const mode of modes) {
      try {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(mode));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("无法解压文件");
  }

  async function unzipEntries(buffer) {
    const data = new Uint8Array(buffer);
    const entries = [];
    let offset = 0;
    while (offset + 30 < data.length && data[offset] === 0x50 && data[offset + 1] === 0x4b && data[offset + 2] === 0x03 && data[offset + 3] === 0x04) {
      const method = data[offset + 8] | (data[offset + 9] << 8);
      const size = data[offset + 18] | (data[offset + 19] << 8) | (data[offset + 20] << 16) | (data[offset + 21] << 24);
      const nameLength = data[offset + 26] | (data[offset + 27] << 8);
      const extraLength = data[offset + 28] | (data[offset + 29] << 8);
      const name = new TextDecoder().decode(data.subarray(offset + 30, offset + 30 + nameLength));
      const start = offset + 30 + nameLength + extraLength;
      const slice = data.subarray(start, start + size);
      let bytes = slice;
      if (method === 8) bytes = await inflate(slice);
      else if (method !== 0) break;
      entries.push({ name, bytes });
      offset = start + size;
    }
    return entries;
  }

  function xmlToText(xml) {
    return cleanup(
      xml
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<w:br\/>/g, "\n")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    );
  }

  function pullPdfLiterals(text) {
    const parts = [];
    const pattern = /\((?:\\\)|\\\(|\\n|\\r|\\t|\\[0-7]{1,3}|\\.|[^\\)]){1,800}\)\s*Tj|\[(?:\s*\((?:\\\)|\\\(|\\.|[^\\)]){0,400}\)\s*(?:-?\d+(?:\.\d+)?\s*)?)+\]\s*TJ/g;
    let match = pattern.exec(text);
    while (match) {
      const piece = match[0];
      const literals = piece.match(/\((?:\\\)|\\\(|\\n|\\r|\\t|\\[0-7]{1,3}|\\.|[^\\)]){1,800}\)/g) || [];
      literals.forEach((literal) => {
        const body = literal.slice(1, -1)
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "")
          .replace(/\\t/g, "\t")
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
          .replace(/\\\\/g, "\\");
        if (body.trim()) parts.push(body);
      });
      match = pattern.exec(text);
    }
    return parts.join(" ");
  }

  async function extractPdf(buffer) {
    const bytes = new Uint8Array(buffer);
    const source = latin1(bytes);
    const pieces = [pullPdfLiterals(source)];
    const streamPattern = /stream\r?\n/g;
    let marker = streamPattern.exec(source);
    while (marker) {
      const start = marker.index + marker[0].length;
      const end = source.indexOf("endstream", start);
      if (end < 0) break;
      const dict = source.slice(Math.max(0, source.lastIndexOf("<<", marker.index)), marker.index);
      let raw = bytes.subarray(start, end);
      while (raw.length && (raw[raw.length - 1] === 10 || raw[raw.length - 1] === 13)) raw = raw.subarray(0, raw.length - 1);
      try {
        const decoded = /FlateDecode/.test(dict) ? latin1(await inflate(raw)) : latin1(raw);
        const text = pullPdfLiterals(decoded);
        if (text) pieces.push(text);
      } catch {
        /* 这一段解不出来就跳过。 */
      }
      streamPattern.lastIndex = end + 9;
      marker = streamPattern.exec(source);
    }
    return cleanup(pieces.join("\n"));
  }

  async function extractDocx(buffer) {
    const entries = await unzipEntries(buffer);
    const document = entries.find((entry) => entry.name.replace(/\\/g, "/").endsWith("word/document.xml"));
    if (!document) return "";
    return xmlToText(new TextDecoder().decode(document.bytes));
  }

  async function extract(buffer, filename) {
    const name = String(filename || "").toLowerCase();
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer);
    if (name.endsWith(".docx")) return extractDocx(bytes.buffer);
    if (name.endsWith(".pdf") || (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
      return extractPdf(bytes.buffer);
    }
    if (name.endsWith(".doc")) return "";
    return cleanup(new TextDecoder().decode(bytes));
  }

  root.BossJdResumeText = { extract };
})(globalThis);
