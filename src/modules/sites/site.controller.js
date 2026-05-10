const Company = require("../companies/company.model");
const Site = require("./site.model");
const ApiError = require("../../common/utils/ApiError");
const sendResponse = require("../../common/utils/sendResponse");
const { ROLES } = require("../../common/constants/roles");

const escapeRegex = value => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const isSuperAdmin = user => user?.role === ROLES.SUPER_ADMIN;
const isCustomerAdmin = user => user?.role === ROLES.CUSTOMER_ADMIN;

const normalizeCode = code => {
  return String(code || "").trim().toUpperCase();
};

const resolveCompanyForCreate = async req => {
  if (isSuperAdmin(req.user)) {
    if (!req.body.company) {
      throw new ApiError(400, "company is required");
    }

    const company = await Company.findById(req.body.company);

    if (!company) {
      throw new ApiError(404, "Company not found");
    }

    return company;
  }

  if (!req.user.company) {
    throw new ApiError(400, "Logged-in user is not assigned to any company");
  }

  const company = await Company.findById(req.user.company);

  if (!company) {
    throw new ApiError(404, "Assigned company not found");
  }

  return company;
};

const assertSiteAccess = (req, site) => {
  if (isSuperAdmin(req.user)) {
    return;
  }

  if (String(req.user.company) !== String(site.company?._id || site.company)) {
    throw new ApiError(403, "You do not have permission to access this site");
  }
};

const createSite = async (req, res) => {
  const payload = req.body || {};
  const company = await resolveCompanyForCreate(req);

  const duplicate = await Site.findOne({
    company: company._id,
    code: normalizeCode(payload.code)
  });

  if (duplicate) {
    throw new ApiError(409, "Site code already exists for this company");
  }

  const site = await Site.create({
    company: company._id,
    name: payload.name,
    code: normalizeCode(payload.code),
    siteType: payload.siteType || "office",
    contactPerson: payload.contactPerson,
    address: payload.address,
    location: payload.location,
    timezone: payload.timezone || "Asia/Kolkata",
    status: payload.status || "active",
    notes: payload.notes,
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  const populatedSite = await Site.findById(site._id).populate("company", "name code status");

  return sendResponse(res, 201, "Site created successfully", {
    site: populatedSite
  });
};

const listSites = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (isSuperAdmin(req.user)) {
    if (req.query.company) {
      filter.company = req.query.company;
    }
  } else {
    if (!req.user.company) {
      return sendResponse(res, 200, "Sites fetched successfully", {
        page,
        limit,
        total: 0,
        totalPages: 0,
        sites: []
      });
    }

    filter.company = req.user.company;
  }

  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.q) {
    const regex = new RegExp(escapeRegex(req.query.q), "i");

    filter.$or = [
      { name: regex },
      { code: regex },
      { siteType: regex },
      { "contactPerson.name": regex },
      { "contactPerson.email": regex },
      { "address.city": regex },
      { "address.state": regex }
    ];
  }

  const [sites, total] = await Promise.all([
    Site.find(filter)
      .populate("company", "name code status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Site.countDocuments(filter)
  ]);

  return sendResponse(res, 200, "Sites fetched successfully", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    sites
  });
};

const getSiteById = async (req, res) => {
  const { siteId } = req.params;

  const site = await Site.findById(siteId).populate("company", "name code status");

  if (!site) {
    throw new ApiError(404, "Site not found");
  }

  assertSiteAccess(req, site);

  return sendResponse(res, 200, "Site fetched successfully", {
    site
  });
};

const updateSite = async (req, res) => {
  const { siteId } = req.params;
  const payload = req.body || {};

  const site = await Site.findById(siteId);

  if (!site) {
    throw new ApiError(404, "Site not found");
  }

  assertSiteAccess(req, site);

  if (!isSuperAdmin(req.user) && !isCustomerAdmin(req.user)) {
    throw new ApiError(403, "Only customer_admin can update sites");
  }

  let targetCompanyId = site.company;

  if (payload.company) {
    if (!isSuperAdmin(req.user)) {
      throw new ApiError(403, "Only super_admin can move site to another company");
    }

    const company = await Company.findById(payload.company);

    if (!company) {
      throw new ApiError(404, "Company not found");
    }

    targetCompanyId = company._id;
    site.company = company._id;
  }

  if (payload.code) {
    const normalizedCode = normalizeCode(payload.code);

    const duplicate = await Site.findOne({
      _id: { $ne: site._id },
      company: targetCompanyId,
      code: normalizedCode
    });

    if (duplicate) {
      throw new ApiError(409, "Site code already exists for this company");
    }

    site.code = normalizedCode;
  }

  const allowedFields = [
    "name",
    "siteType",
    "contactPerson",
    "address",
    "location",
    "timezone",
    "status",
    "notes"
  ];

  allowedFields.forEach(field => {
    if (payload[field] !== undefined) {
      site[field] = payload[field];
    }
  });

  site.updatedBy = req.user._id;

  await site.save();

  const populatedSite = await Site.findById(site._id).populate("company", "name code status");

  return sendResponse(res, 200, "Site updated successfully", {
    site: populatedSite
  });
};

module.exports = {
  createSite,
  listSites,
  getSiteById,
  updateSite
};