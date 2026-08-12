process.env.RATE_LIMIT_MAX = "100";

const request = require("supertest");
const app = require("../src/app");
const { hashPassword } = require("../src/utils/hash");

jest.mock("../src/config/prisma", () => {
  const mockUsers = new Map();
  const mockRevokedTokens = new Set();

  return {
    user: {
      findUnique: jest.fn(async ({ where }) => {
        if (where.email) {
          for (const user of mockUsers.values()) {
            if (user.email === where.email) return { ...user };
          }
        }
        if (where.id) {
          return mockUsers.has(where.id) ? { ...mockUsers.get(where.id) } : null;
        }
        return null;
      }),
      create: jest.fn(async ({ data }) => {
        const id = `user-uuid-${Math.random().toString(36).substring(2, 9)}`;
        const user = {
          id,
          email: data.email,
          passwordHash: data.passwordHash,
          name: data.name || null,
          createdAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          files: [],
        };
        mockUsers.set(id, user);
        return { ...user };
      }),
      update: jest.fn(async ({ where, data }) => {
        const user = mockUsers.get(where.id);
        if (!user) return null;
        if (data.failedLoginAttempts !== undefined) user.failedLoginAttempts = data.failedLoginAttempts;
        if (data.lockedUntil !== undefined) user.lockedUntil = data.lockedUntil;
        return { ...user };
      }),
    },
    revokedToken: {
      findUnique: jest.fn(async ({ where }) => {
        return mockRevokedTokens.has(where.jti) ? { jti: where.jti, expiresAt: new Date() } : null;
      }),
      create: jest.fn(async ({ data }) => {
        mockRevokedTokens.add(data.jti);
        return { jti: data.jti, expiresAt: data.expiresAt };
      }),
      upsert: jest.fn(async ({ create }) => {
        mockRevokedTokens.add(create.jti);
        return { jti: create.jti, expiresAt: create.expiresAt };
      }),
    },
  };
});

describe("Authentication & User Module", () => {
  const testUser = {
    email: "testauth@osdag.com",
    password: "Password123!",
    name: "Test Auth User",
  };

  let authToken = "";

  it("should register a new user successfully (201 Created)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("should login with valid credentials (200 OK)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testUser.email, password: testUser.password });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    authToken = res.body.token;
  });

  it("should return user profile on GET /api/user/me with valid token (200 OK)", async () => {
    const res = await request(app)
      .get("/api/user/me")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
  });

  it("should lock account after 5 failed login attempts (423 Locked)", async () => {
    const wrongUser = {
      email: "lockme@osdag.com",
      password: "Password123!",
    };

    // Register user first
    await request(app).post("/api/auth/register").send(wrongUser);

    // Fail 4 times (401)
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: wrongUser.email, password: "WrongPassword1!" });
      expect(res.statusCode).toBe(401);
    }

    // 5th attempt locks account (423)
    const lockRes = await request(app)
      .post("/api/auth/login")
      .send({ email: wrongUser.email, password: "WrongPassword1!" });

    expect(lockRes.statusCode).toBe(423);
    expect(lockRes.body.error).toContain("Account locked");
  });

  it("should revoke token on logout and block subsequent requests (401 Unauthorized)", async () => {
    // Logout with valid token
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${authToken}`);

    expect(logoutRes.statusCode).toBe(200);

    // Try accessing /api/user/me with revoked token
    const retryRes = await request(app)
      .get("/api/user/me")
      .set("Authorization", `Bearer ${authToken}`);

    expect(retryRes.statusCode).toBe(401);
    expect(retryRes.body.error).toContain("Token has been revoked");
  });
});
