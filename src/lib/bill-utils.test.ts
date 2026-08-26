import { describe, expect, it } from "vitest";
import { partitionBills } from "~/lib/bill-utils";

describe("partitionBills", () => {
  it("splits installments from ordinary bills", () => {
    const rows = [
      { _id: "a" },
      { _id: "b", bnplAccountId: "acc1" },
      { _id: "c", bnplAccountId: null },
      { _id: "d", bnplAccountId: "acc2" },
    ];

    const { bills, installments } = partitionBills(rows);

    expect(bills.map((b) => b._id)).toEqual(["a", "c"]);
    expect(installments.map((b) => b._id)).toEqual(["b", "d"]);
  });

  it("treats an empty-string account id as an ordinary bill", () => {
    // Defensive: an empty string is not a usable ObjectId, so it must not be
    // routed into the installment bucket where it would be grouped by a
    // meaningless key.
    const { bills, installments } = partitionBills([
      { _id: "a", bnplAccountId: "" },
    ]);

    expect(bills.map((b) => b._id)).toEqual(["a"]);
    expect(installments).toEqual([]);
  });

  it("preserves input order within each bucket", () => {
    const rows = [
      { _id: "1", bnplAccountId: "x" },
      { _id: "2" },
      { _id: "3", bnplAccountId: "x" },
      { _id: "4" },
    ];

    const { bills, installments } = partitionBills(rows);

    expect(bills.map((b) => b._id)).toEqual(["2", "4"]);
    expect(installments.map((b) => b._id)).toEqual(["1", "3"]);
  });

  it("returns two empty buckets for empty input", () => {
    expect(partitionBills([])).toEqual({ bills: [], installments: [] });
  });
});
