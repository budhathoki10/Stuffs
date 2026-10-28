/** Business details shown on legal pages. Set these env vars before going live. */
export const SITE = {
  name: "Pitchcraft",
  operator: process.env.LEGAL_OPERATOR_NAME || "the operator of Pitchcraft",
  country: process.env.LEGAL_COUNTRY || "Nepal",
  supportEmail: process.env.SUPPORT_EMAIL || "support@example.com",
  legalUpdated: "28 October 2026",
};
