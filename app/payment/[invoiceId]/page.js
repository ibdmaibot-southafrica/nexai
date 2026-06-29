"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, CreditCard } from "lucide-react";

export default function PaymentPage({ params }) {
  const { invoiceId } = params;
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/payments/status/${invoiceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setInvoice(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load invoice");
        setLoading(false);
      });
  }, [invoiceId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "#7b2ff7" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", color: "#e0e0e0" }}>
        <div style={{ textAlign: "center" }}>
          <XCircle size={48} style={{ color: "#ff4466", marginBottom: 16 }} />
          <h1>Invoice Not Found</h1>
          <p style={{ color: "#8888a0" }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", color: "#e0e0e0", padding: 20 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 480, width: "100%", background: "#12121a", borderRadius: 16, padding: 32, border: "1px solid #2a2a3a" }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          {invoice.status === "paid" ? (
            <CheckCircle size={48} style={{ color: "#00ff88", marginBottom: 12 }} />
          ) : (
            <CreditCard size={48} style={{ color: "#7b2ff7", marginBottom: 12 }} />
          )}
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            {invoice.status === "paid" ? "Payment Confirmed" : "Complete Payment"}
          </h1>
          <p style={{ color: "#8888a0", fontSize: 14 }}>Invoice #{invoice.invoiceId}</p>
        </div>

        <div style={{ background: "#1a1a2a", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "#8888a0" }}>Product</span>
            <span style={{ fontWeight: 600 }}>{invoice.product}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "#8888a0" }}>Customer</span>
            <span style={{ fontWeight: 600 }}>{invoice.customer}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "#8888a0" }}>Amount</span>
            <span style={{ fontWeight: 700, fontSize: 20, color: "#00d4ff" }}>${invoice.amount}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#8888a0" }}>Status</span>
            <span style={{
              fontWeight: 600,
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 12,
              background: invoice.status === "paid" ? "rgba(0,255,136,0.1)" : "rgba(255,170,0,0.1)",
              color: invoice.status === "paid" ? "#00ff88" : "#ffaa00"
            }}>
              {invoice.status.toUpperCase()}
            </span>
          </div>
        </div>

        {invoice.status === "paid" ? (
          <div style={{ textAlign: "center", color: "#00ff88" }}>
            <p style={{ fontSize: 16, fontWeight: 600 }}>Thank you for your payment!</p>
            <p style={{ color: "#8888a0", fontSize: 14, marginTop: 8 }}>Your access will be activated within 24 hours.</p>
          </div>
        ) : (
          <div>
            <p style={{ color: "#8888a0", fontSize: 14, textAlign: "center", marginBottom: 16 }}>
              Click below to pay securely via PayPal
            </p>
            <a
              href={`https://www.paypal.com/paypalme/nexbdm/${invoice.amount}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                width: "100%",
                padding: "14px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0070ba, #005ea6)",
                color: "#fff",
                textAlign: "center",
                fontWeight: 700,
                fontSize: 16,
                textDecoration: "none",
                boxShadow: "0 4px 20px rgba(0,112,186,0.3)"
              }}
            >
              Pay with PayPal
            </a>
            <p style={{ color: "#8888a0", fontSize: 12, textAlign: "center", marginTop: 12 }}>
              After payment, your invoice will be updated automatically.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
