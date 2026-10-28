"use client";

import { useState } from "react";
import { amountInputValue, parseAmount } from "@/lib/work/pricing";
import { lineItemsTotal, type LineItem } from "@/lib/work/types";
import { formatMoney } from "@/lib/money";
import { Button, inputClass } from "../ui";

type Row = { key: number; title: string; detail: string; amount: string };

let nextKey = 0;
const toRow = (i: LineItem): Row => ({ key: nextKey++, title: i.title, detail: i.detail ?? "", amount: amountInputValue(i.amountMinor) });

/**
 * Editable list of priced lines. Posts the whole list as JSON in a hidden `items`
 * field, so the server validates one array rather than a pile of indexed inputs.
 */
export function LineItemsEditor({ initial, currency, disabled }: { initial: LineItem[]; currency: string; disabled?: boolean }) {
  const [rows, setRows] = useState<Row[]>(() => (initial.length ? initial.map(toRow) : [toRow({ title: "", amountMinor: 0 })]));

  const items = rows
    .filter((r) => r.title.trim() || r.amount.trim())
    .map((r) => ({ title: r.title.trim(), detail: r.detail.trim() || undefined, amountMinor: parseAmount(r.amount) ?? -1 }));
  const total = lineItemsTotal(items.filter((i) => i.amountMinor > 0));

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div>
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <ol className="divide-y divide-border border-y border-border">
        {rows.map((r, i) => (
          <li key={r.key} className="grid gap-2 py-3 sm:grid-cols-[1fr_8rem_auto] sm:items-start">
            <div className="space-y-1.5">
              <input
                value={r.title}
                onChange={(e) => update(r.key, { title: e.target.value })}
                placeholder="What you'll do"
                aria-label={`Line ${i + 1} description`}
                disabled={disabled}
                className={`${inputClass} font-medium`}
              />
              <input
                value={r.detail}
                onChange={(e) => update(r.key, { detail: e.target.value })}
                placeholder="Details the client will see (optional)"
                aria-label={`Line ${i + 1} details`}
                disabled={disabled}
                className={`${inputClass} text-muted`}
              />
            </div>
            <input
              value={r.amount}
              onChange={(e) => update(r.key, { amount: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              aria-label={`Line ${i + 1} price in ${currency}`}
              aria-invalid={r.amount !== "" && parseAmount(r.amount) === null}
              disabled={disabled}
              className={`${inputClass} text-right font-mono tabular-nums aria-[invalid=true]:border-pen`}
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                disabled={rows.length === 1}
                className="justify-self-end py-2 text-[13px] text-muted hover:text-pen disabled:invisible"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center justify-between gap-4">
        {!disabled ? (
          <Button type="button" variant="ghost" className="px-0" onClick={() => setRows((rs) => [...rs, toRow({ title: "", amountMinor: 0 })])}>
            Add a line
          </Button>
        ) : (
          <span />
        )}
        <p className="text-sm">
          <span className="text-muted">Total </span>
          <span data-testid="items-total" className="font-mono text-lg font-medium tabular-nums">
            {formatMoney(total, currency)}
          </span>
        </p>
      </div>
    </div>
  );
}
