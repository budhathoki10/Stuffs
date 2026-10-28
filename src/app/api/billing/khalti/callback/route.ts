import { NextResponse, type NextRequest } from "next/server";
import { lookupKhaltiPayment } from "@/lib/billing/khalti";
import { completePendingPayment, extendPro, getPayment } from "@/lib/services/billing";
import { appUrl } from "@/lib/util";

const PRO_DAYS = 30;

export async function GET(request: NextRequest) {
  const pidx = request.nextUrl.searchParams.get("pidx");
  const done = (status: string) => NextResponse.redirect(appUrl(`/app/billing?status=${status}`));
  if (!pidx) return done("failed");

  const payment = await getPayment("khalti", pidx);
  if (!payment) return done("failed");
  if (payment.status === "completed") return done("success");

  let lookup;
  try {
    lookup = await lookupKhaltiPayment(pidx);
  } catch (err) {
    console.error("Khalti lookup failed", err);
    return done("pending");
  }
  if (lookup.status === "Pending" || lookup.status === "Initiated") return done("pending");
  if (lookup.status !== "Completed" || lookup.total_amount !== payment.amountMinor) return done("failed");

  // Only the request that flips pending -> completed grants Pro, so refreshes can't double-credit.
  const won = await completePendingPayment("khalti", pidx);
  if (won) await extendPro(won.userId, PRO_DAYS);
  return done("success");
}
