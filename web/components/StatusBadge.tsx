import clsx from "clsx";
import { Loan, isOverdue } from "@/lib/abeggi";

const TONES: Record<string, string> = {
  Requested: "bg-marigold-300 text-plum-950",
  Active: "bg-plum-900 text-paper",
  Overdue: "bg-coral-500 text-white",
  Repaid: "bg-leaf-100 text-leaf-600",
  Forgiven: "bg-plum-300 text-plum-900",
  Declined: "bg-paper-deep text-plum-700",
  Cancelled: "bg-paper-deep text-plum-700",
};

export function StatusBadge({ loan }: { loan: Loan }) {
  const label = isOverdue(loan) ? "Overdue" : loan.status;
  return (
    <span className={clsx("rounded-full px-2.5 py-1 text-xs font-bold", TONES[label])}>{label}</span>
  );
}
