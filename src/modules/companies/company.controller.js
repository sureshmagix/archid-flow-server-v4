const mongoose = require("mongoose");

const Company = require("./company.model");
const User = require("../users/user.model");
const ApiError = require("../../common/utils/ApiError");
const sendResponse = require("../../common/utils/sendResponse");
const { ROLES } = require("../../common/constants/roles");

const escapeRegex = value => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const isSuperAdmin = user => user?.role === ROLES.SUPER_ADMIN;

const normalizeCode = code => {
  return String(code || "").trim().toUpperCase();
};

const createCompany = async (req, res) => {
  const payload = req.body || {};

  const existingCompany = await Company.findOne({
    code: normalizeCode(payload.code)
  });

  if (existingCompany) {
    throw new ApiError(409, "Company code already exists");
  }

  const company = await Company.create({
    name: payload.name,
    code: normalizeCode(payload.code),
    email: payload.email,
    phone: payload.phone,
    address: payload.address,
    status: payload.status || "active",
    notes: payload.notes,
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  return sendResponse(res, 201, "Company created successfully", {
    company
  });
};

const listCompanies = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (!isSuperAdmin(req.user)) {
    if (!req.user.company) {
      return sendResponse(res, 200, "Companies fetched successfully", {
        page,
        limit,
        total,
        totalPages: 0,
        companies: []
      });
    }

    filter._id = req.user.company;
  }

  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.q) {
    const regex = new RegExp(escapeRegex(req.query.q), "i");

    filter.$or = [
      { name: regex },
      { code: regex },
      { email: regex },
      { "phone.number": regex },
      { "address.city": regex },
      { "address.state": regex }
    ];
  }

  const [companies, total] = await Promise.all([
    Company.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Company.countDocuments(filter)
  ]);

  return sendResponse(res, 200, "Companies fetched successfully", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    companies
  });
};

const getCompanyById = async (req, res) => {
  const { companyId } = req.params;

  const company = await Company.findById(companyId);

  if (!company) {
    throw new ApiError(404, "Company not found");
  }

  if (!isSuperAdmin(req.user) && String(req.user.company) !== String(company._id)) {
    throw new ApiError(403, "You do not have permission to access this company");
  }

  return sendResponse(res, 200, "Company fetched successfully", {
    company
  });
};

const updateCompany = async (req, res) => {
  const { companyId } = req.params;
  const payload = req.body || {};

  const company = await Company.findById(companyId);

  if (!company) {
    throw new ApiError(404, "Company not found");
  }

  if (payload.code) {
    const normalizedCode = normalizeCode(payload.code);

    const duplicate = await Company.findOne({
      _id: { $ne: company._id },
      code: normalizedCode
    });

    if (duplicate) {
      throw new ApiError(409, "Company code already exists");
    }

    company.code = normalizedCode;
  }

  const allowedFields = ["name", "email", "phone", "address", "status", "notes"];

  allowedFields.forEach(field => {
    if (payload[field] !== undefined) {
      company[field] = payload[field];
    }
  });

  company.updatedBy = req.user._id;

  await company.save();

  return sendResponse(res, 200, "Company updated successfully", {
    company
  });
};

const assignUserToCompany = async (req, res) => {
  const { companyId } = req.params;
  const { userId, role } = req.body || {};

  const company = await Company.findById(companyId);

  if (!company) {
    throw new ApiError(404, "Company not found");
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === ROLES.SUPER_ADMIN) {
    throw new ApiError(400, "super_admin cannot be assigned to a customer company");
  }

  user.company = company._id;

  if (role) {
    user.role = role;
  }

  await user.save();

  return sendResponse(res, 200, "User assigned to company successfully", {
    user: user.toSafeObject ? user.toSafeObject() : user
  });
};

module.exports = {
  createCompany,
  listCompanies,
  getCompanyById,
  updateCompany,
  assignUserToCompany
};