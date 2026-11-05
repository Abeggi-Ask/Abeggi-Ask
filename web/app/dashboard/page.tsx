"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { loansOf } from "@/lib/abeggi";
import { useAsync } from "@/lib/useAsync";
import { useWallet } from "@/lib/wallet";
import { LoanCard } from "@/components/LoanCard";
import { friendlyError } from "@/lib/format";

type Tab = "owe" | "owed";

export default function Dashboard() {
  const { address } = useWallet();
  const [tab, setTab] = useState<Tab>("owe");
  const { data, error, loading } = useAsync(() => (address ? loansOf(address) : Promise.resolve([])), [address]);

  if (!address) {
    return <p className="panel mt-6 p-6">Connect your wallet (top right) to see your loans.</p>;
  }

  const mine = (data ?? []).filter((l) => (tab === "owe" ? l.borrower === address : l.lender === address));

  return (
    <>
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-4xl font-bold">My loans</h1>
        <Link href="/request" className="btn-primary h-10">New request</Link>
      </div>

      <div className="mt-6 inline-flex rounded-xl border-2 border-plum-900 bg-paper-card p-1">
        {([["owe", "I owe"], ["owed", "Owed to me"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx("rounded-lg px-4 py-1.5 text-sm font-semibold", tab === key ? "bg-plum-900 text-paper" : "text-plum-700")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {loading && <p className="text-plum-700">Loading…</p>}
        {error && <p className="text-coral-600">{friendlyError(error)}</p>}
        {!loading && !error && mine.length === 0 && (
          <p className="panel p-6 text-plum-700">
            {tab === "owe" ? "You don’t owe anybody. Enjoy!" : "Nobody owes you yet."}
          </p>
        )}
        {mine.map((l) => <LoanCard key={String(l.id)} loan={l} viewer={address} />)}
      </div>
    </>
  );
}
