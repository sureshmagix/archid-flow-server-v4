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
// PHASE 06 - FACTORY PRE-REGISTRATION
// ==========================
// Super admin / factory creates an unclaimed device.
// Customer/company/site/owner are NOT assigned here.
router.post(
  "/pre-register",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN),
  validate(preRegisterDeviceValidation),
  asyncHandler(preRegisterDevice)
);

// ==========================
// PHASE 06 - DIRECT DEVICE CREATE
// ==========================
// Optional admin/customer create route.
// Keep this only for internal/admin use.
// Customer-friendly flow should use /claim.
router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN),
  validate(createDeviceValidation),
  asyncHandler(createDevice)
);

// ==========================
// PHASE 06 - CUSTOMER CLAIM
// ==========================
// Customer claims a pre-registered and QC-passed device.
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
// DEVICE DETAILS
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
// ==========================
router.patch(
  "/:deviceId",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN),
  validate(updateDeviceValidation),
  asyncHandler(updateDevice)
);

// ==========================
// OPERATIONAL STATUS UPDATE
// ==========================
router.patch(
  "/:deviceId/status",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN),
  validate(updateDeviceStatusValidation),
  asyncHandler(updateDeviceStatus)
);

// ==========================
// QUALITY CHECK - START
// ==========================
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
// Used after QC pass before packing/dispatch.
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
// Temporary Postman/testing route.
// Later MQTT listener should update this automatically.
router.patch(
  "/:deviceId/connection",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER
  ),
  validate(updateDeviceConnectionValidation),
  asyncHandler(updateDeviceConnection)
);

// ==========================
// LIVE STATE UPDATE
// ==========================
// Temporary Postman/testing route.
// Later MQTT listener should update this automatically.
router.patch(
  "/:deviceId/live-state",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER
  ),
  validate(updateDeviceLiveStateValidation),
  asyncHandler(updateDeviceLiveState)
);

module.exports = router;