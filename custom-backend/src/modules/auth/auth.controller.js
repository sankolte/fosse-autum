const asyncHandler = require("../../utils/asyncHandler");
const authService = require("./auth.service");

const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  const result = await authService.register(email, password, name);
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.cookie("token", result.token, {
    httpOnly: true,
    sameSite: "lax",
  });
  res.status(200).json(result);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.jti, req.user.exp);
  res.clearCookie("token");
  res.status(200).json({ message: "Successfully logged out" });
});

module.exports = {
  register,
  login,
  logout,
};
