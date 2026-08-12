process.env.RATE_LIMIT_MAX = "5";

const request = require("supertest");
const app = require("../src/app");

describe("Login IP Rate Limiting", () => {
  it("should trigger HTTP 429 Too Many Requests after 5 login attempts", async () => {
    const loginPayload = {
      email: "ratelimit@test.com",
      password: "WrongPassword1!",
    };

    // First 5 attempts return 401 (or 423)
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/login").send(loginPayload);
    }

    // 6th attempt should trigger 429 Too Many Requests from express-rate-limit
    const res = await request(app).post("/api/auth/login").send(loginPayload);
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toContain("Too many login attempts");
  });
});
