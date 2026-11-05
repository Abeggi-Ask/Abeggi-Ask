import Link from "next/link";
import { Loan, remaining } from "@/lib/abeggi";
import { dueCountdown, money, shortAddress } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

export function Progress({ loan }: { loan: Loan }) {
  const pct = loan.amount > 0n ? Number((loan.repaid * 100n) / loan.amount) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full border border-plum-900/60 bg-paper-deep">
      <div className="h-full bg-leaf-600" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function LoanCard({ loan, viewer }: { loan: Loan; viewer: string }) {
  const iBorrowed = loan.borrower === viewer;
  const other = iBorrowed ? loan.lender : loan.borrower;
  const open = loan.status === "Active";
  return (
    <Link href={`/loan/${loan.id}`} className="panel block p-4 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-plum-500">
            {iBorrowed ? "From" : "To"} <span className="font-mono">{shortAddress(other)}</span>
          </p>
          <p className="mt-1 font-display text-2xl font-bold">{money(open ? remaining(loan) : loan.amount)}</p>
          {open && <p className="text-xs text-plum-500">left of {money(loan.amount)}</p>}
        </div>
        <StatusBadge loan={loan} />
      </div>
      {open && (
        <div className="mt-3">
          <Progress loan={loan} />
        </div>
      )}
      <div className="mt-3 flex justify-between text-xs text-plum-700">
        <span className="truncate pr-3">{loan.note || "—"}</span>
        {(loan.status === "Active" || loan.status === "Requested") && <span>{dueCountdown(loan.dueDate)}</span>}
      </div>
    </Link>
  );
}
