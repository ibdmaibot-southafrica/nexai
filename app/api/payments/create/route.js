import { addInvoice, logAction } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/payments/create — create a PayPal payment link
export async function POST(request) {
  try {
    const body = await request.json();
    const { customer, product, amount, description } = body;

    if (!customer || !amount) {
      return Response.json(
        { error: "Missing required fields: customer, amount" },
        { status: 400 }
      );
    }

    const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const paypalEmail = process.env.PAYPAL_EMAIL;
    const siteUrl = process.env.VERCEL_URL || "https://vercel-app-sigma-teal.vercel.app";
    const paypalAmount = parseFloat(amount).toFixed(2);
    const paypalDescription = encodeURIComponent(`${product || "NexAI Service"} - ${invoiceId}`);

    // Generate PayPal links if email is configured
    let paypalCheckoutLink = null;
    let paypalMeLink = null;
    
    if (paypalEmail) {
      const paypalMeUser = process.env.PAYPAL_ME_USERNAME || paypalEmail.split("@")[0];
      paypalMeLink = `https://www.paypal.com/paypalme/${paypalMeUser}/${paypalAmount}`;
      paypalCheckoutLink = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(paypalEmail)}&item_name=${paypalDescription}&amount=${paypalAmount}&currency_code=USD&invoice=${invoiceId}&return=${encodeURIComponent(siteUrl + "/payment-success")}&cancel_return=${encodeURIComponent(siteUrl + "/payment-cancelled")}`;
    }

    // Save invoice to database
    const invoice = {
      id: invoiceId,
      customer,
      product: product || "NexAI Service",
      amount: parseFloat(amount),
      status: "pending",
      created_at: new Date().toISOString(),
      paypal_link: paypalCheckoutLink,
      paypal_me_link: paypalMeLink,
      currency: "USD",
    };

    await addInvoice(invoice);
    await logAction("Finance", "invoice_created_paypal", { invoiceId, customer, amount, product });

    return Response.json({
      success: true,
      invoice,
      paymentUrl: paypalCheckoutLink,
      paypalMeUrl: paypalMeLink,
      paypalConfigured: !!paypalEmail,
      message: paypalEmail 
        ? `Invoice created. Customer can pay via PayPal.`
        : `Invoice created. Set PAYPAL_EMAIL env var to enable PayPal payment links.`,
    }, { status: 201 });
  } catch (error) {
    console.error("[Payments] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
