const rateLimit = require("express-rate-limit");

/**
 * Rate limiting middleware for login attempts.
 * Limits each IP to 5 requests per 15 minutes by default (configurable via RATE_LIMIT_MAX).
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || "5", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts from this IP, please try again after 15 minutes" },
});

module.exports = {
  loginRateLimiter,
};
