require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const filesRoutes = require("./routes/files.routes");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("OK");
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/files", filesRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Appwrite wrapper backend running on port ${PORT}`);
});

module.exports = app;
