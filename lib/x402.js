/**
 * x402 — autonomous agent-to-agent payment (USDC over HTTP 402).
 *
 * The machine-native rail PayPal can't be: a buyer agent calls a paid endpoint,
 * gets HTTP 402 with payment requirements, pays USDC from its own wallet, and
 * retries with an `X-PAYMENT` header. We verify + settle via an x402 facilitator
 * (Coinbase's public one by default) so no chain client is needed in-process.
 *
 * Config (env): set these to go live, otherwise endpoints still emit a correct
 * 402 handshake but settlement fail-closes (nothing is delivered for free).
 *   X402_PAY_TO            receiving wallet address (0x...)
 *   X402_NETWORK           'base' | 'base-sepolia' (default base-sepolia/testnet)
 *   X402_FACILITATOR_URL   default https://x402.org/facilitator
 *   X402_ASSET             USDC contract (defaults per network below)
 *
 * Spec: x402Version 1, scheme "exact". See https://x402.org.
 */

const NETWORK = process.env.X402_NETWORK || "base-sepolia";
const PAY_TO = process.env.X402_PAY_TO || null;
const FACILITATOR = (process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator").replace(/\/$/, "");

// USDC contract per network (6 decimals).
const USDC = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};
const ASSET = process.env.X402_ASSET || USDC[NETWORK] || USDC["base-sepolia"];

export function isX402Configured() {
  return !!PAY_TO;
}

// USD price -> USDC atomic units (6 decimals), as the spec wants a string.
function toAtomic(priceUsd) {
  return String(Math.round(Number(priceUsd) * 1e6));
}

/**
 * Build the 402 body for a resource. `resource` is the absolute URL of the paid
 * endpoint; `priceUsd` the price; `description` human/agent text.
 */
export function buildRequirements({ resource, priceUsd, description }) {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        maxAmountRequired: toAtomic(priceUsd),
        resource,
        description: description || "NexAI product",
        mimeType: "application/json",
        payTo: PAY_TO || "0x0000000000000000000000000000000000000000",
        maxTimeoutSeconds: 120,
        asset: ASSET,
        extra: { name: "USDC", version: "2" },
      },
    ],
  };
}

// Decode the agent's X-PAYMENT header (base64 JSON payment payload).
export function decodePaymentHeader(headerValue) {
  if (!headerValue) return null;
  try {
    return JSON.parse(Buffer.from(headerValue, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function facilitatorCall(path, body) {
  const res = await fetch(`${FACILITATOR}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, error: `facilitator ${path} ${res.status}: ${(await res.text()).slice(0, 200)}` };
  }
  return { ok: true, data: await res.json() };
}

/**
 * Verify the payment payload against requirements, then settle on-chain (via the
 * facilitator). Fail-closed: returns { paid:false } unless settlement succeeds.
 * Returns { paid, txHash?, reason? }.
 */
export async function verifyAndSettle(paymentPayload, requirements) {
  if (!isX402Configured()) {
    return { paid: false, reason: "x402 not configured (set X402_PAY_TO)" };
  }
  if (!paymentPayload) {
    return { paid: false, reason: "missing payment payload" };
  }
  const accepts = requirements.accepts[0];

  const verify = await facilitatorCall("/verify", {
    x402Version: 1,
    paymentPayload,
    paymentRequirements: accepts,
  });
  if (!verify.ok) return { paid: false, reason: verify.error };
  if (!verify.data?.isValid) return { paid: false, reason: verify.data?.invalidReason || "invalid payment" };

  const settle = await facilitatorCall("/settle", {
    x402Version: 1,
    paymentPayload,
    paymentRequirements: accepts,
  });
  if (!settle.ok) return { paid: false, reason: settle.error };
  if (!settle.data?.success) return { paid: false, reason: settle.data?.errorReason || "settlement failed" };

  return { paid: true, txHash: settle.data.transaction || settle.data.txHash || null, network: NETWORK };
}

export const x402Config = { network: NETWORK, asset: ASSET, facilitator: FACILITATOR, configured: isX402Configured() };
