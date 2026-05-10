const express = require("express");

const authMiddleware = require("../../common/middleware/auth.middleware");
const requireRole = require("../../common/middleware/requireRole");
const asyncHandler = require("../../common/utils/asyncHandler");

const {
  listUsers,
  getUserById,
  verifyUser,
  updateUserRole,
  updateUserStatus
} = require("./user.controller");

const router = express.Router();

// ==========================
// USERS ROUTES
// Base path: /api/v1/users
// Access: super_admin only
// ==========================

router.get(
  "/",
  authMiddleware,
  requireRole("super_admin"),
  asyncHandler(listUsers)
);

router.get(
  "/:userId",
  authMiddleware,
  requireRole("super_admin"),
  asyncHandler(getUserById)
);

router.patch(
  "/:userId/verify",
  authMiddleware,
  requireRole("super_admin"),
  asyncHandler(verifyUser)
);

router.patch(
  "/:userId/role",
  authMiddleware,
  requireRole("super_admin"),
  asyncHandler(updateUserRole)
);

router.patch(
  "/:userId/status",
  authMiddleware,
  requireRole("super_admin"),
  asyncHandler(updateUserStatus)
);

module.exports = router;