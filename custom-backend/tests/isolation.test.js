const request = require("supertest");
const app = require("../src/app");
const { signToken } = require("../src/utils/jwt");

jest.mock("../src/config/prisma", () => {
  const userAId = "11111111-1111-1111-1111-111111111111";
  const userBId = "22222222-2222-2222-2222-222222222222";

  const fileA = {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    filename: "userA_secret.txt",
    path: "uploads/userA_secret.txt",
    userId: userAId,
    createdAt: new Date(),
  };

  const fileB = {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    filename: "userB_secret.txt",
    path: "uploads/userB_secret.txt",
    userId: userBId,
    createdAt: new Date(),
  };

  const filesMap = new Map([
    [fileA.id, fileA],
    [fileB.id, fileB],
  ]);

  return {
    user: {
      findUnique: jest.fn(async ({ where }) => {
        if (where.id === userAId) return { id: userAId, email: "usera@test.com" };
        if (where.id === userBId) return { id: userBId, email: "userb@test.com" };
        return null;
      }),
    },
    file: {
      findMany: jest.fn(async ({ where }) => {
        return Array.from(filesMap.values()).filter((f) => f.userId === where.userId);
      }),
      findUnique: jest.fn(async ({ where }) => {
        return filesMap.get(where.id) || null;
      }),
    },
    revokedToken: {
      findUnique: jest.fn(async () => null),
    },
  };
});

describe("Cross-User File Access Isolation (IDOR Defense)", () => {
  const userAId = "11111111-1111-1111-1111-111111111111";
  const userBId = "22222222-2222-2222-2222-222222222222";

  const tokenA = signToken({ userId: userAId, email: "usera@test.com" }).token;
  const tokenB = signToken({ userId: userBId, email: "userb@test.com" }).token;

  it("should return only user's own files on GET /api/files", async () => {
    const res = await request(app)
      .get("/api/files")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0].filename).toBe("userA_secret.txt");
  });

  it("should deny access with 403 Forbidden when User A attempts to access User B's file", async () => {
    const fileBId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const res = await request(app)
      .get(`/api/files/${fileBId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain("Access denied");
  });

  it("should return 404 Not Found when accessing a non-existent file UUID", async () => {
    const nonexistentId = "99999999-9999-9999-9999-999999999999";
    const res = await request(app)
      .get(`/api/files/${nonexistentId}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("File not found");
  });

  it("should return 400 Bad Request when providing an invalid UUID format", async () => {
    const res = await request(app)
      .get("/api/files/not-a-valid-uuid")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Invalid file ID format");
  });
});
