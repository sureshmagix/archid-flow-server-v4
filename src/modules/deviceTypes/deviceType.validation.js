const { body, param, query } = require("express-validator");

const {
  DEVICE_TYPE_CATEGORIES,
  DEVICE_TYPE_PROTOCOLS,
  FIELD_DATA_TYPES
} = require("./deviceType.model");

const keyRegex = /^[a-z][a-z0-9_]*$/;

const capabilityValidation = (path) => [
  body(`${path}.*.key`)
    .optional()
    .trim()
    .matches(keyRegex)
    .withMessage("Capability key must start with a letter and contain only lowercase letters, numbers, and underscores"),

  body(`${path}.*.label`)
    .optional()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage("Capability label must be between 1 and 120 characters"),

  body(`${path}.*.dataType`)
    .optional()
    .isIn(FIELD_DATA_TYPES)
    .withMessage(`Capability dataType must be one of: ${FIELD_DATA_TYPES.join(", ")}`),

  body(`${path}.*.unit`)
    .optional({ nullable: true })
    .isString()
    .withMessage("Capability unit must be a string"),

  body(`${path}.*.min`)
    .optional({ nullable: true })
    .isNumeric()
    .withMessage("Capability min must be a number"),

  body(`${path}.*.max`)
    .optional({ nullable: true })
    .isNumeric()
    .withMessage("Capability max must be a number"),

  body(`${path}.*.enumValues`)
    .optional()
    .isArray()
    .withMessage("Capability enumValues must be an array"),

  body(`${path}.*.enumValues.*`)
    .optional()
    .isString()
    .withMessage("Capability enumValues must contain strings"),

  body(`${path}.*.readOnly`)
    .optional()
    .isBoolean()
    .withMessage("Capability readOnly must be boolean")
];

const commandValidation = (path) => [
  body(`${path}.*.command`)
    .optional()
    .trim()
    .matches(keyRegex)
    .withMessage("Command must start with a letter and contain only lowercase letters, numbers, and underscores"),

  body(`${path}.*.label`)
    .optional()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage("Command label must be between 1 and 120 characters"),

  body(`${path}.*.description`)
    .optional({ nullable: true })
    .isString()
    .withMessage("Command description must be a string"),

  body(`${path}.*.payloadSchema`)
    .optional()
    .isObject()
    .withMessage("Command payloadSchema must be an object")
];

const telemetryValidation = (path) => [
  body(`${path}.*.key`)
    .optional()
    .trim()
    .matches(keyRegex)
    .withMessage("Telemetry key must start with a letter and contain only lowercase letters, numbers, and underscores"),

  body(`${path}.*.label`)
    .optional()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage("Telemetry label must be between 1 and 120 characters"),

  body(`${path}.*.dataType`)
    .optional()
    .isIn(FIELD_DATA_TYPES)
    .withMessage(`Telemetry dataType must be one of: ${FIELD_DATA_TYPES.join(", ")}`),

  body(`${path}.*.unit`)
    .optional({ nullable: true })
    .isString()
    .withMessage("Telemetry unit must be a string")
];

const createDeviceTypeValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Device type name is required")
    .isLength({ min: 2, max: 120 })
    .withMessage("Device type name must be between 2 and 120 characters"),

  body("description")
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("category")
    .optional()
    .isIn(DEVICE_TYPE_CATEGORIES)
    .withMessage(`Category must be one of: ${DEVICE_TYPE_CATEGORIES.join(", ")}`),

  body("manufacturer")
    .optional({ nullable: true })
    .isString()
    .withMessage("Manufacturer must be a string"),

  body("model")
    .optional({ nullable: true })
    .isString()
    .withMessage("Model must be a string"),

  body("protocols")
    .optional()
    .isArray()
    .withMessage("Protocols must be an array"),

  body("protocols.*")
    .optional()
    .isIn(DEVICE_TYPE_PROTOCOLS)
    .withMessage(`Protocol must be one of: ${DEVICE_TYPE_PROTOCOLS.join(", ")}`),

  body("capabilities")
    .optional()
    .isArray()
    .withMessage("Capabilities must be an array"),

  ...capabilityValidation("capabilities"),

  body("commandSchema")
    .optional()
    .isArray()
    .withMessage("commandSchema must be an array"),

  ...commandValidation("commandSchema"),

  body("telemetrySchema")
    .optional()
    .isArray()
    .withMessage("telemetrySchema must be an array"),

  ...telemetryValidation("telemetrySchema"),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean")
];

const updateDeviceTypeValidation = [
  param("deviceTypeId")
    .isMongoId()
    .withMessage("Valid deviceTypeId is required"),

  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Device type name must be between 2 and 120 characters"),

  body("description")
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("category")
    .optional()
    .isIn(DEVICE_TYPE_CATEGORIES)
    .withMessage(`Category must be one of: ${DEVICE_TYPE_CATEGORIES.join(", ")}`),

  body("manufacturer")
    .optional({ nullable: true })
    .isString()
    .withMessage("Manufacturer must be a string"),

  body("model")
    .optional({ nullable: true })
    .isString()
    .withMessage("Model must be a string"),

  body("protocols")
    .optional()
    .isArray()
    .withMessage("Protocols must be an array"),

  body("protocols.*")
    .optional()
    .isIn(DEVICE_TYPE_PROTOCOLS)
    .withMessage(`Protocol must be one of: ${DEVICE_TYPE_PROTOCOLS.join(", ")}`),

  body("capabilities")
    .optional()
    .isArray()
    .withMessage("Capabilities must be an array"),

  ...capabilityValidation("capabilities"),

  body("commandSchema")
    .optional()
    .isArray()
    .withMessage("commandSchema must be an array"),

  ...commandValidation("commandSchema"),

  body("telemetrySchema")
    .optional()
    .isArray()
    .withMessage("telemetrySchema must be an array"),

  ...telemetryValidation("telemetrySchema"),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean")
];

const getDeviceTypeByIdValidation = [
  param("deviceTypeId")
    .isMongoId()
    .withMessage("Valid deviceTypeId is required")
];

const updateDeviceTypeStatusValidation = [
  param("deviceTypeId")
    .isMongoId()
    .withMessage("Valid deviceTypeId is required"),

  body("isActive")
    .isBoolean()
    .withMessage("isActive is required and must be boolean")
];

const listDeviceTypesValidation = [
  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string"),

  query("category")
    .optional()
    .isIn(DEVICE_TYPE_CATEGORIES)
    .withMessage(`Category must be one of: ${DEVICE_TYPE_CATEGORIES.join(", ")}`),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
];

module.exports = {
  createDeviceTypeValidation,
  updateDeviceTypeValidation,
  getDeviceTypeByIdValidation,
  updateDeviceTypeStatusValidation,
  listDeviceTypesValidation
};
