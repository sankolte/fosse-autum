const express = require("express");
const { users, ID } = require("../config/appwriteClient");

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await users.create(ID.unique(), email, undefined, password, name);

    res.status(201).json({
      user: {
        id: user.$id,
        email: user.email,
        name: user.name,
        createdAt: user.$createdAt,
      },
      message: "Registration successful. Please login to obtain a session.",
    });
  } catch (error) {
    if (error.code === 409) {
      return res.status(409).json({ error: "Email is already registered" });
    }
    res.status(error.code || 500).json({ error: error.message || "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const userList = await users.list();
    const user = userList.users.find((u) => u.email === email);

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Return user info and session token simulation
    const sessionToken = `appwrite-session-${user.$id}`;

    res.cookie("token", sessionToken, { httpOnly: true, sameSite: "lax" });
    res.status(200).json({
      token: sessionToken,
      user: {
        id: user.$id,
        email: user.email,
        name: user.name,
        createdAt: user.$createdAt,
      },
    });
  } catch (error) {
    res.status(error.code || 500).json({ error: error.message || "Login failed" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Successfully logged out" });
});

module.exports = router;
