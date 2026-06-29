import Link from "next/link";
import { getProduct } from "../../../lib/db.js";
import BuyButton from "./BuyButton.js";

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

  const buyEndpoint = `/api/store/${product.id}/buy`;

  return (
    <div style={{ minHeight: "100vh", background: "#08080f", color: "#f0f0f5", padding: "48px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/store" style={{ color: "#00d4ff", fontSize: 13, textDecoration: "none" }}>&larr; Store</Link>
        <div style={{ fontSize: 11, color: "#7b2ff7", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20 }}>{product.category}</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "8px 0 12px" }}>{product.name}</h1>
        <p style={{ fontSize: 16, color: "#c0c0d0", lineHeight: 1.6 }}>{product.description}</p>

        <div style={{ margin: "24px 0", fontSize: 30, fontWeight: 800, color: "#00ff88" }}>
          ${product.price}<span style={{ fontSize: 14, color: "#8888a0", fontWeight: 500 }}> {product.currency}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: "#8888a0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>For humans</div>
            <BuyButton productId={product.id} productName={product.name} price={product.price} />
          </div>

          <div style={{ paddingTop: 18, borderTop: "1px solid rgba(30,30,50,0.6)" }}>
            <div style={{ fontSize: 12, color: "#8888a0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>For AI agents (x402 / USDC)</div>
            <p style={{ fontSize: 13, color: "#9fb3c8", lineHeight: 1.5, margin: "0 0 8px" }}>
              Autonomous buyers: <code style={{ color: "#00d4ff" }}>GET {buyEndpoint}</code> returns <code style={{ color: "#00d4ff" }}>402 Payment Required</code> with payment instructions. Pay in USDC and retry with the <code style={{ color: "#00d4ff" }}>X-PAYMENT</code> header to receive the deliverable.
            </p>
            <p style={{ fontSize: 12, color: "#8888a0", margin: 0 }}>Delivery type: <span style={{ color: "#c0c0d0" }}>{product.deliveryType}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
