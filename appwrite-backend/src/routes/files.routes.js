const express = require("express");
const {
  databases,
  storage,
  Query,
  DATABASE_ID,
  FILES_COLLECTION_ID,
  STORAGE_BUCKET_ID,
} = require("../config/appwriteClient");

const router = express.Router();

// Helper middleware to extract user from session token
const extractUser = (req, res, next) => {
  let token = req.headers.authorization
    ? req.headers.authorization.replace("Bearer ", "")
    : req.cookies.token;

  if (!token || !token.startsWith("appwrite-session-")) {
    return res.status(401).json({ error: "Authentication token missing or invalid" });
  }

  req.userId = token.replace("appwrite-session-", "");
  next();
};

// GET /api/files
router.get("/", extractUser, async (req, res) => {
  try {
    const response = await databases.listDocuments(DATABASE_ID, FILES_COLLECTION_ID, [
      Query.equal("userId", req.userId),
    ]);

    const files = response.documents.map((doc) => ({
      id: doc.$id,
      filename: doc.filename,
      path: doc.path,
      createdAt: doc.$createdAt,
    }));

    res.status(200).json({ files });
  } catch (error) {
    res.status(error.code || 500).json({ error: error.message || "Failed to list files" });
  }
});

// GET /api/files/:id
router.get("/:id", extractUser, async (req, res) => {
  try {
    const fileDoc = await databases.getDocument(DATABASE_ID, FILES_COLLECTION_ID, req.params.id);

    if (!fileDoc) {
      return res.status(404).json({ error: "File not found" });
    }

    // Broken Access Control (IDOR) Protection
    if (fileDoc.userId !== req.userId) {
      return res.status(403).json({ error: "Access denied: You do not have permission to access this file" });
    }

    const fileBuffer = await storage.getFileDownload(STORAGE_BUCKET_ID, fileDoc.path);
    res.setHeader("Content-Disposition", `attachment; filename="${fileDoc.filename}"`);
    res.send(fileBuffer);
  } catch (error) {
    if (error.code === 404) {
      return res.status(404).json({ error: "File not found" });
    }
    res.status(error.code || 500).json({ error: error.message || "Failed to download file" });
  }
});

module.exports = router;
