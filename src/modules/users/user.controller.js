const service = require("./user.service");
const sendResponse = require("../../common/utils/sendResponse");

exports.createUser = async (req, res) => sendResponse(res, 201, "User created successfully", {
  user: await service.createUser(req.body)
});
exports.listUsers = async (req, res) => sendResponse(res, 200, "Users fetched successfully",
  await service.listUsers(req.query, req.user));
exports.getUserById = async (req, res) => sendResponse(res, 200, "User fetched successfully", {
  user: await service.getUserById(req.params.userId)
});
exports.verifyUser = async (req, res) => sendResponse(res, 200, "User verification updated", {
  user: await service.verifyUser({ userId: req.params.userId, isVerified: req.body.isVerified,
    verifiedBy: req.user._id })
});
exports.updateUserRole = async (req, res) => sendResponse(res, 200, "User role updated successfully", {
  user: await service.updateUserRole({ userId: req.params.userId, role: req.body.role,
    company: req.body.company, authUserId: req.user._id })
});
exports.updateUserStatus = async (req, res) => sendResponse(res, 200, "User status updated successfully", {
  user: await service.updateUserStatus({ userId: req.params.userId, isActive: req.body.isActive,
    accountStatus: req.body.accountStatus, authUserId: req.user._id })
});
