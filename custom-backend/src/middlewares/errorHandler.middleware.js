const AppError = require("../utils/AppError");

/**
 * Centralized Express Error Handling Middleware.
 */
const errorHandler = (err, req, res, next) => {
  // Handle Prisma Known Error Codes
  if (err.code === "P2002") {
    err = new AppError("Resource already exists", 409);
  } else if (err.code === "P2025") {
    err = new AppError("Resource not found", 404);
  }

  // Handle Operational Errors (AppError instances)
  if (err.isOperational) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Log non-operational / internal errors server-side only
  console.error("UNHANDLED ERROR:", err);

  // Return generic 500 error response without leaking stack traces or internal details
  return res.status(500).json({ error: "Internal server error" });
};

module.exports = errorHandler;
