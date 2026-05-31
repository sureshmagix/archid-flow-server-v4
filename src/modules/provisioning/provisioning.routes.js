const express = require("express");

const authMiddleware = require("../../common/middleware/auth.middleware");
const requireRole = require("../../common/middleware/requireRole");
const validate = require("../../common/middleware/validate.middleware");
const asyncHandler = require("../../common/utils/asyncHandler");
const { ROLES } = require("../../common/constants/roles");

const {
  preRegisterDevice,
  startDeviceQc,
  recordDeviceQcResult,
  resetDeviceToCustomerProvisioning,
  claimDevice
} = require("../devices/device.controller");

const {
  preRegisterDeviceValidation,
  startDeviceQcValidation,
  recordDeviceQcResultValidation,
  resetDeviceToCustomerProvisioningValidation,
  claimDeviceValidation
} = require("../devices/device.validation");

const {
  getClaimPreview,
  activateProvisionedDevice
} = require("./provisioning.controller");

const {
  claimPreviewValidation,
  activateProvisionedDeviceValidation
} = require("./provisioning.validation");

const router = express.Router();

router.post(
  "/factory-register",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN),
  validate(preRegisterDeviceValidation),
  asyncHandler(preRegisterDevice)
);

router.post(
  "/devices/:deviceId/qc/start",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN),
  validate(startDeviceQcValidation),
  asyncHandler(startDeviceQc)
);

router.post(
  "/devices/:deviceId/qc/result",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN),
  validate(recordDeviceQcResultValidation),
  asyncHandler(recordDeviceQcResult)
);

router.patch(
  "/devices/:deviceId/reset-customer-provisioning",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN),
  validate(resetDeviceToCustomerProvisioningValidation),
  asyncHandler(resetDeviceToCustomerProvisioning)
);

router.get(
  "/claim-preview",
  authMiddleware,
  requireRole(ROLES.CUSTOMER_ADMIN, ROLES.CUSTOMER_CONTROL_USER),
  validate(claimPreviewValidation),
  asyncHandler(getClaimPreview)
);

router.post(
  "/claim",
  authMiddleware,
  requireRole(ROLES.CUSTOMER_ADMIN),
  validate(claimDeviceValidation),
  asyncHandler(claimDevice)
);

router.patch(
  "/devices/:deviceId/activate",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN),
  validate(activateProvisionedDeviceValidation),
  asyncHandler(activateProvisionedDevice)
);

module.exports = router;
