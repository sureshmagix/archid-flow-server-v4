const { body, param, query } = require("express-validator");

const {
  DEVICE_SHARE_PERMISSION_LEVELS,
  DEVICE_SHARE_STATUSES
} = require("./deviceShare.model");

const normalizeLowercase = value => {
  if (value === undefined || value === null || value === "") {
    return value;
  }

  return String(value).trim().toLowerCase();
};

const shareIdValidation = [
  param("shareId")
    .isMongoId()
    .withMessage("Invalid share ID")
];

const createDeviceShareValidation = [
  body("device")
    .notEmpty()
    .withMessage("device is required")
    .isMongoId()
    .withMessage("device must be a valid MongoDB ObjectId"),

  body("sharedWith")
    .notEmpty()
    .withMessage("sharedWith is required")
    .isMongoId()
    .withMessage("sharedWith must be a valid MongoDB ObjectId"),

  body("permission")
    .notEmpty()
    .withMessage("permission is required")
    .customSanitizer(normalizeLowercase)
    .isIn(DEVICE_SHARE_PERMISSION_LEVELS)
    .withMessage(
      `permission must be one of: ${DEVICE_SHARE_PERMISSION_LEVELS.join(", ")}`
    ),

  body("expiresAt")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("expiresAt must be a valid ISO date")
    .custom(value => {
      if (new Date(value) <= new Date()) {
        throw new Error("expiresAt must be a future date");
      }

      return true;
    }),

  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("notes must be a string")
    .isLength({ max: 500 })
    .withMessage("notes cannot exceed 500 characters"),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("metadata must be an object")
];

const listDeviceSharesValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive number"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),

  query("device")
    .optional()
    .isMongoId()
    .withMessage("Invalid device ID"),

  query("company")
    .optional()
    .isMongoId()
    .withMessage("Invalid company ID"),

  query("sharedWith")
    .optional()
    .isMongoId()
    .withMessage("Invalid sharedWith user ID"),

  query("sharedBy")
    .optional()
    .isMongoId()
    .withMessage("Invalid sharedBy user ID"),

  query("permission")
    .optional()
    .customSanitizer(normalizeLowercase)
    .isIn(DEVICE_SHARE_PERMISSION_LEVELS)
    .withMessage(
      `permission must be one of: ${DEVICE_SHARE_PERMISSION_LEVELS.join(", ")}`
    ),

  query("status")
    .optional()
    .customSanitizer(normalizeLowercase)
    .isIn(DEVICE_SHARE_STATUSES)
    .withMessage(`status must be one of: ${DEVICE_SHARE_STATUSES.join(", ")}`),

  query("includeExpired")
    .optional()
    .isBoolean()
    .withMessage("includeExpired must be boolean"),

  query("q")
    .optional()
    .isString()
    .withMessage("q must be a string")
];

const getDeviceShareValidation = [
  ...shareIdValidation
];

const updateDeviceShareValidation = [
  param("shareId")
    .isMongoId()
    .withMessage("Invalid share ID"),

  body("permission")
    .optional()
    .customSanitizer(normalizeLowercase)
    .isIn(DEVICE_SHARE_PERMISSION_LEVELS)
    .withMessage(
      `permission must be one of: ${DEVICE_SHARE_PERMISSION_LEVELS.join(", ")}`
    ),

  body("status")
    .optional()
    .customSanitizer(normalizeLowercase)
    .isIn(DEVICE_SHARE_STATUSES)
    .withMessage(`status must be one of: ${DEVICE_SHARE_STATUSES.join(", ")}`),

  body("expiresAt")
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage("expiresAt must be a valid ISO date")
    .custom(value => {
      if (new Date(value) <= new Date()) {
        throw new Error("expiresAt must be a future date");
      }

      return true;
    }),

  body("revokeReason")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("revokeReason must be a string")
    .isLength({ max: 300 })
    .withMessage("revokeReason cannot exceed 300 characters"),

  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("notes must be a string")
    .isLength({ max: 500 })
    .withMessage("notes cannot exceed 500 characters"),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("metadata must be an object")
];

const deleteDeviceShareValidation = [
  param("shareId")
    .isMongoId()
    .withMessage("Invalid share ID"),

  body("revokeReason")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage("revokeReason must be a string")
    .isLength({ max: 300 })
    .withMessage("revokeReason cannot exceed 300 characters")
];

module.exports = {
  createDeviceShareValidation,
  listDeviceSharesValidation,
  getDeviceShareValidation,
  updateDeviceShareValidation,
  deleteDeviceShareValidation,

  // Exported for route/controller compatibility.
  shareIdValidation
};
