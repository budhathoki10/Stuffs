// Khalti ePayment (KPG-2) client: https://docs.khalti.com/khalti-epayment/

function baseUrl() {
  return process.env.KHALTI_ENV === "production" ? "https://khalti.com/api/v2" : "https://dev.khalti.com/api/v2";
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const key = process.env.KHALTI_SECRET_KEY;
  if (!key) throw new Error("KHALTI_SECRET_KEY is not set");
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { detail?: string };
  if (!res.ok) throw new Error(`Khalti ${path} failed (${res.status}): ${data.detail ?? "unknown error"}`);
  return data;
}

export type KhaltiInitiate = { pidx: string; payment_url: string; expires_at: string };
export type KhaltiLookup = { pidx: string; total_amount: number; status: string; transaction_id: string | null };

export function initiateKhaltiPayment(params: {
  amountPaisa: number;
  orderId: string;
  orderName: string;
  returnUrl: string;
  websiteUrl: string;
  customer: { name: string; email: string };
}) {
  return call<KhaltiInitiate>("/epayment/initiate/", {
    return_url: params.returnUrl,
    website_url: params.websiteUrl,
    amount: params.amountPaisa,
    purchase_order_id: params.orderId,
    purchase_order_name: params.orderName,
    customer_info: params.customer,
  });
}

/** Always confirm with lookup: the redirect's query string can be forged. */
export function lookupKhaltiPayment(pidx: string) {
  return call<KhaltiLookup>("/epayment/lookup/", { pidx });
}
