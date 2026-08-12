const { hashPassword, comparePassword } = require("../src/utils/hash");

describe("Hash Utils", () => {
  const plainPassword = "Password123!";

  it("should hash plain text password successfully", async () => {
    const hash = await hashPassword(plainPassword);
    expect(hash).toBeDefined();
    expect(hash).not.toEqual(plainPassword);
    expect(typeof hash).toBe("string");
  });

  it("should return true when comparing matching password and hash", async () => {
    const hash = await hashPassword(plainPassword);
    const isValid = await comparePassword(plainPassword, hash);
    expect(isValid).toBe(true);
  });

  it("should return false when comparing incorrect password", async () => {
    const hash = await hashPassword(plainPassword);
    const isValid = await comparePassword("WrongPassword123!", hash);
    expect(isValid).toBe(false);
  });
});
