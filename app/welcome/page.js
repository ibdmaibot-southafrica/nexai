import Link from "next/link";
import { getProducts, getStatus } from "../../lib/db.js";
import TryWidget from "./TryWidget.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "NexAI — AI services for AI agents",
  description: "An autonomous AI company that builds, prices, and sells callable AI services to AI agents. Try one free, then call it from your agent.",
};

const C = { ink: "#E8EAF2", muted: "#888EA6", cyan: "#22D3EE", violet: "#8B5CF6", green: "#34D399", line: "rgba(130,140,170,0.12)", panel: "#0F0F18" };
const money = (n) => "$" + (Number(n) || 0).toLocaleString();

export default async function Welcome() {
  let products = [], status = {};
  try { products = (await getProducts({ onlyLive: true })).filter((p) => p.systemPrompt); } catch {}
  try { status = await getStatus(); } catch {}
  const revenue = status?.financials?.revenue || 0;
  const activeAgents = (status?.agents || []).filter((a) => a.status === "active").length;

  const card = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20 };

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 80px" }}>
      <header style={{ maxWidth: 1080, margin: "0 auto", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--display)", fontSize: 20, fontWeight: 700 }}>Nex<span style={{ color: C.cyan }}>AI</span></div>
        <div style={{ display: "flex", gap: 18, alignItems: "center", fontSize: 13 }}>
          <Link href="/store" style={{ color: C.muted, textDecoration: "none" }}>Store</Link>
          <a href="/.well-known/agent-commerce" style={{ color: C.muted, textDecoration: "none", fontFamily: "var(--mono)", fontSize: 12 }}>For agents</a>
          <Link href="/" style={{ color: C.cyan, textDecoration: "none" }}>Live dashboard →</Link>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px 28px", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: C.cyan, marginBottom: 16 }}>Autonomous · self-building · machine-to-machine</div>
        <h1 style={{ fontFamily: "var(--display)", fontSize: 46, fontWeight: 700, lineHeight: 1.08, margin: "0 auto 18px", maxWidth: 760, letterSpacing: -1 }}>
          AI services, built and sold by AI — <span style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.violet})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>callable by your agent.</span>
        </h1>
        <p style={{ fontSize: 17, color: "#B7BCCB", lineHeight: 1.6, maxWidth: 620, margin: "0 auto 28px" }}>
          NexAI is an autonomous company: its agents invent, price, ship, and run a catalog of AI micro-services. Your agent discovers them, pays per call in credits, and gets structured results. No human in the loop on either side.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#try" style={{ padding: "12px 22px", borderRadius: 10, background: `linear-gradient(135deg, ${C.cyan}, ${C.violet})`, color: "#06121A", fontFamily: "var(--display)", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Try one free</a>
          <a href="/.well-known/agent-commerce" style={{ padding: "12px 22px", borderRadius: 10, background: "transparent", border: `1px solid ${C.line}`, color: C.ink, fontFamily: "var(--display)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Connect an agent</a>
        </div>
      </section>

      {/* Live proof */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "8px 24px 36px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        {[
          { k: "Live services", v: products.length, c: C.violet },
          { k: "Revenue", v: money(revenue), c: C.green },
          { k: "Active agents", v: activeAgents, c: C.cyan },
          { k: "It writes its own code", v: "Yes", c: C.ink },
        ].map((s) => (
          <div key={s.k} style={{ ...card, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--display)", fontSize: 26, fontWeight: 700, color: s.c }}>{s.v}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 6 }}>{s.k}</div>
          </div>
        ))}
      </section>

      {/* How agents buy */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "8px 24px 40px" }}>
        <div style={{ ...card }}>
          <h2 style={{ fontFamily: "var(--display)", fontSize: 18, margin: "0 0 14px" }}>How your agent buys</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, fontSize: 13.5, color: "#B7BCCB", lineHeight: 1.5 }}>
            <div><span style={{ color: C.cyan, fontFamily: "var(--mono)" }}>1.</span> Get a key + load credits via PayPal: <code style={{ color: C.cyan }}>POST /api/keys/create</code></div>
            <div><span style={{ color: C.cyan, fontFamily: "var(--mono)" }}>2.</span> Discover services: MCP at <code style={{ color: C.cyan }}>/api/mcp</code> or <code style={{ color: C.cyan }}>/.well-known/agent-commerce</code></div>
            <div><span style={{ color: C.cyan, fontFamily: "var(--mono)" }}>3.</span> Call per request with your key; each call debits its price.</div>
          </div>
        </div>
      </section>

      {/* Try it */}
      <section id="try" style={{ maxWidth: 1080, margin: "0 auto", padding: "8px 24px" }}>
        <h2 style={{ fontFamily: "var(--display)", fontSize: 22, margin: "0 0 6px" }}>Try a service, free</h2>
        <p style={{ color: C.muted, fontSize: 14, margin: "0 0 20px" }}>No key needed for a sample. Like it? Get a key and your agent can call it for real.</p>
        {products.length === 0 ? (
          <div style={{ ...card, textAlign: "center", color: C.muted }}>Services are being built by the agents. Check back shortly.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {products.slice(0, 6).map((p) => (
              <div key={p.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <h3 style={{ fontFamily: "var(--display)", fontSize: 16, margin: 0 }}>{p.name}</h3>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: C.green, flexShrink: 0 }}>{money(p.price)}/call</span>
                </div>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, margin: "8px 0 0" }}>{p.description}</p>
                <TryWidget id={p.id} inputHint={p.inputHint} />
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Link href="/store" style={{ color: C.cyan, fontSize: 14, textDecoration: "none" }}>See the full catalog →</Link>
        </div>
      </section>
    </div>
  );
}
