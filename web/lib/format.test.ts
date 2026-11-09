import { describe, expect, it } from "vitest";
import { endOfDayUnix, formatAmount, friendlyError, parseAmount } from "./format";

const I128_MAX = 2n ** 127n - 1n;

describe("parseAmount", () => {
  it("parses valid amounts", () => {
    expect(parseAmount("12.5")).toBe(125000000n);
    expect(parseAmount(" 1 ")).toBe(10000000n);
    expect(parseAmount("0.0000001")).toBe(1n);
    expect(parseAmount("0")).toBe(0n);
  });

  it.each(["", "  ", "5.", ".5", "0.00000001", "1e3", "-1", "+1", "1,000", "abc", "1.2.3"])(
    "rejects %j",
    (s) => expect(parseAmount(s)).toBeNull(),
  );

  it("respects the i128 range", () => {
    expect(parseAmount("17014118346046923173168730371588.4105727")).toBe(I128_MAX);
    expect(parseAmount("17014118346046923173168730371588.4105728")).toBeNull();
    expect(parseAmount("1" + "0".repeat(40))).toBeNull();
  });
});

describe("formatAmount", () => {
  it("formats units", () => {
    expect(formatAmount(125000000n)).toBe("12.5");
    expect(formatAmount(1n)).toBe("0.0000001");
    expect(formatAmount(0n)).toBe("0");
    expect(formatAmount(12345678900000n)).toBe("1,234,567.89");
  });

  it.each(["0", "1", "0.5", "12.34", "0.0000001", "999,999.9999999"])("round-trips %s", (s) => {
    expect(formatAmount(parseAmount(s.replaceAll(",", ""))!)).toBe(s);
  });

  it("round-trips i128 max", () => {
    expect(parseAmount(formatAmount(I128_MAX).replaceAll(",", ""))).toBe(I128_MAX);
  });
});

describe("endOfDayUnix", () => {
  it("returns 23:59:59 local time of the given day", () => {
    const d = new Date(endOfDayUnix("2030-03-09") * 1000);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2030, 2, 9]);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([23, 59, 59]);
  });
});

describe("friendlyError", () => {
  const expected: Record<number, string> = {
    1: "You can't lend to yourself.",
    2: "Amount must be more than zero.",
    3: "Pick a due date in the future.",
    4: "That note is too long (100 characters max).",
    5: "We couldn't find that loan.",
    6: "That loan has already moved on — refresh and check its status.",
    7: "That's more than what's left to pay.",
    8: "One of you has too many loans on this app already.",
  };
  for (const [code, msg] of Object.entries(expected)) {
    it(`maps contract error #${code}`, () => {
      expect(friendlyError(new Error(`HostError: Error(Contract, #${code})`))).toBe(msg);
    });
  }

  it("handles wallet and balance errors", () => {
    expect(friendlyError(new Error("User declined access"))).toBe("You cancelled the signature.");
    expect(friendlyError(new Error("op_underfunded"))).toBe("Not enough balance in that wallet.");
  });

  it("passes through unknown codes and truncates long messages", () => {
    expect(friendlyError("boom")).toBe("boom");
    expect(friendlyError(new Error("Error(Contract, #99)"))).toBe("Error(Contract, #99)");
    expect(friendlyError("x".repeat(200))).toHaveLength(161);
  });
});
