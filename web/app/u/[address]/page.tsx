"use client";

import { useParams } from "next/navigation";
import { recordOf } from "@/lib/abeggi";
import { useAsync } from "@/lib/useAsync";
import { friendlyError, money, shortAddress } from "@/lib/format";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <p className="text-xs font-semibold text-plum-500">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}

export default function PublicRecord() {
  const { address } = useParams<{ address: string }>();
  const { data: r, error, loading } = useAsync(() => recordOf(address), [address]);

  if (loading) return <p className="mt-6 text-plum-700">Loading…</p>;
  if (error || !r) return <p className="mt-6 text-coral-600">{friendlyError(error ?? "No record")}</p>;

  const rate = r.loansRepaid > 0 ? Math.round((r.repaidOnTime / r.loansRepaid) * 100) : null;

  return (
    <>
      <h1 className="mt-4 text-4xl font-bold">Repayment record</h1>
      <p className="mt-1 font-mono text-sm text-plum-500">{shortAddress(address)}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Stat label="Loans repaid" value={`${r.loansRepaid} / ${r.loansTaken}`} />
        <Stat label="Paid on time" value={rate === null ? "—" : `${rate}%`} />
        <Stat label="Total borrowed" value={money(r.totalBorrowed)} />
        <Stat label="Total lent" value={money(r.totalLent)} />
      </div>
      <p className="mt-6 text-sm text-plum-700">
        Read straight from the contract. Only funded loans count, and nobody can edit it.
      </p>
    </>
  );
}
