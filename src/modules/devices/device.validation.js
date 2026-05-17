const { body, param, query } = require("express-validator");

const {
  DEVICE_OPERATIONAL_STATUSES,
  DEVICE_CONNECTION_STATUSES,
  DEVICE_PROVISIONING_STATUSES
} = require("./device.model");

const codeRegex = /^[A-Za-z0-9_-]+$/;

const mongoIdOptional = field =>
  body(field)
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage(`${field} must be a valid MongoDB ObjectId`);

const createDeviceValidation = [
  mongoIdOptional("company"),
  mongoIdOptional("site"),

  body("deviceType")
    .notEmpty()
    .withMessage("deviceType is required")
    .isMongoId()
    .withMessage("deviceType must be a valid MongoDB ObjectId"),

  mongoIdOptional("owner"),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Device name is required")
    .isLength({ min: 2, max: 120 })
    .withMessage("Device name must be between 2 and 120 characters"),

  body("deviceCode")
    .trim()
    .notEmpty()
    .withMessage("deviceCode is required")
    .isLength({ min: 2, max: 60 })
    .withMessage("deviceCode must be between 2 and 60 characters")
    .matches(codeRegex)
    .withMessage("deviceCode can contain only letters, numbers, underscore, and hyphen"),

  body("hardwareId")
    .trim()
    .notEmpty()
    .withMessage("hardwareId is required")
    .isLength({ min: 2, max: 120 })
    .withMessage("hardwareId must be between 2 and 120 characters")
    .matches(codeRegex)
    .withMessage("hardwareId can contain only letters, numbers, underscore, and hyphen"),

  body("serialNumber")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("serialNumber must be a string"),

  body("macAddress")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("macAddress must be a string"),

  body("firmwareVersion")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("firmwareVersion must be a string"),

  body("mqttTopicBase")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("mqttTopicBase must be a string"),

  body("provisioningStatus")
    .optional()
    .isIn(DEVICE_PROVISIONING_STATUSES)
    .withMessage(`provisioningStatus must be one of: ${DEVICE_PROVISIONING_STATUSES.join(", ")}`),

  body("operationalStatus")
    .optional()
    .isIn(DEVICE_OPERATIONAL_STATUSES)
    .withMessage(`operationalStatus must be one of: ${DEVICE_OPERATIONAL_STATUSES.join(", ")}`),

  body("connectionStatus")
    .optional()
    .isIn(DEVICE_CONNECTION_STATUSES)
    .withMessage(`connectionStatus must be one of: ${DEVICE_CONNECTION_STATUSES.join(", ")}`),

  body("liveState")
    .optional()
    .isObject()
    .withMessage("liveState must be an object"),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("metadata must be an object"),

  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("notes must be a string")
];

const updateDeviceValidation = [
  param("deviceId")
    .isMongoId()
    .withMessage("Invalid device ID"),

  mongoIdOptional("company"),
  mongoIdOptional("site"),
  mongoIdOptional("deviceType"),
  mongoIdOptional("owner"),

  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Device name must be between 2 and 120 characters"),

  body("deviceCode")
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage("deviceCode must be between 2 and 60 characters")
    .matches(codeRegex)
    .withMessage("deviceCode can contain only letters, numbers, underscore, and hyphen"),

  body("hardwareId")
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("hardwareId must be between 2 and 120 characters")
    .matches(codeRegex)
    .withMessage("hardwareId can contain only letters, numbers, underscore, and hyphen"),

  body("provisioningStatus")
    .optional()
    .isIn(DEVICE_PROVISIONING_STATUSES)
    .withMessage(`provisioningStatus must be one of: ${DEVICE_PROVISIONING_STATUSES.join(", ")}`),

  body("serialNumber")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("serialNumber must be a string"),

  body("macAddress")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("macAddress must be a string"),

  body("firmwareVersion")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("firmwareVersion must be a string"),

  body("mqttTopicBase")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("mqttTopicBase must be a string"),

  body("liveState")
    .optional()
    .isObject()
    .withMessage("liveState must be an object"),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("metadata must be an object"),

  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("notes must be a string")
];

const deviceIdValidation = [
  param("deviceId")
    .isMongoId()
    .withMessage("Invalid device ID")
];

const updateDeviceStatusValidation = [
  param("deviceId")
    .isMongoId()
    .withMessage("Invalid device ID"),

  body("operationalStatus")
    .notEmpty()
    .withMessage("operationalStatus is required")
    .isIn(DEVICE_OPERATIONAL_STATUSES)
    .withMessage(`operationalStatus must be one of: ${DEVICE_OPERATIONAL_STATUSES.join(", ")}`)
];

const updateDeviceLiveStateValidation = [
  param("deviceId")
    .isMongoId()
    .withMessage("Invalid device ID"),

  body("connectionStatus")
    .optional()
    .isIn(DEVICE_CONNECTION_STATUSES)
    .withMessage(`connectionStatus must be one of: ${DEVICE_CONNECTION_STATUSES.join(", ")}`),

  body("liveState")
    .optional()
    .isObject()
    .withMessage("liveState must be an object"),

  body("lastSeenAt")
    .optional()
    .isISO8601()
    .withMessage("lastSeenAt must be a valid ISO date"),

  body("lastHeartbeatAt")
    .optional()
    .isISO8601()
    .withMessage("lastHeartbeatAt must be a valid ISO date")
];

const listDevicesValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive number"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),

  query("company")
    .optional()
    .isMongoId()
    .withMessage("Invalid company ID"),

  query("site")
    .optional()
    .isMongoId()
    .withMessage("Invalid site ID"),

  query("deviceType")
    .optional()
    .isMongoId()
    .withMessage("Invalid deviceType ID"),

  query("owner")
    .optional()
    .isMongoId()
    .withMessage("Invalid owner ID"),

  query("operationalStatus")
    .optional()
    .isIn(DEVICE_OPERATIONAL_STATUSES)
    .withMessage(`operationalStatus must be one of: ${DEVICE_OPERATIONAL_STATUSES.join(", ")}`),

  query("connectionStatus")
    .optional()
    .isIn(DEVICE_CONNECTION_STATUSES)
    .withMessage(`connectionStatus must be one of: ${DEVICE_CONNECTION_STATUSES.join(", ")}`),

  query("provisioningStatus")
    .optional()
    .isIn(DEVICE_PROVISIONING_STATUSES)
    .withMessage(`provisioningStatus must be one of: ${DEVICE_PROVISIONING_STATUSES.join(", ")}`),

  query("q")
    .optional()
    .isString()
    .withMessage("q must be a string")
];

module.exports = {
  createDeviceValidation,
  updateDeviceValidation,
  deviceIdValidation,
  updateDeviceStatusValidation,
  updateDeviceLiveStateValidation,
  listDevicesValidation
};
