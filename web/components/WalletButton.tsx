"use client";

import { useState } from "react";
import { LogOut, Wallet } from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { friendlyError, shortAddress } from "@/lib/format";

export function WalletButton() {
  const { address, connect, disconnect } = useWallet();
  const [err, setErr] = useState<string | null>(null);

  if (address) {
    return (
      <button className="btn-plain h-10 px-3" onClick={disconnect} title="Disconnect">
        <span className="font-mono text-xs">{shortAddress(address)}</span>
        <LogOut size={14} />
      </button>
    );
  }
  return (
    <div className="flex flex-col items-end">
      <button
        className="btn-dark h-10"
        onClick={() => connect().then(() => setErr(null)).catch((e) => setErr(friendlyError(e)))}
      >
        <Wallet size={16} /> Connect wallet
      </button>
      {err && <p className="mt-1 max-w-[260px] text-right text-xs text-coral-600">{err}</p>}
    </div>
  );
}
