const express = require("express");
const filesController = require("./files.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const { validateParams } = require("../../middlewares/validate.middleware");
const { fileIdParamSchema } = require("../../validators/file.validator");

const router = express.Router();

router.get("/", authMiddleware, filesController.listFiles);
router.get("/:id", authMiddleware, validateParams(fileIdParamSchema), filesController.downloadFile);

module.exports = router;
