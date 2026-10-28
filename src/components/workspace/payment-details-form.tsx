"use client";

import { useActionState, useState } from "react";
import { savePaymentDetails } from "@/app/actions/work";
import type { PaymentDetails } from "@/lib/work/types";
import { Button, Field, FormMessage, inputClass } from "../ui";
import { keepInputOnSubmit } from "../use-keep-input";

export function PaymentDetailsForm({ details }: { details: PaymentDetails }) {
  const [state, action, pending] = useActionState(savePaymentDetails, undefined);
  const [removeQr, setRemoveQr] = useState(false);
  const input = (name: keyof PaymentDetails, props: Record<string, string> = {}) => (
    <input name={name} defaultValue={details[name] ?? ""} className={inputClass} {...props} />
  );
  return (
    <form onSubmit={keepInputOnSubmit(action)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="eSewa ID" hint="Usually your mobile number.">
          {input("esewaId", { inputMode: "tel" })}
        </Field>
        <Field label="Khalti ID">{input("khaltiId", { inputMode: "tel" })}</Field>
        <Field label="Bank">{input("bankName", { placeholder: "e.g. Nabil Bank" })}</Field>
        <Field label="Branch">{input("bankBranch")}</Field>
        <Field label="Account name">{input("bankAccountName")}</Field>
        <Field label="Account number">{input("bankAccountNumber", { inputMode: "numeric" })}</Field>
        <Field label="Payoneer email" hint="For clients abroad.">
          {input("payoneerEmail", { type: "email" })}
        </Field>
      </div>
      <Field label="Anything else" hint="A Wise or PayPal link, or “Cash on handover”.">
        <textarea name="other" rows={2} defaultValue={details.other ?? ""} className={inputClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-4">
          <Field label="Payment QR code" hint="A screenshot of your eSewa, Khalti or Fonepay QR. PNG or JPEG, under 300 KB.">
            <input name="qr" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm file:mr-3 file:rounded-[5px] file:border file:border-strong-border file:bg-surface file:px-3 file:py-1.5 file:text-sm" />
          </Field>
          <Field label="QR label">{input("qrLabel", { placeholder: "Fonepay: Kushal Budhathoki" })}</Field>
        </div>
        {details.qrImage && !removeQr && (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- small data URL */}
            <img src={details.qrImage} alt="Your current payment QR code" className="size-28 rounded border border-border object-contain" />
            <button type="button" onClick={() => setRemoveQr(true)} className="mt-1 text-[13px] text-muted hover:text-pen">
              Remove
            </button>
          </div>
        )}
      </div>
      {removeQr && <input type="hidden" name="removeQr" value="1" />}

      <FormMessage error={state?.error} success={state?.success} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save payment details"}
      </Button>
    </form>
  );
}
