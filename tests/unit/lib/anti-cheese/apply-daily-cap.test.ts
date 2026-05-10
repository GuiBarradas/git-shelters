import { describe, expect, it } from "vitest";

import { applyDailyCap } from "@/lib/anti-cheese/apply-daily-cap";

const credit = (delta: number, source_ref: string) => ({
  delta,
  source: "github_sync",
  source_ref,
});

describe("applyDailyCap", () => {
  it("returns the empty list unchanged", () => {
    expect(applyDailyCap([], 100)).toEqual([]);
  });

  it("returns the empty list when no cap remains", () => {
    const credits = [credit(5, "a"), credit(5, "b")];
    expect(applyDailyCap(credits, 0)).toEqual([]);
  });

  it("returns the empty list when cap remaining is negative (defensive)", () => {
    // A negative `capRemaining` would mean the caller already over-credited
    // somehow. Drop everything and let the underlying state be reconciled
    // out-of-band; never widen the breach.
    const credits = [credit(5, "a")];
    expect(applyDailyCap(credits, -10)).toEqual([]);
  });

  it("passes everything through when total fits under the cap", () => {
    const credits = [credit(3, "a"), credit(7, "b"), credit(10, "c")];
    expect(applyDailyCap(credits, 100)).toEqual(credits);
  });

  it("drops credits once cumulative delta exceeds cap", () => {
    const credits = [credit(40, "a"), credit(40, "b"), credit(40, "c")];

    const result = applyDailyCap(credits, 100);

    // First two fit (80). The third (would push to 120) is dropped whole.
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.source_ref)).toEqual(["a", "b"]);
  });

  it("drops a credit atomically — never partial", () => {
    // 3 credits: 30 + 70 + 5. Cap remaining = 95. The second pushes the
    // running total to 100, which still fits (≤ cap). The third would
    // push past 95+5 budget? Actually 100 + 5 = 105 over 95 budget — but
    // the second alone (30+70 = 100) exceeds 95, so it should drop.
    // Verifies the all-or-nothing rule, not "fit as many bytes as possible".
    const credits = [credit(30, "a"), credit(70, "b"), credit(5, "c")];

    const result = applyDailyCap(credits, 95);

    // First fits (30 ≤ 95). Second would push to 100 > 95, drop.
    // Third by itself would fit, but ordering is preserved — once we
    // start dropping, we stop. (Decision: keep iteration deterministic
    // and ordered; do not "skip and try later" credits.)
    expect(result).toHaveLength(1);
    expect(result[0]?.source_ref).toBe("a");
  });

  it("preserves order of accepted credits", () => {
    const credits = [credit(10, "first"), credit(20, "second"), credit(30, "third")];
    const result = applyDailyCap(credits, 100);
    expect(result.map((c) => c.source_ref)).toEqual(["first", "second", "third"]);
  });

  it("treats non-positive deltas as zero-cost (passes through)", () => {
    // Negative or zero deltas (compensating rows) do not consume cap budget.
    const credits = [credit(50, "a"), credit(-20, "b"), credit(50, "c")];
    const result = applyDailyCap(credits, 100);
    expect(result).toHaveLength(3);
  });
});
