"use client";

import { useEffect } from "react";
import { markConversationRead } from "@/app/actions/outreach";

/** Marks a conversation read once it's on screen, which also refreshes the unread count in the menu. */
export function MarkRead({ leadId }: { leadId: string }) {
  useEffect(() => {
    void markConversationRead(leadId);
  }, [leadId]);
  return null;
}
