const express = require("express");
const { users } = require("../config/appwriteClient");

const router = express.Router();

// GET /api/user/me
router.get("/me", async (req, res) => {
  try {
    let token = req.headers.authorization
      ? req.headers.authorization.replace("Bearer ", "")
      : req.cookies.token;

    if (!token || !token.startsWith("appwrite-session-")) {
      return res.status(401).json({ error: "Authentication token missing or invalid" });
    }

    const userId = token.replace("appwrite-session-", "");
    const user = await users.get(userId);

    res.status(200).json({
      user: {
        id: user.$id,
        email: user.email,
        name: user.name,
        createdAt: user.$createdAt,
      },
    });
  } catch (error) {
    if (error.code === 404) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(error.code || 500).json({ error: error.message || "Failed to fetch user profile" });
  }
});

module.exports = router;
