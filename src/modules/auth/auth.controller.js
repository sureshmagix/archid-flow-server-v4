const authService = require("./auth.service");
const sendResponse = require("../../common/utils/sendResponse");

const signup = async (req, res) => {
  const user = await authService.signup(req.body);

  return sendResponse(res, 201, "User registered successfully", {
    user
  });
};

const login = async (req, res) => {
  const result = await authService.login(req.body);

  return sendResponse(res, 200, "Login successful", result);
};

const getMe = async (req, res) => {
  const user = await authService.getCurrentUser(req.user._id);

  return sendResponse(res, 200, "Current user fetched successfully", {
    user
  });
};

module.exports = {
  signup,
  login,
  getMe
};
