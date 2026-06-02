const express = require("express");

const authMiddleware = require("../../common/middleware/auth.middleware");
const requireRole = require("../../common/middleware/requireRole");
const validate = require("../../common/middleware/validate.middleware");
const asyncHandler = require("../../common/utils/asyncHandler");
const { ROLES } = require("../../common/constants/roles");

const {
  createDeviceShare,
  listDeviceShares,
  getDeviceShareById,
  updateDeviceShare,
  deleteDeviceShare
} = require("./deviceShare.controller");

const {
  createDeviceShareValidation,
  listDeviceSharesValidation,
  getDeviceShareValidation,
  updateDeviceShareValidation,
  deleteDeviceShareValidation
} = require("./deviceShare.validation");

const router = express.Router();

// Base path: /api/v1/device-sharing

// ==========================
// CREATE DEVICE SHARE
// ==========================
// Allowed into controller:
// - super_admin
// - customer_admin
// - customer users with admin share permission
//
// Controller enforces actual permission.
router.post(
  "/",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),
  validate(createDeviceShareValidation),
  asyncHandler(createDeviceShare)
);

// ==========================
// LIST DEVICE SHARES
// ==========================
router.get(
  "/",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),
  validate(listDeviceSharesValidation),
  asyncHandler(listDeviceShares)
);

// ==========================
// GET DEVICE SHARE DETAILS
// ==========================
router.get(
  "/:shareId",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),
  validate(getDeviceShareValidation),
  asyncHandler(getDeviceShareById)
);

// ==========================
// UPDATE DEVICE SHARE
// ==========================
// Controller enforces:
// - super_admin can update any share
// - customer_admin can update own-company device shares
// - user with active admin share can manage sharing for that device
router.patch(
  "/:shareId",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),
  validate(updateDeviceShareValidation),
  asyncHandler(updateDeviceShare)
);

// ==========================
// DELETE / REVOKE DEVICE SHARE
// ==========================
// This does not hard-delete the record.
// It changes status to revoked.
router.delete(
  "/:shareId",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),
  validate(deleteDeviceShareValidation),
  asyncHandler(deleteDeviceShare)
);

module.exports = router;
