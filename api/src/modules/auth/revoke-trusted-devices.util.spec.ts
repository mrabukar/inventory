import {
  TRUST_DEVICE_IDENTIFIER_PREFIX,
  trustedDeviceWhere,
} from "./revoke-trusted-devices.util";

describe("revoke-trusted-devices.util", () => {
  it("matches Better-Auth trust-device verification rows for the user", () => {
    expect(trustedDeviceWhere("user-1")).toEqual({
      value: "user-1",
      identifier: { startsWith: TRUST_DEVICE_IDENTIFIER_PREFIX },
    });
  });
});
