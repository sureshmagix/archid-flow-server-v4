const { param, query } = require("express-validator");

const claimPreviewValidation = [
  query("hardwareId")
    .trim()
    .notEmpty()
    .withMessage("hardwareId is required")
    .isLength({ min: 2, max: 120 })
    .withMessage("hardwareId must be between 2 and 120 characters")
];

const activateProvisionedDeviceValidation = [
  param("deviceId")
    .isMongoId()
    .withMessage("Invalid device ID")
];

module.exports = {
  claimPreviewValidation,
  activateProvisionedDeviceValidation
};
