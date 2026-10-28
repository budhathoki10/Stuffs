// Tiny static server for fake business websites used by tests and LEADS_PROVIDER=mock.
// It also plays a fake Khalti under /khalti and a fake Resend under /resend, so payment and
// email tests run without the internet.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.FIXTURE_PORT ?? 4100);
const KHALTI_KEY = process.env.FAKE_KHALTI_KEY ?? "e2e-khalti-key";

/** pidx -> payment, kept in memory for the fake Khalti. */
const payments = new Map();

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || "{}");
}

async function fakeKhalti(req, res, url) {
  if (url.pathname === "/khalti/pay") {
    // The "payment page": the customer pays and is sent back to the shop.
    const payment = payments.get(url.searchParams.get("pidx"));
    if (!payment) return json(res, 404, { detail: "Not found." });
    payment.status = "Completed";
    const back = new URL(payment.return_url);
    back.searchParams.set("pidx", payment.pidx);
    back.searchParams.set("status", "Completed");
    res.writeHead(302, { location: back.toString() });
    return res.end();
  }
  if (req.headers.authorization !== `Key ${KHALTI_KEY}`) return json(res, 401, { detail: "Invalid token." });
  const body = await readJson(req);
  if (url.pathname === "/khalti/epayment/initiate/") {
    const pidx = `fake${payments.size + 1}${Date.now()}`;
    payments.set(pidx, { pidx, status: "Initiated", amount: body.amount, return_url: body.return_url });
    return json(res, 200, { pidx, payment_url: `http://127.0.0.1:${port}/khalti/pay?pidx=${pidx}`, expires_at: "later" });
  }
  if (url.pathname === "/khalti/epayment/lookup/") {
    const payment = payments.get(body.pidx);
    if (!payment) return json(res, 404, { detail: "Not found." });
    return json(res, 200, { pidx: payment.pidx, total_amount: payment.amount, status: payment.status, transaction_id: "txn" });
  }
  return json(res, 404, { detail: "Not found." });
}

/** Emails "sent" through the fake Resend, and received emails tests put in place to be fetched. */
const resendSent = [];
const resendReceived = new Map();

async function fakeResend(req, res, url) {
  // Test helpers: no auth.
  if (url.pathname === "/resend/_inbound" && req.method === "POST") {
    const email = await readJson(req);
    resendReceived.set(email.id, email);
    return json(res, 200, { ok: true });
  }
  if (url.pathname === "/resend/_sent") return json(res, 200, resendSent);

  if (!/^Bearer \S+/.test(req.headers.authorization ?? "")) return json(res, 401, { message: "Missing API key" });
  if (url.pathname === "/resend/emails" && req.method === "POST") {
    const body = await readJson(req);
    const id = `re_fake_${resendSent.length + 1}`;
    resendSent.push({ id, ...body });
    return json(res, 200, { id });
  }
  const received = url.pathname.match(/^\/resend\/emails\/receiving\/([^/]+)$/);
  if (received) {
    const email = resendReceived.get(decodeURIComponent(received[1]));
    return email ? json(res, 200, email) : json(res, 404, { message: "Not found" });
  }
  return json(res, 404, { message: "Not found" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  if (url.pathname.startsWith("/khalti/")) return fakeKhalti(req, res, url);
  if (url.pathname.startsWith("/resend/")) return fakeResend(req, res, url);
  if (url.pathname === "/redirect") {
    res.writeHead(301, { location: "/good.html" });
    return res.end();
  }
  const name = url.pathname.replace(/^\//, "") || "good.html";
  if (!/^[a-z]+\.html$/.test(name)) {
    res.writeHead(404, { "content-type": "text/plain" });
    return res.end("Not found");
  }
  try {
    const html = await readFile(path.join(here, name), "utf8");
    // The "slow" site takes 3 seconds to respond.
    if (name === "slow.html") await new Promise((r) => setTimeout(r, 3000));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => console.log(`Fixture sites on http://127.0.0.1:${port}`));
