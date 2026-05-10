const express = require("express");

const authMiddleware = require("../../common/middleware/auth.middleware");
const requireRole = require("../../common/middleware/requireRole");
const validate = require("../../common/middleware/validate.middleware");
const asyncHandler = require("../../common/utils/asyncHandler");
const { ROLES } = require("../../common/constants/roles");

const {
  createCompany,
  listCompanies,
  getCompanyById,
  updateCompany,
  assignUserToCompany
} = require("./company.controller");

const {
  createCompanyValidation,
  updateCompanyValidation,
  companyIdValidation,
  assignUserValidation,
  listCompaniesValidation
} = require("./company.validation");

const router = express.Router();

// Base path: /api/v1/companies

router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN),
  validate(createCompanyValidation),
  asyncHandler(createCompany)
);

router.get(
  "/",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),
  validate(listCompaniesValidation),
  asyncHandler(listCompanies)
);

router.get(
  "/:companyId",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),
  validate(companyIdValidation),
  asyncHandler(getCompanyById)
);

router.patch(
  "/:companyId",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN),
  validate(updateCompanyValidation),
  asyncHandler(updateCompany)
);

router.patch(
  "/:companyId/assign-user",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN),
  validate(assignUserValidation),
  asyncHandler(assignUserToCompany)
);

module.exports = router;