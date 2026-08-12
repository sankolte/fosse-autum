const express = require("express");
const authController = require("./auth.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { validate } = require("../../middlewares/validate.middleware");
const { registerSchema, loginSchema } = require("../../validators/auth.validator");
const { loginRateLimiter } = require("../../middlewares/rateLimit.middleware");

const router = express.Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", loginRateLimiter, validate(loginSchema), authController.login);
router.post("/logout", authMiddleware, authController.logout);

module.exports = router;
