const express = require("express");

const authMiddleware = require("../../common/middleware/auth.middleware");
const requireRole = require("../../common/middleware/requireRole");
const validate = require("../../common/middleware/validate.middleware");
const asyncHandler = require("../../common/utils/asyncHandler");
const { ROLES } = require("../../common/constants/roles");

const {
  createDevice,
  listDevices,
  getDeviceById,
  updateDevice,
  updateDeviceStatus,
  updateDeviceLiveState
} = require("./device.controller");

const {
  createDeviceValidation,
  updateDeviceValidation,
  deviceIdValidation,
  updateDeviceStatusValidation,
  updateDeviceLiveStateValidation,
  listDevicesValidation
} = require("./device.validation");

const router = express.Router();

// Base path: /api/v1/devices

router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN),
  validate(createDeviceValidation),
  asyncHandler(createDevice)
);

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

router.patch(
  "/:deviceId",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN),
  validate(updateDeviceValidation),
  asyncHandler(updateDevice)
);

router.patch(
  "/:deviceId/status",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN),
  validate(updateDeviceStatusValidation),
  asyncHandler(updateDeviceStatus)
);

router.patch(
  "/:deviceId/live-state",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN, ROLES.CUSTOMER_CONTROL_USER),
  validate(updateDeviceLiveStateValidation),
  asyncHandler(updateDeviceLiveState)
);

module.exports = router;
