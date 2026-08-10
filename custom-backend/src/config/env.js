// Environment variable loader and validation using Zod
require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || "default_jwt_secret",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m"
};
