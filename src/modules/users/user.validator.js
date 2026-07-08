const { body, param, query } = require("express-validator");

const User = require("./user.model");
const Company = require("../companies/company.model");
const { ROLES, ROLE_VALUES } = require("../../common/constants/roles");

const USER_STATUS_VALUES = ["active", "inactive", "blocked"];

const CUSTOMER_ROLES = [
  ROLES.CUSTOMER_ADMIN,
  ROLES.CUSTOMER_CONTROL_USER,
  ROLES.CUSTOMER_VIEW_USER
];

const normalizeEmail = value => {
  return String(value || "").trim().toLowerCase();
};

const normalizeMobile = value => {
  return String(value || "").trim().replace(/\s+/g, "");
};

const isCustomerRole = role => {
  return CUSTOMER_ROLES.includes(role);
};

const getUserIdFromRequest = req => {
  return req.params?.userId || req.body?.userId || null;
};

const uniqueEmailValidator = async (value, { req }) => {
  const email = normalizeEmail(value);
  const userId = getUserIdFromRequest(req);

  const filter = { email };

  if (userId) {
    filter._id = { $ne: userId };
  }

  const existingUser = await User.findOne(filter).select("_id");

  if (existingUser) {
    throw new Error("Email already exists");
  }

  return true;
};

const uniqueMobileValidator = async (value, { req }) => {
  const mobile = normalizeMobile(value);
  const userId = getUserIdFromRequest(req);

  const filter = { mobile };

  if (userId) {
    filter._id = { $ne: userId };
  }

  const existingUser = await User.findOne(filter).select("_id");

  if (existingUser) {
    throw new Error("Mobile number already exists");
  }

  return true;
};

const companyRulesValidator = async (value, { req }) => {
  const role = req.body?.role || ROLES.CUSTOMER_ADMIN;

  if (!ROLE_VALUES.includes(role)) {
    throw new Error("Invalid user role");
  }

  if (role === ROLES.SUPER_ADMIN) {
    if (value) {
      throw new Error("super_admin cannot be assigned to a company");
    }

    return true;
  }

  if (isCustomerRole(role) && !value) {
    throw new Error("Company is required for customer users");
  }

  if (!value) {
    return true;
  }

  const company = await Company.findById(value).select("_id status");

  if (!company) {
    throw new Error("Company not found");
  }

  if (company.status && company.status !== "active") {
    throw new Error("Company is not active");
  }

  if (role === ROLES.CUSTOMER_ADMIN) {
    const userId = getUserIdFromRequest(req);

    const filter = {
      role: ROLES.CUSTOMER_ADMIN,
      company: company._id
    };

    if (userId) {
      filter._id = { $ne: userId };
    }

    const existingCustomerAdmin = await User.findOne(filter).select("_id");

    if (existingCustomerAdmin) {
      throw new Error("Customer admin already exists for this company");
    }
  }

  return true;
};

const existingCompanyValidator = async value => {
  const company = await Company.findById(value).select("_id status");

  if (!company) {
    throw new Error("Company not found");
  }

  if (company.status && company.status !== "active") {
    throw new Error("Company is not active");
  }

  return true;
};

const createUserValidation = [
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
    .matches(/^[0-9+\-\s]{8,15}$/)
    .withMessage("Mobile number must be 8 to 15 digits")
    .customSanitizer(normalizeMobile)
    .custom(uniqueMobileValidator),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required")
    .customSanitizer(normalizeEmail)
    .custom(uniqueEmailValidator),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6, max: 72 })
    .withMessage("Password must be between 6 and 72 characters"),

  body("confirmPassword")
    .custom((value, { req }) => {
      if (value === undefined || value === null || value === "") {
        return true;
      }

      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }

      return true;
    }),

  body("role")
    .optional()
    .trim()
    .isIn(ROLE_VALUES)
    .withMessage("Invalid user role"),

  body("company")
    .custom(companyRulesValidator),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be true or false")
    .toBoolean(),

  body("profile")
    .optional()
    .isObject()
    .withMessage("profile must be an object"),

  body("profile.firstName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("First name cannot exceed 100 characters"),

  body("profile.lastName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Last name cannot exceed 100 characters"),

  body("profile.phone.countryCode")
    .optional()
    .trim()
    .isLength({ min: 2, max: 8 })
    .withMessage("Country code must be between 2 and 8 characters"),

  body("profile.phone.number")
    .optional()
    .trim()
    .matches(/^[0-9+\-\s]{8,15}$/)
    .withMessage("Profile phone number must be 8 to 15 digits")
];

const createCustomerAdminValidation = [
  ...createUserValidation,

  body("role")
    .optional()
    .custom(value => {
      if (value !== ROLES.CUSTOMER_ADMIN) {
        throw new Error("Role must be customer_admin");
      }

      return true;
    })
];

