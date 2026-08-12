const express = require("express");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

// GET /api/user/me
router.get("/me", authMiddleware, async (req, res) => {
  res.status(200).json({
    user: req.user,
  });
});

module.exports = router;
