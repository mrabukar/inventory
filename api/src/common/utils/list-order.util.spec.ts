import {
  orderByCreatedAtDesc,
  orderByUpdatedAtDesc,
} from "./list-order.util";

describe("list-order.util", () => {
  it("exports updatedAt desc for models with updatedAt", () => {
    expect(orderByUpdatedAtDesc).toEqual({ updatedAt: "desc" });
  });

  it("exports createdAt desc fallback for append-only models", () => {
    expect(orderByCreatedAtDesc).toEqual({ createdAt: "desc" });
  });
});