const updateUserValidation = [
  param("userId")
    .isMongoId()
    .withMessage("Invalid user ID"),

  body()
    .custom(value => {
      const allowedFields = [
        "name",
        "mobile",
        "email",
        "company",
        "profile",
        "isActive"
      ];

      const hasAtLeastOneField = allowedFields.some(field => {
        return Object.prototype.hasOwnProperty.call(value, field);
      });

      if (!hasAtLeastOneField) {
        throw new Error("At least one field is required for update");
      }

      return true;
    }),

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("mobile")
    .optional()
    .trim()
    .matches(/^[0-9+\-\s]{8,15}$/)
    .withMessage("Mobile number must be 8 to 15 digits")
    .customSanitizer(normalizeMobile)
    .custom(uniqueMobileValidator),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .customSanitizer(normalizeEmail)
    .custom(uniqueEmailValidator),

  body("company")
    .optional()
    .isMongoId()
    .withMessage("Invalid company ID")
    .custom(existingCompanyValidator),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be true or false")
    .toBoolean(),

  body("profile")
    .optional()
    .isObject()
    .withMessage("profile must be an object")
];

const listUsersValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive number")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100")
    .toInt(),

  query("role")
    .optional()
    .isIn(ROLE_VALUES)
    .withMessage("Invalid role filter"),

  query("company")
    .optional()
    .isMongoId()
    .withMessage("Invalid company ID"),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be true or false")
    .toBoolean(),

  query("accountStatus")
    .optional()
    .isIn(USER_STATUS_VALUES)
    .withMessage("Invalid accountStatus filter"),

  query("q")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search text cannot exceed 100 characters")
];

const userIdValidation = [
  param("userId")
    .isMongoId()
    .withMessage("Invalid user ID")
];

const verifyUserValidation = [
  param("userId")
    .isMongoId()
    .withMessage("Invalid user ID"),

  body("isVerified")
    .optional()
    .isBoolean()
    .withMessage("isVerified must be true or false")
    .toBoolean()
];

const updateUserRoleValidation = [
  param("userId")
    .isMongoId()
    .withMessage("Invalid user ID"),

  body("role")
    .trim()
    .notEmpty()
    .withMessage("Role is required")
    .isIn(ROLE_VALUES)
    .withMessage("Invalid user role"),

  body("company")
    .optional()
    .isMongoId()
    .withMessage("Invalid company ID")
    .custom(existingCompanyValidator),

  body()
    .custom(async (value, { req }) => {
      const role = req.body.role;

      if (role === ROLES.SUPER_ADMIN) {
        return true;
      }

      let companyId = req.body.company;

      if (!companyId) {
        const user = await User.findById(req.params.userId).select("company");

        if (!user) {
          throw new Error("User not found");
        }

        companyId = user.company;
      }

      if (!companyId) {
        throw new Error("Company is required for customer users");
      }

      if (role === ROLES.CUSTOMER_ADMIN) {
        const existingCustomerAdmin = await User.findOne({
          _id: { $ne: req.params.userId },
          role: ROLES.CUSTOMER_ADMIN,
          company: companyId
        }).select("_id");

        if (existingCustomerAdmin) {
          throw new Error("Customer admin already exists for this company");
        }
      }

      return true;
    })
];

const updateUserStatusValidation = [
  param("userId")
    .isMongoId()
    .withMessage("Invalid user ID"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be true or false")
    .toBoolean(),

  body("accountStatus")
    .optional()
    .isIn(USER_STATUS_VALUES)
    .withMessage("Invalid accountStatus"),

  body()
    .custom(value => {
      const hasIsActive = Object.prototype.hasOwnProperty.call(value, "isActive");
      const hasAccountStatus = Object.prototype.hasOwnProperty.call(
        value,
        "accountStatus"
      );

      if (!hasIsActive && !hasAccountStatus) {
        throw new Error("isActive or accountStatus is required");
      }

      return true;
    })
];

const assignUserToCompanyValidation = [
  param("companyId")
    .isMongoId()
    .withMessage("Invalid company ID")
    .custom(existingCompanyValidator),

  body("userId")
    .trim()
    .notEmpty()
    .withMessage("userId is required")
    .isMongoId()
    .withMessage("Invalid user ID"),

  body("role")
    .optional()
    .trim()
    .isIn(CUSTOMER_ROLES)
    .withMessage("Invalid customer role"),

  body()
    .custom(async (value, { req }) => {
      const role = req.body.role;

      if (role && role !== ROLES.CUSTOMER_ADMIN) {
        return true;
      }

      const existingCustomerAdmin = await User.findOne({
        _id: { $ne: req.body.userId },
        role: ROLES.CUSTOMER_ADMIN,
        company: req.params.companyId
      }).select("_id");

      if (existingCustomerAdmin) {
        throw new Error("Customer admin already exists for this company");
      }

      return true;
    })
];

module.exports = {
  createUserValidation,
  createCustomerAdminValidation,
  updateUserValidation,
  listUsersValidation,
  userIdValidation,
  verifyUserValidation,
  updateUserRoleValidation,
  updateUserStatusValidation,
  assignUserToCompanyValidation
};