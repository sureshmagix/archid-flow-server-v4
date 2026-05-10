const express = require("express");

const authController = require("./auth.controller");
const asyncHandler = require("../../common/utils/asyncHandler");
const validate = require("../../common/middleware/validate.middleware");
const authMiddleware = require("../../common/middleware/auth.middleware");

const {
  signupValidator,
  loginValidator
} = require("./auth.validator");

const router = express.Router();

// ==========================
// AUTH ROUTES
// Base URL: /api/v1/auth
// ==========================

// POST /api/v1/auth/signup
router.post(
  "/signup",
  validate(signupValidator),
  asyncHandler(authController.signup)
);

// POST /api/v1/auth/login
router.post(
  "/login",
  validate(loginValidator),
  asyncHandler(authController.login)
);

// GET /api/v1/auth/me
router.get(
  "/me",
  authMiddleware,
  asyncHandler(authController.getMe)
);

module.exports = router;