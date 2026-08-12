const { verifyToken } = require("../utils/jwt");
const AppError = require("../utils/AppError");
const prisma = require("../config/prisma");

/**
 * Authentication middleware.
 * Verifies JWT token and checks if the token JTI has been revoked.
 */
const authMiddleware = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header first (Bearer <token>)
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      // Fallback to cookie
      token = req.cookies.token;
    }

    if (!token) {
      return next(new AppError("Authentication token missing", 401));
    }

    // Verify token signature & expiration
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return next(new AppError("Invalid or expired token", 401));
    }

    // Check if token JTI has been revoked in database
    if (decoded.jti) {
      const revoked = await prisma.revokedToken.findUnique({
        where: { jti: decoded.jti },
      });

      if (revoked) {
        return next(new AppError("Token has been revoked", 401));
      }
    }

    // Attach decoded user info to request object
    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authMiddleware;
