"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { requestLoan } from "@/lib/abeggi";
import { endOfDayUnix, friendlyError, parseAmount, SYMBOL } from "@/lib/format";
import { useWallet } from "@/lib/wallet";

// Accepts a bare address or any pasted text/link containing one.
const extractAddress = (s: string) => s.match(/G[A-Z2-7]{55}/)?.[0] ?? null;

function RequestForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { address } = useWallet();

  const [lender, setLender] = useState(params.get("lender") ?? "");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const lenderAddr = extractAddress(lender);
  const units = parseAmount(amount);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const ok = address && lenderAddr && lenderAddr !== address && units && units > 0n && due >= tomorrow;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok || !address || !lenderAddr || !units) return;
    setBusy(true);
    setErr(null);
    try {
      const id = await requestLoan({
        borrower: address,
        lender: lenderAddr,
        amount: units,
        dueDate: endOfDayUnix(due),
        note: note.trim(),
      });
      router.push(`/loan/${id}?new=1`);
    } catch (e2) {
      setErr(friendlyError(e2));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel mt-4 space-y-5 p-5 sm:p-7">
      <div>
        <label htmlFor="lender" className="field-label">Who are you asking?</label>
        <input id="lender" className="field font-mono text-sm" placeholder="Their wallet address (G…)" value={lender} onChange={(e) => setLender(e.target.value)} />
        {lender && !lenderAddr && <p className="mt-1 text-xs text-coral-600">That doesn’t look like a Stellar address.</p>}
        {lenderAddr && lenderAddr === address && <p className="mt-1 text-xs text-coral-600">That’s you!</p>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="amount" className="field-label">How much? ({SYMBOL})</label>
          <input id="amount" className="field" inputMode="decimal" placeholder="5" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label htmlFor="due" className="field-label">Pay back by</label>
          <input id="due" type="date" min={tomorrow} className="field" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor="note" className="field-label">What’s it for? <span className="font-normal text-plum-500">({note.length}/100)</span></label>
        <input id="note" className="field" maxLength={100} placeholder="Transport money" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {!address && <p className="text-sm text-plum-700">Connect your wallet first (top right).</p>}
      {err && <p className="text-sm text-coral-600">{err}</p>}
      <button className="btn-primary w-full" disabled={!ok || busy}>{busy ? "Waiting for signature…" : "Send request"}</button>
    </form>
  );
}

export default function RequestPage() {
  return (
    <>
      <h1 className="mt-4 text-4xl font-bold">Ask for a loan</h1>
      <p className="mt-2 text-plum-700">Your friend gets to say yes or no. Nothing moves until they approve.</p>
      <Suspense fallback={null}>
        <RequestForm />
      </Suspense>
    </>
  );
}
