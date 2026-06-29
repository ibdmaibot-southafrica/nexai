import Link from "next/link";
import { getProduct } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProductPage({ params }) {
  let product = null;
  try { product = await getProduct(params.id); } catch {}

  if (!product) {
    return (
      <div style={{ minHeight: "100vh", background: "#08080f", color: "#f0f0f5", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <p style={{ color: "#8888a0" }}>Product not found.</p>
        <Link href="/store" style={{ color: "#00d4ff" }}>&larr; Back to store</Link>
      </div>
    );
  }

  const callUrl = `/api/run/${product.id}`;

  return (
    <div style={{ minHeight: "100vh", background: "#08080f", color: "#f0f0f5", padding: "48px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/store" style={{ color: "#00d4ff", fontSize: 13, textDecoration: "none" }}>&larr; Store</Link>
        <div style={{ fontSize: 11, color: "#7b2ff7", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20 }}>{product.category}</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "8px 0 12px" }}>{product.name}</h1>
        <p style={{ fontSize: 16, color: "#c0c0d0", lineHeight: 1.6 }}>{product.description}</p>

        <div style={{ margin: "24px 0", fontSize: 30, fontWeight: 800, color: "#00ff88" }}>
          ${product.price}<span style={{ fontSize: 14, color: "#8888a0", fontWeight: 500 }}> {product.currency} / call</span>
        </div>

        <div style={{ padding: 18, borderRadius: 12, background: "rgba(18,18,30,0.7)", border: "1px solid rgba(30,30,50,0.6)" }}>
          <div style={{ fontSize: 12, color: "#8888a0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>For AI agents</div>
          <p style={{ fontSize: 13, color: "#9fb3c8", lineHeight: 1.6, margin: "0 0 12px" }}>
            This is a callable AI service. Pay with prepaid credits (funded once via PayPal), then your agent calls it autonomously.
          </p>
          <ol style={{ fontSize: 13, color: "#c0c0d0", lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
            <li><code style={{ color: "#00d4ff" }}>POST /api/keys/create {"{ amount: 20 }"}</code> &rarr; get an API key + PayPal link to load $20.</li>
            <li>Approve the PayPal payment once.</li>
            <li><code style={{ color: "#00d4ff" }}>POST {callUrl}</code> with header <code style={{ color: "#00d4ff" }}>Authorization: Bearer &lt;key&gt;</code> and body <code style={{ color: "#00d4ff" }}>{"{ input }"}</code>.</li>
          </ol>
          <p style={{ fontSize: 12, color: "#8888a0", margin: "12px 0 0" }}>Input: <span style={{ color: "#c0c0d0" }}>{product.inputHint || "{ input: <text> }"}</span></p>
          <p style={{ fontSize: 12, color: "#8888a0", margin: "6px 0 0" }}>Discovery: <code style={{ color: "#00d4ff" }}>/.well-known/agent-commerce</code></p>
        </div>
      </div>
    </div>
  );
}
