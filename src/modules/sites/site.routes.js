const express = require("express");

const authMiddleware = require("../../common/middleware/auth.middleware");
const requireRole = require("../../common/middleware/requireRole");
const validate = require("../../common/middleware/validate.middleware");
const asyncHandler = require("../../common/utils/asyncHandler");
const { ROLES } = require("../../common/constants/roles");

const {
  createSite,
  listSites,
  getSiteById,
  updateSite
} = require("./site.controller");

const {
  createSiteValidation,
  updateSiteValidation,
  siteIdValidation,
  listSitesValidation
} = require("./site.validation");

const router = express.Router();

// Base path: /api/v1/sites

router.post(
  "/",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN),
  validate(createSiteValidation),
  asyncHandler(createSite)
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
  validate(listSitesValidation),
  asyncHandler(listSites)
);

router.get(
  "/:siteId",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),
  validate(siteIdValidation),
  asyncHandler(getSiteById)
);

router.patch(
  "/:siteId",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN),
  validate(updateSiteValidation),
  asyncHandler(updateSite)
);

module.exports = router;