const path = require("path");
const fs = require("fs");
const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");

/**
 * Retrieves all files belonging to a specific user.
 * @param {string} userId
 */
const getFilesForUser = async (userId) => {
  return await prisma.file.findMany({
    where: { userId },
    select: {
      id: true,
      filename: true,
      path: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Retrieves a single file by ID and enforces strict multi-tenant ownership check (IDOR Defense).
 * @param {string} fileId
 * @param {string} requestingUserId
 */
const getFileById = async (fileId, requestingUserId) => {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    throw new AppError("File not found", 404);
  }

  // Broken Access Control (IDOR) Protection
  if (file.userId !== requestingUserId) {
    throw new AppError("Access denied: You do not have permission to access this file", 403);
  }

  const absolutePath = path.isAbsolute(file.path)
    ? file.path
    : path.resolve(__dirname, "../../..", file.path);

  if (!fs.existsSync(absolutePath)) {
    throw new AppError("File content not found on server", 404);
  }

  return { file, absolutePath };
};

module.exports = {
  getFilesForUser,
  getFileById,
};
