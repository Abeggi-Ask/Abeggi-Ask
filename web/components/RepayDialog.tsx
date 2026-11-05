"use client";

import { useState } from "react";
import { formatAmount, money, parseAmount, SYMBOL } from "@/lib/format";

export function RepayDialog({
  left,
  busy,
  onClose,
  onConfirm,
}: {
  left: bigint;
  busy: boolean;
  onClose: () => void;
  onConfirm: (amount: bigint) => void;
}) {
  const [text, setText] = useState("");
  const amt = parseAmount(text);
  const valid = amt !== null && amt > 0n && amt <= left;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-plum-950/50 p-4 sm:items-center" onClick={onClose}>
      <div className="panel w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-2xl font-bold">Pay back</h3>
        <p className="mt-1 text-sm text-plum-700">Still owing {money(left)}. Pay it all or a bit at a time.</p>

        <label className="field-label mt-4" htmlFor="repay-amt">Amount ({SYMBOL})</label>
        <input
          id="repay-amt"
          className="field"
          inputMode="decimal"
          placeholder="0.00"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        {text && !valid && <p className="mt-1 text-xs text-coral-600">Enter an amount up to {formatAmount(left)}.</p>}
        <button className="mt-2 text-xs font-semibold underline" onClick={() => setText(formatAmount(left).replace(/,/g, ""))}>
          Pay everything
        </button>

        <div className="mt-5 flex gap-2">
          <button className="btn-plain flex-1" onClick={onClose} disabled={busy}>Not now</button>
          <button className="btn-primary flex-1" disabled={!valid || busy} onClick={() => amt && onConfirm(amt)}>
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
