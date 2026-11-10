import { createHmac, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function decodeBase32(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 character");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(out);
}

export function generateHotp(
  key: Buffer,
  counter: number,
  digits: number,
): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const truncated =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return (truncated % 10 ** digits).toString().padStart(digits, "0");
}

/**
 * Verifies a TOTP code against the base32 `secret` from an otpauth:// URI.
 * Accepts one period of clock drift either side, matching Better-Auth.
 */
export function verifyTotp(
  code: string,
  base32Secret: string,
  options: { digits?: number; period?: number; now?: number } = {},
): boolean {
  const digits = options.digits ?? 6;
  const period = options.period ?? 30;
  const candidate = code.trim();
  if (!new RegExp(`^\\d{${digits}}$`).test(candidate)) {
    return false;
  }

  const key = decodeBase32(base32Secret);
  const counter = Math.floor((options.now ?? Date.now()) / 1000 / period);

  for (let drift = -1; drift <= 1; drift++) {
    const expected = generateHotp(key, counter + drift, digits);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(candidate))) {
      return true;
    }
  }
  return false;
}

export function secretFromTotpUri(totpURI: string): string | null {
  try {
    return new URL(totpURI).searchParams.get("secret");
  } catch {
    return null;
  }
}
