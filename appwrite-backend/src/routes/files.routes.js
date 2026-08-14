const express = require("express");
const sdk = require("node-appwrite");
const {
  databases: adminDatabases,
  storage,
  createSessionClient,
  Query,
  DATABASE_ID,
  FILES_COLLECTION_ID,
  STORAGE_BUCKET_ID,
} = require("../config/appwriteClient");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

// GET /api/files
router.get("/", authMiddleware, async (req, res) => {
  try {
    const sessionClient = createSessionClient(req.appwriteSession);
    const sessionDatabases = new sdk.Databases(sessionClient);

    const response = await sessionDatabases.listDocuments(DATABASE_ID, FILES_COLLECTION_ID, [
      Query.equal("userId", req.user.id),
    ]);

    const files = response.documents.map((doc) => ({
      id: doc.$id,
      filename: doc.filename,
      createdAt: doc.$createdAt,
    }));

    res.status(200).json({ files });
  } catch (error) {
    res.status(error.code || 500).json({ error: error.message || "Failed to list files" });
  }
});

// GET /api/files/:id
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const sessionClient = createSessionClient(req.appwriteSession);
    const sessionDatabases = new sdk.Databases(sessionClient);

    let fileDoc;
    try {
      fileDoc = await sessionDatabases.getDocument(DATABASE_ID, FILES_COLLECTION_ID, req.params.id);
    } catch (sessionErr) {
      // Appwrite session client rejected request (permission denied or not found).
      // Query with admin client strictly to check if the file exists in DB to return 403 vs 404.
      try {
        const adminDoc = await adminDatabases.getDocument(DATABASE_ID, FILES_COLLECTION_ID, req.params.id);
        if (adminDoc) {
          return res.status(403).json({ error: "Access denied: You do not have permission to access this file" });
        }
      } catch (adminErr) {
        return res.status(404).json({ error: "File not found" });
      }
      return res.status(404).json({ error: "File not found" });
    }

    if (!fileDoc) {
      return res.status(404).json({ error: "File not found" });
    }

    // Defense-in-depth application ownership check
    if (fileDoc.userId !== req.user.id) {
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
