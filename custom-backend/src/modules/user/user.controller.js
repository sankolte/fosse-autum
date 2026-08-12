const asyncHandler = require("../../utils/asyncHandler");
const userService = require("./user.service");

const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getUserProfile(req.user.userId);
  res.status(200).json({ user });
});

module.exports = {
  getMe,
};
