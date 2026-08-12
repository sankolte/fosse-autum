const AppError = require("../utils/AppError");

/**
 * Zod schema validation middleware for req.body.
 * @param {import("zod").ZodSchema} schema
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const issue = result.error.issues[0];
    const message = issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid request body";
    return next(new AppError(message, 400));
  }

  req.body = result.data;
  next();
};

/**
 * Zod schema validation middleware for req.params.
 * @param {import("zod").ZodSchema} schema
 */
const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);

  if (!result.success) {
    const issue = result.error.issues[0];
    const message = issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid request parameters";
    return next(new AppError(message, 400));
  }

  req.params = result.data;
  next();
};

module.exports = {
  validate,
  validateParams,
};
