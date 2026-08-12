const asyncHandler = require("../../utils/asyncHandler");
const filesService = require("./files.service");

const listFiles = asyncHandler(async (req, res) => {
  const files = await filesService.getFilesForUser(req.user.userId);
  res.status(200).json({ files });
});

const downloadFile = asyncHandler(async (req, res) => {
  const { file, absolutePath } = await filesService.getFileById(req.params.id, req.user.userId);
  res.sendFile(absolutePath);
});

module.exports = {
  listFiles,
  downloadFile,
};
