import {
  computeWeightedAverageCost,
  reverseWeightedAverageCost,
} from "./weighted-average.util";

describe("computeWeightedAverageCost", () => {
  it("returns purchase unit cost when onHand is zero", () => {
    expect(computeWeightedAverageCost(0, 0, 10, 110)).toBe(110);
  });

  it("matches PURCHASING_DESIGN.md step 3 worked example", () => {
    // 6 units @ 110, purchase 10 @ 120 → (6*110 + 10*120) / 16 = 116.25
    expect(computeWeightedAverageCost(6, 110, 10, 120)).toBe(116.25);
  });

  it("keeps average unchanged when repurchasing at same cost", () => {
    expect(computeWeightedAverageCost(10, 110, 5, 110)).toBe(110);
  });
});

describe("reverseWeightedAverageCost", () => {
  it("keeps average unchanged when reversing at the same price (Nokia case, example A)", () => {
    // 20 @ 100, reverse 2 @ 100 → (2000 - 200) / 18 = 100
    expect(reverseWeightedAverageCost(20, 100, 2, 100)).toBe(100);
  });

  it("recovers the exact blended cost (example B)", () => {
    // pool: 10@100 + 10@120 → avg 110 over 20; reverse 2 of the @120 line
    // (2200 - 240) / 18 = 108.888... → 108.89
    expect(reverseWeightedAverageCost(20, 110, 2, 120)).toBe(108.89);
  });

  it("returns 0 when reversing all remaining stock", () => {
    expect(reverseWeightedAverageCost(18, 100, 18, 100)).toBe(0);
  });

  it("clamps to 0 instead of going negative when value is over-removed", () => {
    // currentValue 500, removedValue 600 → negative → clamp 0
    expect(reverseWeightedAverageCost(10, 50, 5, 120)).toBe(0);
  });

  it("throws when reverseQty is not positive", () => {
    expect(() => reverseWeightedAverageCost(10, 100, 0, 100)).toThrow();
  });

  it("throws when reverseQty exceeds on-hand", () => {
    expect(() => reverseWeightedAverageCost(5, 100, 6, 100)).toThrow();
  });
});
