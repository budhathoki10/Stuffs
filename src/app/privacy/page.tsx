import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what {SITE.name} collects, why, and what control you have. {SITE.operator} is responsible
        for your data. Contact: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> your name, email, skill, optional portfolio link, and a securely hashed password (we
          never see or store the password itself).
        </li>
        <li>
          <strong>Your work in the app:</strong> your target business type and city, the leads we match you with, the
          pitches you generate, statuses, notes, and project values you enter.
        </li>
        <li>
          <strong>Website checks:</strong> the address checked and the results. Reports are visible to anyone with the
          link.
        </li>
        <li>
          <strong>Payments:</strong> plan status and payment references. Card details are handled by Paddle and Khalti;
          we never receive them.
        </li>
        <li>
          <strong>Security:</strong> a one-way hash of your IP address to limit abuse of free features, and a session
          cookie that keeps you logged in. We use no advertising or tracking cookies.
        </li>
      </ul>

      <h2>Business data</h2>
      <p>
        Leads are public business listings from Google Maps or OpenStreetMap (© OpenStreetMap contributors), plus
        contact details the business publishes on its own website. Details from Google are refreshed at least every 30
        days. If you represent a business and want it excluded, email us.
      </p>

      <h2>Who processes data for us</h2>
      <ul>
        <li>Hosting and database providers, to run the app.</li>
        <li>Anthropic, to draft pitches from the business details and check results (not used to train their models).</li>
        <li>Google PageSpeed Insights, which loads the public website being checked.</li>
        <li>
          Google Maps Platform (Places API) or OpenStreetMap services (Nominatim, Overpass), which receive your target
          city and business type.
        </li>
        <li>Resend, to send account emails such as password resets.</li>
        <li>Paddle and Khalti, to take payments.</li>
      </ul>
      <p>We don&apos;t sell your personal data.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data while your account exists. When you delete your account, your profile, leads, pitches and
        sessions are deleted immediately. Payment records may be kept by Paddle or Khalti as their laws require.
      </p>

      <h2>Your rights</h2>
      <p>
        You can see and edit your data in the app and delete your account from Settings. For a copy of your data or any
        other request, email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. If you are in the EU or
        UK you may also complain to your data protection authority.
      </p>
    </LegalPage>
  );
}
