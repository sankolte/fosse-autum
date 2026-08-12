const express = require("express");
const sdk = require("node-appwrite");
const { users, ID, createSessionClient } = require("../config/appwriteClient");
const authMiddleware = require("../middlewares/auth.middleware");

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

    // Call account.createEmailPasswordSession using a fresh unauthenticated client
    const unauthClient = new sdk.Client();
    unauthClient
      .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
      .setProject(process.env.APPWRITE_PROJECT_ID || "osdag-secure-login");

    const unauthAccount = new sdk.Account(unauthClient);

    let session;
    try {
      session = await unauthAccount.createEmailPasswordSession(email, password);
    } catch (err) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Fetch user profile via account.get() using session-scoped client
    const sessionClient = createSessionClient(session.secret);
    const sessionAccount = new sdk.Account(sessionClient);
    const userProfile = await sessionAccount.get();

    res.cookie("token", session.secret, { httpOnly: true, sameSite: "lax" });
    res.status(200).json({
      token: session.secret,
      user: {
        id: userProfile.$id,
        email: userProfile.email,
        name: userProfile.name,
        createdAt: userProfile.$createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/logout
router.post("/logout", authMiddleware, async (req, res, next) => {
  try {
    const sessionClient = createSessionClient(req.appwriteSession);
    const sessionAccount = new sdk.Account(sessionClient);

    await sessionAccount.deleteSession("current");

    res.clearCookie("token");
    res.status(200).json({ message: "Successfully logged out" });
  } catch (error) {
    res.clearCookie("token");
    res.status(500).json({ error: "Logout failed" });
  }
});

module.exports = router;
