const express = require("express");

const authMiddleware = require("../../common/middleware/auth.middleware");
const requireRole = require("../../common/middleware/requireRole");
const validate = require("../../common/middleware/validate.middleware");
const asyncHandler = require("../../common/utils/asyncHandler");
const { ROLES } = require("../../common/constants/roles");

const {
  preRegisterDevice,
  createDevice,
  listDevices,
  getDeviceById,
  updateDevice,
  updateDeviceStatus,
  startDeviceQc,
  recordDeviceQcResult,
  resetDeviceToCustomerProvisioning,
  claimDevice,
  updateDeviceLiveState,
  updateDeviceConnection
} = require("./device.controller");

const {
  preRegisterDeviceValidation,
  createDeviceValidation,
  updateDeviceValidation,
  deviceIdValidation,
  updateDeviceStatusValidation,
  startDeviceQcValidation,
  recordDeviceQcResultValidation,
  resetDeviceToCustomerProvisioningValidation,
  claimDeviceValidation,
  updateDeviceLiveStateValidation,
  updateDeviceConnectionValidation,
  listDevicesValidation
} = require("./device.validation");

const router = express.Router();

// Base path: /api/v1/devices

// ==========================
// PHASE 07 / COMPATIBILITY - FACTORY PRE-REGISTRATION
// ==========================
// Old compatibility route.
// Preferred Phase 07 route:
// POST /api/v1/provisioning/factory-register
router.post(
  "/pre-register",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN),
  validate(preRegisterDeviceValidation),
  asyncHandler(preRegisterDevice)
);

// ==========================
// DIRECT DEVICE CREATE
// ==========================
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN),
  validate(createDeviceValidation),
  asyncHandler(createDevice)
);

// ==========================
// PHASE 07 / COMPATIBILITY - CUSTOMER CLAIM
// ==========================
// Old compatibility route.
// Preferred Phase 07 route:
// POST /api/v1/provisioning/claim
router.post(
  "/claim",
  authMiddleware,
  requireRole(ROLES.CUSTOMER_ADMIN),
  validate(claimDeviceValidation),
  asyncHandler(claimDevice)
);

// ==========================
// DEVICE LIST
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
  validate(listDevicesValidation),
  asyncHandler(listDevices)
);

// ==========================
// QUALITY CHECK - START
// ==========================
// Old compatibility route.
// Preferred Phase 07 route:
// POST /api/v1/provisioning/devices/:deviceId/qc/start
router.post(
  "/:deviceId/qc/start",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN),
  validate(startDeviceQcValidation),
  asyncHandler(startDeviceQc)
);

// ==========================
// QUALITY CHECK - RESULT
// ==========================
// Old compatibility route.
// Preferred Phase 07 route:
// POST /api/v1/provisioning/devices/:deviceId/qc/result
router.post(
  "/:deviceId/qc/result",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN),
  validate(recordDeviceQcResultValidation),
  asyncHandler(recordDeviceQcResult)
);

// ==========================
// RESET TO CUSTOMER PROVISIONING MODE
// ==========================
// Old compatibility route.
// Preferred Phase 07 route:
// PATCH /api/v1/provisioning/devices/:deviceId/reset-customer-provisioning
router.patch(
  "/:deviceId/reset-customer-provisioning",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN),
  validate(resetDeviceToCustomerProvisioningValidation),
  asyncHandler(resetDeviceToCustomerProvisioning)
);

// ==========================
// CONNECTION STATUS UPDATE
// ==========================
// Controller enforces Phase 08 device sharing permission:
// - super_admin and customer_admin can update
// - users with active control/admin share can update
router.patch(
  "/:deviceId/connection",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),
  validate(updateDeviceConnectionValidation),
  asyncHandler(updateDeviceConnection)
);

// ==========================
// LIVE STATE UPDATE
// ==========================
// Controller enforces Phase 08 device sharing permission:
// - super_admin and customer_admin can update
// - users with active control/admin share can update
router.patch(
  "/:deviceId/live-state",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),
  validate(updateDeviceLiveStateValidation),
  asyncHandler(updateDeviceLiveState)
);

// ==========================
// OPERATIONAL STATUS UPDATE
// ==========================
// Controller enforces Phase 08 admin permission.
router.patch(
  "/:deviceId/status",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),
  validate(updateDeviceStatusValidation),
  asyncHandler(updateDeviceStatus)
);

// ==========================
// DEVICE DETAILS
// Keep this after specific routes like /connection, /status, /live-state.
// ==========================
router.get(
  "/:deviceId",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),
  validate(deviceIdValidation),
  asyncHandler(getDeviceById)
);

// ==========================
// DEVICE UPDATE
// Keep this after specific PATCH routes.
// ==========================
// Controller enforces Phase 08 admin permission.
router.patch(
  "/:deviceId",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),
  validate(updateDeviceValidation),
  asyncHandler(updateDevice)
);

module.exports = router;