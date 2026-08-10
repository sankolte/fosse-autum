const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("OK");
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Appwrite wrapper backend running on port ${PORT}`);
});
