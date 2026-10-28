"use client";

import { useActionState, useState } from "react";
import { answerQuote } from "@/app/actions/work";
import { Button, FormMessage, inputClass } from "../ui";
import { keepInputOnSubmit } from "../use-keep-input";

export function QuoteAnswer({ quoteId, total }: { quoteId: string; total: string }) {
  const [state, action, pending] = useActionState(answerQuote, undefined);
  const [declining, setDeclining] = useState(false);

  if (declining) {
    return (
      <form onSubmit={keepInputOnSubmit(action)} className="space-y-3">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="answer" value="decline" />
        <p className="text-sm">Decline this quote? You can still reply by email if you&apos;d like something different.</p>
        <FormMessage error={state?.error} />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" disabled={pending}>
            Yes, decline
          </Button>
          <Button type="button" variant="ghost" onClick={() => setDeclining(false)}>
            Go back
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-3">
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="answer" value="accept" />
      <label htmlFor="accept-name" className="block text-[13px] font-medium">
        Your name
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="accept-name" name="name" autoComplete="name" required className={`${inputClass} sm:max-w-xs`} />
        <Button type="submit" disabled={pending}>
          {pending ? "Accepting…" : `Accept for ${total}`}
        </Button>
      </div>
      <FormMessage error={state?.error} />
      <Button type="button" variant="ghost" className="px-0" onClick={() => setDeclining(true)}>
        Decline
      </Button>
    </form>
  );
}
