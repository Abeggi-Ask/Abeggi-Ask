"use client";

import { useSyncExternalStore } from "react";

// Tiny external store instead of a context provider: any component can call
// useWallet() and stay in sync.
let current: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const set = (a: string | null) => {
  current = a;
  notify();
};

async function freighter() {
  return import("@stellar/freighter-api");
}

export async function connectWallet() {
  const f = await freighter();
  const res = await f.requestAccess();
  if (res.error || !res.address) {
    throw new Error("Couldn't connect. Install Freighter and switch it to Testnet.");
  }
  set(res.address);
}

export const disconnectWallet = () => set(null);

export async function signWithWallet(xdr: string, networkPassphrase: string, address: string) {
  const f = await freighter();
  const res = await f.signTransaction(xdr, { networkPassphrase, address });
  if (res.error || !res.signedTxXdr) throw new Error(String(res.error?.message ?? "Signing was declined"));
  return res.signedTxXdr;
}

// Silently restore a previously-approved session.
if (typeof window !== "undefined") {
  freighter()
    .then((f) => f.getAddress())
    .then((r) => {
      if (r.address && !r.error) set(r.address);
    })
    .catch(() => {});
}

export function useWallet() {
  const address = useSyncExternalStore(subscribe, () => current, () => null);
  return { address, connected: address !== null, connect: connectWallet, disconnect: disconnectWallet };
}
