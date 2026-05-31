const { body, param, query } = require("express-validator");

const {
  DEVICE_PROTOCOLS,
  DEVICE_CONNECTIVITY_TYPES,
  DEVICE_OPERATIONAL_STATUSES,
  DEVICE_CONNECTION_STATUSES,
  DEVICE_PROVISIONING_STATUSES,
  DEVICE_WIFI_STATUSES,
  DEVICE_QC_STATUSES
} = require("./device.model");

const codeRegex = /^[A-Za-z0-9_-]+$/;

const mongoIdOptional = field =>
  body(field)
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage(`${field} must be a valid MongoDB ObjectId`);

const deviceIdParam = [
  param("deviceId")
    .isMongoId()
    .withMessage("Invalid device ID")
];

const preRegisterDeviceValidation = [
  body("deviceType")
    .notEmpty()
    .withMessage("deviceType is required")
    .isMongoId()
    .withMessage("deviceType must be a valid MongoDB ObjectId"),

  body("hardwareId")
    .trim()
    .notEmpty()
    .withMessage("hardwareId is required")
    .isLength({ min: 2, max: 120 })
    .withMessage("hardwareId must be between 2 and 120 characters")
    .matches(codeRegex)
    .withMessage("hardwareId can contain only letters, numbers, underscore, and hyphen"),

  body("claimCode")
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ min: 4, max: 12 })
    .withMessage("claimCode must be between 4 and 12 characters")
    .matches(/^[0-9]+$/)
    .withMessage("claimCode must contain only numbers"),

  body("name")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("name must be a string"),

  body("serialNumber")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("serialNumber must be a string"),

  body("macAddress")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("macAddress must be a string"),

  body("batchNumber")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("batchNumber must be a string"),

  body("firmwareVersion")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("firmwareVersion must be a string"),

  body("protocol")
    .optional()
    .isIn(DEVICE_PROTOCOLS)
    .withMessage(`protocol must be one of: ${DEVICE_PROTOCOLS.join(", ")}`),

  body("connectivity")
    .optional()
    .isIn(DEVICE_CONNECTIVITY_TYPES)
    .withMessage(`connectivity must be one of: ${DEVICE_CONNECTIVITY_TYPES.join(", ")}`),

  body("mqttTopicBase")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("mqttTopicBase must be a string"),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("metadata must be an object"),

  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("notes must be a string")
];

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

  body("displayName")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("displayName must be a string"),

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

  body("batchNumber")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("batchNumber must be a string"),

  body("firmwareVersion")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("firmwareVersion must be a string"),

  body("protocol")
    .optional()
    .isIn(DEVICE_PROTOCOLS)
    .withMessage(`protocol must be one of: ${DEVICE_PROTOCOLS.join(", ")}`),

  body("connectivity")
    .optional()
    .isIn(DEVICE_CONNECTIVITY_TYPES)
    .withMessage(`connectivity must be one of: ${DEVICE_CONNECTIVITY_TYPES.join(", ")}`),

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

  body("wifiStatus")
    .optional()
    .isIn(DEVICE_WIFI_STATUSES)
    .withMessage(`wifiStatus must be one of: ${DEVICE_WIFI_STATUSES.join(", ")}`),

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

  body("displayName")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("displayName must be a string"),

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

  body("serialNumber")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("serialNumber must be a string"),

  body("macAddress")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("macAddress must be a string"),

  body("batchNumber")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("batchNumber must be a string"),

  body("firmwareVersion")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("firmwareVersion must be a string"),

  body("protocol")
    .optional()
    .isIn(DEVICE_PROTOCOLS)
    .withMessage(`protocol must be one of: ${DEVICE_PROTOCOLS.join(", ")}`),

  body("connectivity")
    .optional()
    .isIn(DEVICE_CONNECTIVITY_TYPES)
    .withMessage(`connectivity must be one of: ${DEVICE_CONNECTIVITY_TYPES.join(", ")}`),

  body("mqttTopicBase")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("mqttTopicBase must be a string"),

  body("provisioningStatus")
    .optional()
    .isIn(DEVICE_PROVISIONING_STATUSES)
    .withMessage(`provisioningStatus must be one of: ${DEVICE_PROVISIONING_STATUSES.join(", ")}`),

  body("installationLocation")
    .optional()
    .isObject()
    .withMessage("installationLocation must be an object"),

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

