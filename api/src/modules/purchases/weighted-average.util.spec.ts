import { computeWeightedAverageCost } from "./weighted-average.util";

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
