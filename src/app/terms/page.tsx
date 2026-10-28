import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { PRICES } from "@/lib/plans";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you and {SITE.operator} (&ldquo;we&rdquo;) for using {SITE.name}. By
        creating an account you agree to them.
      </p>

      <h2>What Pitchcraft does</h2>
      <p>
        Pitchcraft suggests local businesses you may want to offer your services to, runs automated checks on their
        public websites, and drafts outreach emails for you to edit and send yourself. We don&apos;t send email on your
        behalf, take a share of your earnings, or take part in any deal between you and a business.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18 and give accurate information.</li>
        <li>Keep your password safe. You are responsible for activity on your account.</li>
        <li>You can delete your account at any time from Settings.</li>
      </ul>

      <h2>Fair and lawful outreach</h2>
      <p>You are responsible for every message you send. You agree to:</p>
      <ul>
        <li>Send personal, one-to-one messages only. No bulk or automated mailing using Pitchcraft data.</li>
        <li>
          Follow the anti-spam and privacy laws that apply to you and the business you contact (for example CAN-SPAM in
          the US, GDPR and ePrivacy rules in the EU/UK), including identifying yourself honestly and stopping when
          someone asks you to.
        </li>
        <li>Not use reports or pitches to mislead, threaten or pressure anyone.</li>
        <li>Not try to break, overload, or scrape the service, or audit websites you have no business reason to check.</li>
      </ul>
      <p>We may suspend accounts that break these rules.</p>

      <h2>Accuracy</h2>
      <p>
        Website checks are automated estimates and can be wrong. Business details come from Google Maps or OpenStreetMap
        and the businesses&apos; own websites, and may be out of date. AI-drafted pitches can contain mistakes: please read and
        edit them before sending. We don&apos;t promise that you will win any client or earn any amount.
      </p>

      <h2>Plans and payment</h2>
      <ul>
        <li>The Free plan has weekly limits shown on the pricing page.</li>
        <li>
          Pro costs ${PRICES.monthlyUsd}/month or ${PRICES.yearlyUsd}/year in USD. Card payments are processed by
          Paddle.com, our reseller and Merchant of Record, which handles billing, taxes and invoices. Subscriptions renew
          automatically until you cancel; cancelling keeps Pro until the end of the period you paid for.
        </li>
        <li>
          In Nepal you can pay NPR {PRICES.monthlyNpr} through Khalti for 30 days of Pro. These payments don&apos;t renew
          automatically.
        </li>
        <li>
          Refunds are covered by our <Link href="/refund">Refund Policy</Link>.
        </li>
      </ul>

      <h2>Your content and data</h2>
      <p>
        Pitches and notes you write belong to you. We use your data only to run the service, as described in the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Liability</h2>
      <p>
        Pitchcraft is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not liable for indirect or
        consequential losses, and our total liability is limited to the amount you paid us in the 12 months before the
        claim. Nothing in these terms limits rights you have under consumer protection law.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will tell you about important changes by email or in the app. These terms are
        governed by the laws of {SITE.country}. Questions: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
      </p>
    </LegalPage>
  );
}
