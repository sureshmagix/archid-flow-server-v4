const { body, param, query } = require("express-validator");

const createSiteValidation = [
  body("company")
    .optional()
    .isMongoId()
    .withMessage("Valid company ID is required"),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Site name is required")
    .isLength({ min: 2, max: 120 })
    .withMessage("Site name must be between 2 and 120 characters"),

  body("code")
    .trim()
    .notEmpty()
    .withMessage("Site code is required")
    .isLength({ min: 2, max: 40 })
    .withMessage("Site code must be between 2 and 40 characters")
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Site code can contain only letters, numbers, underscore, and hyphen"),

  body("siteType")
    .optional()
    .isIn([
      "office",
      "parking",
      "factory",
      "warehouse",
      "residential",
      "mall",
      "hospital",
      "hotel",
      "other"
    ])
    .withMessage("Invalid site type"),

  body("contactPerson.email")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("Valid contact person email is required"),

  body("location.latitude")
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be between -90 and 90"),

  body("location.longitude")
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be between -180 and 180"),

  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Invalid site status")
];

const updateSiteValidation = [
  param("siteId")
    .isMongoId()
    .withMessage("Invalid site ID"),

  body("company")
    .optional()
    .isMongoId()
    .withMessage("Valid company ID is required"),

  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Site name must be between 2 and 120 characters"),

  body("code")
    .optional()
    .trim()
    .isLength({ min: 2, max: 40 })
    .withMessage("Site code must be between 2 and 40 characters")
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Site code can contain only letters, numbers, underscore, and hyphen"),

  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Invalid site status")
];

const siteIdValidation = [
  param("siteId")
    .isMongoId()
    .withMessage("Invalid site ID")
];

const listSitesValidation = [
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

  query("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Invalid site status")
];

module.exports = {
  createSiteValidation,
  updateSiteValidation,
  siteIdValidation,
  listSitesValidation
};