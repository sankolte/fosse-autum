const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Basic health check endpoint
app.get("/", (req, res) => {
  res.send("OK");
});

module.exports = app;
