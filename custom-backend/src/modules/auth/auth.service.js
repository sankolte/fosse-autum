const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");
const { hashPassword, comparePassword } = require("../../utils/hash");
const { signToken } = require("../../utils/jwt");

/**
 * Registers a new user.
 * @param {string} email
 * @param {string} password
 * @param {string} [name]
 */
const register = async (email, password, name) => {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError("Email is already registered", 409);
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name || null,
    },
  });

  const { token } = signToken({ userId: user.id, email: user.email });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    token,
  };
};

/**
 * Authenticates user and enforces 5-attempt account lock.
 * @param {string} email
 * @param {string} password
 */
const login = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  // Check account lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError("Account locked due to multiple failed login attempts. Try again later.", 423);
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    const newFailedAttempts = user.failedLoginAttempts + 1;
    let lockedUntil = null;

    if (newFailedAttempts >= 5) {
      lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newFailedAttempts,
        lockedUntil,
      },
    });

    if (newFailedAttempts >= 5) {
      throw new AppError("Account locked due to multiple failed login attempts. Try again later.", 423);
    }

    throw new AppError("Invalid email or password", 401);
  }

  // Reset failed login attempts on successful login
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  const { token } = signToken({ userId: user.id, email: user.email });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    token,
  };
};

/**
 * Revokes a token by inserting its JTI into RevokedToken table.
 * @param {string} jti
 * @param {number} [exp]
 */
const logout = async (jti, exp) => {
  if (!jti) {
    throw new AppError("Invalid token JTI for revocation", 400);
  }

  const expiresAt = exp ? new Date(exp * 1000) : new Date(Date.now() + 15 * 60 * 1000);

  // Upsert or create to avoid duplicate primary key errors if already logged out
  await prisma.revokedToken.upsert({
    where: { jti },
    update: { expiresAt },
    create: { jti, expiresAt },
  });
};

module.exports = {
  register,
  login,
  logout,
};
