const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/env");

/**
 * Signs a JWT payload embedding a random unique JTI.
 * @param {object} payload - Data to embed in the token.
 * @returns {{ token: string, jti: string }}
 */
const signToken = (payload = {}) => {
  const jti = crypto.randomUUID();
  const tokenPayload = { ...payload, jti };
  const token = jwt.sign(tokenPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
  return { token, jti };
};

/**
 * Verifies a JWT token string.
 * @param {string} token - JWT token string to verify.
 * @returns {object} - Decoded token payload.
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  signToken,
  verifyToken,
};
