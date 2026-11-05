"use client";

import { useState } from "react";
import {
  Loan,
  cancelLoan,
  declineLoan,
  forgiveLoan,
  fundLoan,
  remaining,
  repayLoan,
} from "@/lib/abeggi";
import { friendlyError } from "@/lib/format";
import { RepayDialog } from "./RepayDialog";

/** Shows only the buttons the viewing wallet is allowed to use. */
export function LoanActions({ loan, viewer, onDone }: { loan: Loan; viewer: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [repaying, setRepaying] = useState(false);

  const isLender = viewer === loan.lender;
  const isBorrower = viewer === loan.borrower;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setRepaying(false);
      onDone();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const buttons: React.ReactNode[] = [];
  if (loan.status === "Requested" && isLender) {
    buttons.push(
      <button key="fund" className="btn-primary" disabled={busy} onClick={() => run(() => fundLoan(viewer, loan.id))}>
        {busy ? "Sending…" : "Approve & send"}
      </button>,
      <button key="decline" className="btn-danger" disabled={busy} onClick={() => run(() => declineLoan(viewer, loan.id))}>
        Decline
      </button>,
    );
  }
  if (loan.status === "Requested" && isBorrower) {
    buttons.push(
      <button key="cancel" className="btn-danger" disabled={busy} onClick={() => run(() => cancelLoan(viewer, loan.id))}>
        Withdraw request
      </button>,
    );
  }
  if (loan.status === "Active" && isBorrower) {
    buttons.push(
      <button key="repay" className="btn-primary" disabled={busy} onClick={() => setRepaying(true)}>
        Pay back
      </button>,
    );
  }
  if (loan.status === "Active" && isLender) {
    buttons.push(
      <button key="forgive" className="btn-plain" disabled={busy} onClick={() => run(() => forgiveLoan(viewer, loan.id))}>
        Forgive the rest
      </button>,
    );
  }

  if (buttons.length === 0) return null;
  return (
    <div>
      <div className="flex flex-wrap gap-3">{buttons}</div>
      {err && <p className="mt-3 text-sm text-coral-600">{err}</p>}
      {repaying && (
        <RepayDialog
          left={remaining(loan)}
          busy={busy}
          onClose={() => setRepaying(false)}
          onConfirm={(amt) => run(() => repayLoan(viewer, loan.id, amt))}
        />
      )}
    </div>
  );
}
