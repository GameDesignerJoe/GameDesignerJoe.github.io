// GASP local shim: gives the Gate Ten page the same `window.claude.use(...)` capabilities it has as a claude.ai
// artifact, but backed by the local GASP server: stories as files, Claude via the key in .env, exports to a folder.
// On claude.ai this file 404s and the real runtime is used instead; the page must behave identically either way.
(function () {
  if (window.claude && window.claude.use) return;
  window.GASP_LOCAL = true;
  const j = async (url, opts) => { const r = await fetch(url, opts); const o = await r.json().catch(() => ({})); if (!r.ok || o.error) throw Object.assign(new Error(o.error || r.statusText), { code: o.code || "upstream_error" }); return o; };

  const db = {
    doc(path) {
      return {
        async get() { const o = await j("/api/db?path=" + encodeURIComponent(path)); return { data: () => o.data === null ? undefined : o.data }; },
        async set(data) { await j("/api/db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, data }) }); },
        async delete() { await j("/api/db?path=" + encodeURIComponent(path), { method: "DELETE" }); }
      };
    }
  };

  function makeSample(info) {
    if (!info.anthropic) return null;
    const call = async (input, opts = {}) => {
      const messages = typeof input === "string" ? [{ role: "user", content: input }] : input.map(m => ({ role: m.role, content: m.content }));
      const r = await fetch("/api/claude", { method: "POST", signal: opts.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages, tier: opts.modelTier || "default" }) }).catch(e => { throw { code: e.name === "AbortError" ? "cancelled" : "upstream_error", message: String(e) }; });
      const o = await r.json().catch(() => ({}));
      if (!r.ok || o.error) throw { code: o.code || (r.status === 401 ? "not_granted" : r.status === 429 ? "rate_limited" : "upstream_error"), message: o.error || r.statusText };
      return { text: o.text || "" };
    };
    call.json = async (input, opts) => { const { text } = await call(input, opts); let m = text.trim(); const fence = m.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) m = fence[1]; const a = m.search(/[\[{]/), b = Math.max(m.lastIndexOf("}"), m.lastIndexOf("]")); if (a < 0 || b < 0) throw { code: "invalid_json", text }; try { return JSON.parse(m.slice(a, b + 1)); } catch { throw { code: "invalid_json", text }; } };
    call.limits = async () => ({ maxPromptBytes: 262144 });
    return call;
  }

  const downloads = {
    async save({ filename, data }) {
      const o = await j("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename, data }) });
      // also hand it to the browser so it shows up in Downloads like before
      try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "text/plain" })); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); } catch {}
      return o;
    }
  };

  let infoP = null;
  const info = () => infoP || (infoP = j("/api/info").catch(() => ({})));
  window.claude = {
    async use(name) {
      if (name === "db") return db;
      if (name === "downloads") return downloads;
      if (name === "sample") return makeSample(await info());
      throw new Error("capability not available locally: " + name);
    }
  };
})();
