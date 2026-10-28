import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundPage() {
  return (
    <LegalPage title="Refund Policy">
      <p>We want you to win clients with Pitchcraft. If it isn&apos;t working for you, you can get your money back.</p>

      <h2>14-day money-back guarantee</h2>
      <ul>
        <li>
          Ask within 14 days of any payment (first payment or renewal) and we&apos;ll refund it in full. No questions
          asked.
        </li>
        <li>
          Card payments are refunded by Paddle, our Merchant of Record, to the original payment method. It usually takes
          5–10 business days to appear.
        </li>
        <li>Khalti payments are refunded to the Khalti wallet that paid.</li>
      </ul>

      <h2>Cancelling</h2>
      <p>
        You can cancel a subscription at any time from the link in your Paddle receipt email, or by contacting us.
        You&apos;ll keep Pro until the end of the period you paid for, and you won&apos;t be charged again.
      </p>

      <h2>How to ask</h2>
      <p>
        Email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> from your account email, or reply to your
        Paddle receipt. Paddle customers can also request a refund directly at{" "}
        <a href="https://paddle.net" rel="noopener noreferrer" target="_blank">
          paddle.net
        </a>
        .
      </p>
    </LegalPage>
  );
}
