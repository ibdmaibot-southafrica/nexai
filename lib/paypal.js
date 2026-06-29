// PayPal API integration using Client ID + Secret
// Supports both PayPal REST API (for real checkout links) and PayPal.me fallback

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_EMAIL = process.env.PAYPAL_EMAIL || "hjr@nexbdm.com";
// PayPal.me handle is NOT derivable from the email — set it explicitly to your
// real paypal.me/<username>. Falls back to the email local-part only as a guess.
const PAYPAL_ME_USERNAME = process.env.PAYPAL_ME_USERNAME || PAYPAL_EMAIL.split("@")[0];
const PAYPAL_MODE = process.env.PAYPAL_MODE || "sandbox";

const BASE_URL = PAYPAL_MODE === "live" 
  ? "https://api-m.paypal.com" 
  : "https://api-m.sandbox.paypal.com";

// Get PayPal OAuth access token
async function getAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) return null;
  
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  
  if (!res.ok) {
    console.error("[PayPal] Auth failed:", res.status, await res.text());
    return null;
  }
  
  const data = await res.json();
  return data.access_token;
}

// Create a real PayPal order (REST API v2)
export async function createPayPalOrder({ customer, product, amount, invoiceId, returnUrl, cancelUrl }) {
  const token = await getAccessToken();
  
  if (!token) {
    // Fallback to PayPal.me link if API credentials not available
    return { paypalMeLink: generatePayPalMeLink(amount), fallback: true };
  }
  
  const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: invoiceId,
        description: product || "NexAI Service",
        amount: {
          currency_code: "USD",
          value: parseFloat(amount).toFixed(2),
        },
      }],
      application_context: {
        brand_name: "NexAI",
        landing_page: "BILLING",
        user_action: "PAY_NOW",
        return_url: returnUrl || "https://vercel-app-sigma-teal.vercel.app/payment-success",
        cancel_url: cancelUrl || "https://vercel-app-sigma-teal.vercel.app/",
      },
    }),
  });
  
  if (!res.ok) {
    const errText = await res.text();
    console.error("[PayPal] Order creation failed:", res.status, errText);
    return { paypalMeLink: generatePayPalMeLink(amount), fallback: true };
  }
  
  const order = await res.json();
  
  // Extract the approval URL
  const approvalUrl = order.links?.find(l => l.rel === "approve")?.href;
  
  return {
    orderId: order.id,
    approvalUrl,
    status: order.status,
    fallback: false,
  };
}

// Generate PayPal.me link (always works, no API needed)
export function generatePayPalMeLink(amount) {
  const paypalAmount = parseFloat(amount).toFixed(2);
  return `https://www.paypal.com/paypalme/${PAYPAL_ME_USERNAME}/${paypalAmount}`;
}

// Check if PayPal API is configured
export function isPayPalApiConfigured() {
  return !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);
}

/**
 * Verify a PayPal webhook is genuine before trusting it.
 *
 * Calls PayPal's verify-webhook-signature API with the transmission headers PayPal
 * sends on each webhook plus the raw body. Requires PAYPAL_WEBHOOK_ID (from the
 * webhook you create in the PayPal dashboard) and API credentials.
 *
 * Returns true ONLY if PayPal confirms SUCCESS. Fails closed: if credentials or
 * the webhook id are missing, or the call errors, returns false.
 *
 * @param {Headers} headers - request.headers from the incoming webhook
 * @param {string} rawBody - the exact raw request body string
 */
export async function verifyWebhookSignature(headers, rawBody) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId || !isPayPalApiConfigured()) return false;

  const token = await getAccessToken();
  if (!token) return false;

  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const transmissionSig = headers.get("paypal-transmission-sig");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return false;
  }

  let webhookEvent;
  try {
    webhookEvent = JSON.parse(rawBody);
  } catch {
    return false;
  }

  try {
    const res = await fetch(`${BASE_URL}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        transmission_sig: transmissionSig,
        cert_url: certUrl,
        auth_algo: authAlgo,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    });

    if (!res.ok) {
      console.error("[PayPal] Webhook verify call failed:", res.status, await res.text());
      return false;
    }

    const data = await res.json();
    return data.verification_status === "SUCCESS";
  } catch (err) {
    console.error("[PayPal] Webhook verify error:", err.message);
    return false;
  }
}

// Get best payment link — tries API first, falls back to PayPal.me
export async function getBestPaymentLink({ customer, product, amount, invoiceId }) {
  const siteUrl = process.env.VERCEL_URL || "https://vercel-app-sigma-teal.vercel.app";
  const returnUrl = `${siteUrl}/payment-success`;
  const cancelUrl = `${siteUrl}/`;
  
  if (isPayPalApiConfigured()) {
    const result = await createPayPalOrder({ customer, product, amount, invoiceId, returnUrl, cancelUrl });
    if (!result.fallback && result.approvalUrl) {
      return {
        paypal_link: result.approvalUrl,
        paypal_me_link: generatePayPalMeLink(amount),
        orderId: result.orderId,
        method: "api",
      };
    }
  }
  
  // Fallback to PayPal.me
  return {
    paypal_link: generatePayPalMeLink(amount),
    paypal_me_link: generatePayPalMeLink(amount),
    method: "paypalme",
  };
}
