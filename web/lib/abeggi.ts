import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { signWithWallet } from "./wallet";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
const PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
export const CONTRACT_ID = process.env.NEXT_PUBLIC_ABEGGI_CONTRACT_ID || "";

// Reads are simulated from an all-zero account; no funded account required.
const READ_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

export type Status = "Requested" | "Active" | "Repaid" | "Forgiven" | "Declined" | "Cancelled";

export interface Loan {
  id: bigint;
  borrower: string;
  lender: string;
  amount: bigint;
  repaid: bigint;
  dueDate: bigint;
  note: string;
  status: Status;
  createdAt: bigint;
  fundedAt: bigint;
  closedAt: bigint;
}

export interface TrackRecord {
  loansTaken: number;
  loansRepaid: number;
  repaidOnTime: number;
  totalBorrowed: bigint;
  totalLent: bigint;
}

const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });

const addr = (a: string) => new Address(a).toScVal();
const u64 = (n: bigint | number) => nativeToScVal(BigInt(n), { type: "u64" });
const i128 = (n: bigint) => nativeToScVal(n, { type: "i128" });

function requireContract() {
  if (!CONTRACT_ID) throw new Error("Contract not configured. Set NEXT_PUBLIC_ABEGGI_CONTRACT_ID in web/.env.local.");
  return new Contract(CONTRACT_ID);
}

async function read<T = unknown>(method: string, ...args: xdr.ScVal[]): Promise<T> {
  const tx = new TransactionBuilder(new Account(READ_SOURCE, "0"), {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(requireContract().call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!sim.result) throw new Error("Empty response from contract");
  return scValToNative(sim.result.retval) as T;
}

async function write(signer: string, method: string, ...args: xdr.ScVal[]): Promise<unknown> {
  const account = await server.getAccount(signer);
  const built = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(requireContract().call(method, ...args))
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(built); // simulate + attach footprint/auth
  const signed = await signWithWallet(prepared.toXDR(), PASSPHRASE, signer);
  const sent = await server.sendTransaction(TransactionBuilder.fromXDR(signed, PASSPHRASE));
  if (sent.status === "ERROR") throw new Error("Network rejected the transaction");

  for (let i = 0; i < 30; i++) {
    const res = await server.getTransaction(sent.hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return res.returnValue ? scValToNative(res.returnValue) : undefined;
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) throw new Error("Transaction failed on-chain");
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Timed out waiting for confirmation");
}

// ---------- decoding ----------

const statusOf = (v: unknown): Status => (Array.isArray(v) ? v[0] : v) as Status;

function toLoan(r: any): Loan {
  return {
    id: BigInt(r.id),
    borrower: r.borrower,
    lender: r.lender,
    amount: BigInt(r.amount),
    repaid: BigInt(r.repaid),
    dueDate: BigInt(r.due_date),
    note: r.note,
    status: statusOf(r.status),
    createdAt: BigInt(r.created_at),
    fundedAt: BigInt(r.funded_at),
    closedAt: BigInt(r.closed_at),
  };
}

// ---------- public API ----------

export const getLoan = async (id: bigint | number) => toLoan(await read("get_loan", u64(id)));

export async function loansOf(user: string): Promise<Loan[]> {
  const ids = await read<bigint[]>("loans_of", addr(user));
  const loans = await Promise.all(ids.map((id) => getLoan(id)));
  return loans.sort((a, b) => Number(b.id - a.id));
}

export async function recordOf(user: string): Promise<TrackRecord> {
  const r: any = await read("record_of", addr(user));
  return {
    loansTaken: Number(r.loans_taken),
    loansRepaid: Number(r.loans_repaid),
    repaidOnTime: Number(r.repaid_on_time),
    totalBorrowed: BigInt(r.total_borrowed),
    totalLent: BigInt(r.total_lent),
  };
}

export async function requestLoan(p: {
  borrower: string;
  lender: string;
  amount: bigint;
  dueDate: number;
  note: string;
}): Promise<bigint> {
  const id = await write(
    p.borrower,
    "request",
    addr(p.borrower),
    addr(p.lender),
    i128(p.amount),
    u64(p.dueDate),
    nativeToScVal(p.note, { type: "string" }),
  );
  return BigInt(id as bigint);
}

export const fundLoan = (signer: string, id: bigint) => write(signer, "fund", u64(id));
export const declineLoan = (signer: string, id: bigint) => write(signer, "decline", u64(id));
export const cancelLoan = (signer: string, id: bigint) => write(signer, "cancel", u64(id));
export const forgiveLoan = (signer: string, id: bigint) => write(signer, "forgive", u64(id));
export const repayLoan = (signer: string, id: bigint, amount: bigint) =>
  write(signer, "repay", u64(id), i128(amount));

// ---------- derived helpers ----------

export const remaining = (l: Loan) => l.amount - l.repaid;

export const isOverdue = (l: Loan, nowSec = Math.floor(Date.now() / 1000)) =>
  l.status === "Active" && BigInt(nowSec) > l.dueDate;
