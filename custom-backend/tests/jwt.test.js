const { signToken, verifyToken } = require("../src/utils/jwt");

describe("JWT Utils", () => {
  const payload = { userId: "test-user-uuid-1234", email: "test@example.com" };

  it("should sign payload and include unique jti string", () => {
    const { token, jti } = signToken(payload);
    expect(token).toBeDefined();
    expect(jti).toBeDefined();
    expect(typeof jti).toBe("string");
    expect(jti.length).toBeGreaterThan(0);
  });

  it("should verify signed token and decode payload containing jti", () => {
    const { token, jti } = signToken(payload);
    const decoded = verifyToken(token);

    expect(decoded.userId).toEqual(payload.userId);
    expect(decoded.email).toEqual(payload.email);
    expect(decoded.jti).toEqual(jti);
  });

  it("should throw an error when verifying an invalid token", () => {
    expect(() => verifyToken("invalid.token.string")).toThrow();
  });
});
