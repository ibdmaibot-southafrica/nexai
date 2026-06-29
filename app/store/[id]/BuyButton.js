"use client";

import { useState } from "react";

// Human checkout: creates an invoice + PayPal link, then redirects to PayPal.
export default function BuyButton({ productId, productName, price }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function buy() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: "Web buyer", product: productName, amount: price, productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      const url = data.paymentUrl || data.paypalMeUrl;
      if (url) { window.location.href = url; return; }
      throw new Error("No payment URL returned (set PAYPAL_EMAIL).");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={buy} disabled={loading} style={{ padding: "12px 22px", borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14, color: "#fff", background: "linear-gradient(135deg,#7b2ff7,#00d4ff)", opacity: loading ? 0.6 : 1 }}>
        {loading ? "Starting checkout..." : `Buy with PayPal — $${price}`}
      </button>
      {error && <p style={{ color: "#ff4466", fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
