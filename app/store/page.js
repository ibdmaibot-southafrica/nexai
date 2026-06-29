import Link from "next/link";
import { getProducts } from "../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "NexAI Store — Autonomous AI products",
  description: "Digital AI products built and sold autonomously. Buyable by humans and by AI agents.",
};

export default async function StorePage() {
  let products = [];
  try { products = await getProducts({ onlyLive: true }); } catch {}

  return (
    <div style={{ minHeight: "100vh", background: "#08080f", color: "#f0f0f5", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0, background: "linear-gradient(135deg,#00d4ff,#7b2ff7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>NexAI Store</h1>
            <p style={{ color: "#8888a0", margin: "8px 0 0", fontSize: 15 }}>Digital AI products, built and priced autonomously. Buyable by humans &mdash; and by AI agents.</p>
          </div>
          <Link href="/" style={{ color: "#00d4ff", fontSize: 13, textDecoration: "none" }}>&larr; Company dashboard</Link>
        </div>

        <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.2)", fontSize: 12, color: "#9fb3c8" }}>
          Agents: this catalog is machine-readable at <code style={{ color: "#00d4ff" }}>/.well-known/agent-commerce</code>. Fund an API key once via PayPal (<code style={{ color: "#00d4ff" }}>/api/keys/create</code>), then call any service per request, debiting credits.
        </div>

        {products.length === 0 ? (
          <p style={{ color: "#8888a0", marginTop: 48, textAlign: "center" }}>No products live yet. The agents are still building the catalog.</p>
        ) : (
          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
            {products.map((p) => (
              <Link key={p.id} href={`/store/${p.id}`} style={{ textDecoration: "none" }}>
                <div style={{ height: "100%", padding: 20, borderRadius: 14, background: "rgba(18,18,30,0.8)", border: "1px solid rgba(30,30,50,0.6)", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 11, color: "#7b2ff7", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{p.category}</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: "6px 0 8px", color: "#f0f0f5" }}>{p.name}</h3>
                  <p style={{ fontSize: 13, color: "#8888a0", lineHeight: 1.5, margin: 0, flex: 1 }}>{p.description}</p>
                  <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "#00ff88" }}>${p.price}<span style={{ fontSize: 12, color: "#8888a0", fontWeight: 500 }}> /call</span></span>
                    <span style={{ fontSize: 12, color: "#00d4ff" }}>View &rarr;</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
