import { format, formatDistanceToNowStrict, fromUnixTime } from "date-fns";

export const DECIMALS = 7;
const UNIT = 10n ** BigInt(DECIMALS);
export const SYMBOL = process.env.NEXT_PUBLIC_TOKEN_SYMBOL || "XLM";

/** "12.5" -> 125000000n. Returns null when the text isn't a valid amount. */
export function parseAmount(text: string): bigint | null {
  const t = text.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return BigInt(whole) * UNIT + BigInt(frac.padEnd(DECIMALS, "0"));
}

/** 125000000n -> "12.5" */
export function formatAmount(units: bigint): string {
  const whole = units / UNIT;
  const frac = (units % UNIT).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  const w = whole.toLocaleString("en-US");
  return frac ? `${w}.${frac}` : w;
}

export const money = (units: bigint) => `${formatAmount(units)} ${SYMBOL}`;

export const shortAddress = (a: string) => (a.length > 12 ? `${a.slice(0, 5)}…${a.slice(-5)}` : a);

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export const dueDateLabel = (unix: bigint) => format(fromUnixTime(Number(unix)), "d MMM yyyy");

export function dueCountdown(unix: bigint): string {
  const d = fromUnixTime(Number(unix));
  const dist = formatDistanceToNowStrict(d);
  return d.getTime() < Date.now() ? `${dist} overdue` : `due in ${dist}`;
}

/** yyyy-mm-dd (local) -> unix seconds at end of that day. */
export function endOfDayUnix(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.floor(new Date(y, m - 1, d, 23, 59, 59).getTime() / 1000);
}

const CONTRACT_ERRORS: Record<number, string> = {
  1: "You can't lend to yourself.",
  2: "Amount must be more than zero.",
  3: "Pick a due date in the future.",
  4: "That note is too long (100 characters max).",
  5: "We couldn't find that loan.",
  6: "That loan has already moved on — refresh and check its status.",
  7: "That's more than what's left to pay.",
  8: "One of you has too many loans on this app already.",
};

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/Error\(Contract, #(\d+)\)/);
  if (m && CONTRACT_ERRORS[Number(m[1])]) return CONTRACT_ERRORS[Number(m[1])];
  if (/declined|rejected|denied/i.test(msg)) return "You cancelled the signature.";
  if (/op_underfunded|insufficient|balance/i.test(msg)) return "Not enough balance in that wallet.";
  return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
}
