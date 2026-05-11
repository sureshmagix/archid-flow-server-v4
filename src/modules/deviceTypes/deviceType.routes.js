const express = require("express");
const { validationResult } = require("express-validator");

const authMiddlewareModule = require("../../common/middleware/auth.middleware");

const {
  createDeviceType,
  getDeviceTypes,
  getDeviceTypeById,
  updateDeviceType,
  updateDeviceTypeStatus
} = require("./deviceType.controller");

const {
  createDeviceTypeValidation,
  updateDeviceTypeValidation,
  getDeviceTypeByIdValidation,
  updateDeviceTypeStatusValidation,
  listDeviceTypesValidation
} = require("./deviceType.validation");

const router = express.Router();

const authenticate =
  authMiddlewareModule.authenticate ||
  authMiddlewareModule.protect ||
  authMiddlewareModule.auth ||
  authMiddlewareModule.authMiddleware ||
  authMiddlewareModule;

const SUPER_ADMIN = "super_admin";

// ==========================
// LOCAL VALIDATION HANDLER
// ==========================
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array()
    });
  }

  return next();
};

// ==========================
// LOCAL SUPER ADMIN CHECK
// ==========================
const requireSuperAdmin = (req, res, next) => {
  const userRole =
    req.user?.role ||
    req.user?.profile?.role ||
    req.user?.user?.role;

  const userRoles =
    req.user?.roles ||
    req.user?.profile?.roles ||
    req.user?.user?.roles ||
    [];

  const hasSuperAdminRole =
    userRole === SUPER_ADMIN ||
    (Array.isArray(userRoles) && userRoles.includes(SUPER_ADMIN));

  if (!hasSuperAdminRole) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Super admin role required."
    });
  }

  return next();
};

// ==========================
// DEVICE TYPE ROUTES
// ==========================

// POST /api/v1/device-types
router.post(
  "/",
  authenticate,
  requireSuperAdmin,
  createDeviceTypeValidation,
  handleValidation,
  createDeviceType
);

// GET /api/v1/device-types
router.get(
  "/",
  authenticate,
  listDeviceTypesValidation,
  handleValidation,
  getDeviceTypes
);

// GET /api/v1/device-types/:deviceTypeId
router.get(
  "/:deviceTypeId",
  authenticate,
  getDeviceTypeByIdValidation,
  handleValidation,
  getDeviceTypeById
);

// PATCH /api/v1/device-types/:deviceTypeId
router.patch(
  "/:deviceTypeId",
  authenticate,
  requireSuperAdmin,
  updateDeviceTypeValidation,
  handleValidation,
  updateDeviceType
);

// PATCH /api/v1/device-types/:deviceTypeId/status
router.patch(
  "/:deviceTypeId/status",
  authenticate,
  requireSuperAdmin,
  updateDeviceTypeStatusValidation,
  handleValidation,
  updateDeviceTypeStatus
);

module.exports = router;