const startDeviceQcValidation = [
  ...deviceIdParam
];

const recordDeviceQcResultValidation = [
  param("deviceId")
    .isMongoId()
    .withMessage("Invalid device ID"),

  body("qcStatus")
    .notEmpty()
    .withMessage("qcStatus is required")
    .isIn(DEVICE_QC_STATUSES)
    .withMessage(`qcStatus must be one of: ${DEVICE_QC_STATUSES.join(", ")}`),

  body("firmwareVersionTested")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("firmwareVersionTested must be a string"),

  body("mqttConnected")
    .optional()
    .isBoolean()
    .withMessage("mqttConnected must be boolean"),

  body("heartbeatReceived")
    .optional()
    .isBoolean()
    .withMessage("heartbeatReceived must be boolean"),

  body("commandAckReceived")
    .optional()
    .isBoolean()
    .withMessage("commandAckReceived must be boolean"),

  body("functionalTestPassed")
    .optional()
    .isBoolean()
    .withMessage("functionalTestPassed must be boolean"),

  body("remarks")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("remarks must be a string"),

  body("checklist")
    .optional()
    .isArray()
    .withMessage("checklist must be an array"),

  body("checklist.*.key")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("checklist key must be a string"),

  body("checklist.*.label")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("checklist label must be a string"),

  body("checklist.*.passed")
    .optional()
    .isBoolean()
    .withMessage("checklist passed must be boolean"),

  body("checklist.*.remarks")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("checklist remarks must be a string")
];

const resetDeviceToCustomerProvisioningValidation = [
  ...deviceIdParam
];

const claimDeviceValidation = [
  body("hardwareId")
    .trim()
    .notEmpty()
    .withMessage("hardwareId is required")
    .isLength({ min: 2, max: 120 })
    .withMessage("hardwareId must be between 2 and 120 characters")
    .matches(codeRegex)
    .withMessage("hardwareId can contain only letters, numbers, underscore, and hyphen"),

  body("claimCode")
    .trim()
    .notEmpty()
    .withMessage("claimCode is required"),

  body("site")
    .notEmpty()
    .withMessage("site is required")
    .isMongoId()
    .withMessage("site must be a valid MongoDB ObjectId"),

  body("displayName")
    .trim()
    .notEmpty()
    .withMessage("displayName is required")
    .isLength({ min: 2, max: 120 })
    .withMessage("displayName must be between 2 and 120 characters"),

  body("installationLocation")
    .optional()
    .isObject()
    .withMessage("installationLocation must be an object")
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

const updateDeviceConnectionValidation = [
  param("deviceId")
    .isMongoId()
    .withMessage("Invalid device ID"),

  body("connectionStatus")
    .optional()
    .isIn(DEVICE_CONNECTION_STATUSES)
    .withMessage(`connectionStatus must be one of: ${DEVICE_CONNECTION_STATUSES.join(", ")}`),

  body("wifiStatus")
    .optional()
    .isIn(DEVICE_WIFI_STATUSES)
    .withMessage(`wifiStatus must be one of: ${DEVICE_WIFI_STATUSES.join(", ")}`),

  body("wifiSsid")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("wifiSsid must be a string"),

  body("wifiRssi")
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .withMessage("wifiRssi must be a number"),

  body("firmwareVersion")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("firmwareVersion must be a string"),

  body("wifiFailureReason")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("wifiFailureReason must be a string"),

  body("heartbeatPayload")
    .optional()
    .isObject()
    .withMessage("heartbeatPayload must be an object")
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

  query("qcStatus")
    .optional()
    .isIn(DEVICE_QC_STATUSES)
    .withMessage(`qcStatus must be one of: ${DEVICE_QC_STATUSES.join(", ")}`),

  query("wifiStatus")
    .optional()
    .isIn(DEVICE_WIFI_STATUSES)
    .withMessage(`wifiStatus must be one of: ${DEVICE_WIFI_STATUSES.join(", ")}`),

  query("batchNumber")
    .optional()
    .isString()
    .withMessage("batchNumber must be a string"),

  query("q")
    .optional()
    .isString()
    .withMessage("q must be a string")
];

module.exports = {
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
};