export const LEAD_STATUSES = ["new", "sent", "replied", "call", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  sent: "Emailed",
  replied: "Replied",
  call: "Call booked",
  won: "Won",
  lost: "Not interested",
};
