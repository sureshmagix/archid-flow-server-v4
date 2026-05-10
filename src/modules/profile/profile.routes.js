const express = require("express");

const authMiddleware = require("../../common/middleware/auth.middleware");
const asyncHandler = require("../../common/utils/asyncHandler");

const {
  getMyProfile,
  updateMyProfile
} = require("./profile.controller");

const router = express.Router();

// ==========================
// PROFILE ROUTES
// Base path: /api/v1/profile
// ==========================

router.get(
  "/",
  authMiddleware,
  asyncHandler(getMyProfile)
);

router.patch(
  "/",
  authMiddleware,
  asyncHandler(updateMyProfile)
);

module.exports = router;