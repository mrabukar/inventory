import {
  decodeBase32,
  generateHotp,
  secretFromTotpUri,
  verifyTotp,
} from "./totp.util";

// RFC 6238 SHA-1 test secret "12345678901234567890", base32-encoded.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("totp util", () => {
  it("decodes base32", () => {
    expect(decodeBase32(RFC_SECRET).toString()).toBe("12345678901234567890");
  });

  it("matches RFC 6238 vectors (last 6 digits)", () => {
    const key = decodeBase32(RFC_SECRET);
    expect(generateHotp(key, Math.floor(59 / 30), 8)).toBe("94287082");
    expect(generateHotp(key, Math.floor(1111111109 / 30), 8)).toBe("07081804");
    expect(generateHotp(key, Math.floor(1234567890 / 30), 6)).toBe("005924");
  });

  it("verifies within one period of drift", () => {
    const now = 1234567890 * 1000;
    expect(verifyTotp("005924", RFC_SECRET, { now })).toBe(true);
    expect(verifyTotp("005924", RFC_SECRET, { now: now + 30_000 })).toBe(true);
    expect(verifyTotp("005924", RFC_SECRET, { now: now + 90_000 })).toBe(false);
  });

  it("rejects malformed codes", () => {
    expect(verifyTotp("12345", RFC_SECRET)).toBe(false);
    expect(verifyTotp("abcdef", RFC_SECRET)).toBe(false);
  });

  it("reads the secret from an otpauth URI", () => {
    expect(
      secretFromTotpUri(
        "otpauth://totp/App:a%40b.c?secret=ABC234&issuer=App&digits=6",
      ),
    ).toBe("ABC234");
    expect(secretFromTotpUri("not a uri")).toBeNull();
  });
});
