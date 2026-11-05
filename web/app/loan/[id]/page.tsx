"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { getLoan, remaining } from "@/lib/abeggi";
import { useAsync } from "@/lib/useAsync";
import { useWallet } from "@/lib/wallet";
import { dueCountdown, dueDateLabel, friendlyError, money, shortAddress } from "@/lib/format";
import { LoanActions } from "@/components/LoanActions";
import { Progress } from "@/components/LoanCard";
import { StatusBadge } from "@/components/StatusBadge";

function ShareBanner({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/loan/${id}`;
  return (
    <div className="mb-5 rounded-2xl bg-marigold-300 p-4 text-sm">
      <p className="font-semibold">Request sent! Now send your friend this link so they can approve it:</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-paper-card px-3 py-2">{url}</code>
        <button
          className="btn-dark h-9 px-3"
          onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
        </button>
        <a className="btn-plain h-9 px-3" href={`https://wa.me/?text=${encodeURIComponent(`Abeg, check this loan request: ${url}`)}`} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      </div>
    </div>
  );
}

function Detail() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get("new") === "1";
  const { address } = useWallet();
  const { data: loan, error, loading, reload } = useAsync(() => getLoan(BigInt(id)), [id]);

  if (loading && !loan) return <p className="mt-6 text-plum-700">Loading…</p>;
  if (error || !loan) return <p className="mt-6 text-coral-600">{friendlyError(error ?? "Loan not found")}</p>;

  const left = remaining(loan);
  const role = address === loan.borrower ? "borrower" : address === loan.lender ? "lender" : null;

  const rows: [string, React.ReactNode][] = [
    ["Borrower", <Link key="b" className="font-mono underline" href={`/u/${loan.borrower}`}>{shortAddress(loan.borrower)}</Link>],
    ["Lender", <Link key="l" className="font-mono underline" href={`/u/${loan.lender}`}>{shortAddress(loan.lender)}</Link>],
    ["Due", dueDateLabel(loan.dueDate)],
    ["Note", loan.note || "—"],
  ];

  return (
    <div className="mt-4">
      {isNew && <ShareBanner id={id} />}
      <div className="panel p-5 sm:p-7">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-plum-500">Loan #{String(loan.id)}</p>
            <p className="mt-1 font-display text-5xl font-black">{money(loan.amount)}</p>
          </div>
          <StatusBadge loan={loan} />
        </div>

        {loan.status === "Active" && (
          <div className="mt-5">
            <Progress loan={loan} />
            <p className="mt-2 text-sm">
              <b>{money(loan.repaid)}</b> paid · <b>{money(left)}</b> left · {dueCountdown(loan.dueDate)}
            </p>
          </div>
        )}
        {loan.status === "Repaid" && <p className="mt-4 font-semibold text-leaf-600">You don pay finish 🎉</p>}
        {loan.status === "Forgiven" && <p className="mt-4 font-semibold">E don do, no wahala. The rest was forgiven. 🕊️</p>}

        <dl className="mt-6 divide-y divide-plum-900/10 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between py-2.5"><dt className="text-plum-500">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
          ))}
        </dl>

        {role && address && (
          <div className="mt-6">
            <LoanActions loan={loan} viewer={address} onDone={reload} />
          </div>
        )}
        {!address && <p className="mt-6 text-sm text-plum-700">Connect your wallet to take action on this loan.</p>}
        {address && !role && <p className="mt-6 text-sm text-plum-700">You’re not part of this loan, so you can only look.</p>}
      </div>
    </div>
  );
}

export default function LoanPage() {
  return (
    <Suspense fallback={null}>
      <Detail />
    </Suspense>
  );
}
