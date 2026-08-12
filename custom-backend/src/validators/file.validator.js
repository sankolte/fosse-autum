const { z } = require("zod");

const fileIdParamSchema = z.object({
  id: z.string().uuid("Invalid file ID format"),
});

module.exports = {
  fileIdParamSchema,
};
