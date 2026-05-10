const { body, param, query } = require("express-validator");

const createCompanyValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Company name is required")
    .isLength({ min: 2, max: 120 })
    .withMessage("Company name must be between 2 and 120 characters"),

  body("code")
    .trim()
    .notEmpty()
    .withMessage("Company code is required")
    .isLength({ min: 2, max: 40 })
    .withMessage("Company code must be between 2 and 40 characters")
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Company code can contain only letters, numbers, underscore, and hyphen"),

  body("email")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("Valid email is required"),

  body("phone.countryCode")
    .optional({ checkFalsy: true })
    .trim(),

  body("phone.number")
    .optional({ checkFalsy: true })
    .trim(),

  body("status")
    .optional()
    .isIn(["active", "inactive", "blocked"])
    .withMessage("Invalid company status")
];

const updateCompanyValidation = [
  param("companyId")
    .isMongoId()
    .withMessage("Invalid company ID"),

  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Company name must be between 2 and 120 characters"),

  body("code")
    .optional()
    .trim()
    .isLength({ min: 2, max: 40 })
    .withMessage("Company code must be between 2 and 40 characters")
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Company code can contain only letters, numbers, underscore, and hyphen"),

  body("email")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("Valid email is required"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "blocked"])
    .withMessage("Invalid company status")
];

const companyIdValidation = [
  param("companyId")
    .isMongoId()
    .withMessage("Invalid company ID")
];

const assignUserValidation = [
  param("companyId")
    .isMongoId()
    .withMessage("Invalid company ID"),

  body("userId")
    .isMongoId()
    .withMessage("Valid userId is required"),

  body("role")
    .optional()
    .isIn(["customer_admin", "customer_control_user", "customer_view_user"])
    .withMessage("Invalid customer role")
];

const listCompaniesValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive number"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),

  query("status")
    .optional()
    .isIn(["active", "inactive", "blocked"])
    .withMessage("Invalid company status")
];

module.exports = {
  createCompanyValidation,
  updateCompanyValidation,
  companyIdValidation,
  assignUserValidation,
  listCompaniesValidation
};