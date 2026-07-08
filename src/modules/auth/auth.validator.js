const { body } = require("express-validator");

const User = require("../users/user.model");
const Company = require("../companies/company.model");
const { ROLES } = require("../../common/constants/roles");

const normalizeEmail = (value) => {
  return String(value || "").trim().toLowerCase();
};

const normalizeMobile = (value) => {
  return String(value || "").trim().replace(/\s+/g, "");
};

const signupValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("mobile")
    .trim()
    .notEmpty()
    .withMessage("Mobile number is required")
    .customSanitizer(normalizeMobile)
    .matches(/^[0-9]{8,15}$/)
    .withMessage("Mobile number must be 8 to 15 digits")
    .custom(async (mobile) => {
      const existingUser = await User.findOne({ mobile }).select("_id");

      if (existingUser) {
        throw new Error("Mobile number already exists");
      }

      return true;
    }),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required")
    .customSanitizer(normalizeEmail)
    .custom(async (email) => {
      const existingUser = await User.findOne({ email }).select("_id");

      if (existingUser) {
        throw new Error("Email already exists");
      }

      return true;
    }),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6, max: 72 })
    .withMessage("Password must be between 6 and 72 characters"),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Confirm password is required")
    .custom((confirmPassword, { req }) => {
      if (confirmPassword !== req.body.password) {
        throw new Error("Passwords do not match");
      }

      return true;
    }),

  body("company")
    .notEmpty()
    .withMessage("Company is required for customer admin signup")
    .bail()
    .isMongoId()
    .withMessage("Invalid company ID")
    .bail()
    .custom(async (companyId) => {
      const company = await Company.findById(companyId).select("_id status");

      if (!company) {
        throw new Error("Company not found");
      }

      if (company.status && company.status !== "active") {
        throw new Error("Company is not active");
      }

      const existingCustomerAdmin = await User.findOne({
        role: ROLES.CUSTOMER_ADMIN,
        company: companyId
      }).select("_id");

      if (existingCustomerAdmin) {
        throw new Error("Customer admin already exists for this company");
      }

      return true;
    })
];

const loginValidator = [
  body("identifier")
    .trim()
    .notEmpty()
    .withMessage("Mobile number or email is required"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
];

module.exports = {
  signupValidator,
  loginValidator
};