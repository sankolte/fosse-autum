const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./modules/auth/auth.routes");
const userRoutes = require("./modules/user/user.routes");
const filesRoutes = require("./modules/files/files.routes");
const errorHandler = require("./middlewares/errorHandler.middleware");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Basic health check endpoint
app.get("/", (req, res) => {
  res.send("OK");
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/files", filesRoutes);

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
