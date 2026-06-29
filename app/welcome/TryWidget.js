"use client";

import { useState } from "react";

// Free, no-key sample run of a service — the trust-builder on the landing page.
export default function TryWidget({ id, inputHint, placeholder }) {
  const [input, setInput] = useState("");
  const [out, setOut] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!input.trim() || loading) return;
    setLoading(true); setOut(null);
    try {
      const r = await fetch(`/api/try/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input }) });
      const d = await r.json();
      setOut(r.ok ? (typeof d.result === "string" ? d.result : JSON.stringify(d.result, null, 2)) : (d.error || "Try again later."));
    } catch { setOut("Network error. Try again."); }
    setLoading(false);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder={placeholder || inputHint || "Enter input…"}
          style={{ flex: 1, padding: "9px 12px", borderRadius: 8, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)", fontSize: 13, outline: "none" }} />
        <button onClick={run} disabled={loading || !input.trim()}
          style={{ padding: "0 16px", borderRadius: 8, border: "none", background: "var(--cyan)", color: "#06121A", fontFamily: "var(--display)", fontWeight: 700, fontSize: 13, cursor: loading ? "wait" : "pointer", opacity: input.trim() ? 1 : 0.5 }}>
          {loading ? "…" : "Try free"}
        </button>
      </div>
      {out !== null && (
        <pre style={{ margin: "10px 0 0", padding: 12, borderRadius: 8, background: "var(--bg)", border: "1px solid var(--line)", color: "#AEB4C7", fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 240, overflowY: "auto" }}>{out}</pre>
      )}
    </div>
  );
}
