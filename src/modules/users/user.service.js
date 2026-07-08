const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const User = require("./user.model");
const Company = require("../companies/company.model");
const ApiError = require("../../common/utils/ApiError");
const { ROLES, ROLE_VALUES } = require("../../common/constants/roles");

const CUSTOMER_ROLES = [
  ROLES.CUSTOMER_ADMIN,
  ROLES.CUSTOMER_CONTROL_USER,
  ROLES.CUSTOMER_VIEW_USER
];

const USER_STATUS_VALUES = ["active", "inactive", "blocked"];

const normalizeEmail = value => {
  return String(value || "").trim().toLowerCase();
};

const normalizeMobile = value => {
  return String(value || "").trim().replace(/\s+/g, "");
};

const normalizeName = value => {
  return String(value || "").trim().replace(/\s+/g, " ");
};

const isCustomerRole = role => {
  return CUSTOMER_ROLES.includes(role);
};

const assertValidObjectId = (value, fieldName = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `Invalid ${fieldName}`);
  }
};

const buildSafeUser = user => {
  if (!user) return null;

  if (typeof user.toSafeObject === "function") {
    return user.toSafeObject();
  }

  const safeUser = user.toObject ? user.toObject({ versionKey: false }) : { ...user };
  delete safeUser.password;
  return safeUser;
};

const escapeRegex = value => {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const handleDuplicateKeyError = error => {
  if (error?.code !== 11000) {
    throw error;
  }

  const duplicateFields = Object.keys(error.keyPattern || error.keyValue || {});

  if (duplicateFields.includes("email")) {
    throw new ApiError(409, "Email already exists");
  }

  if (duplicateFields.includes("mobile")) {
    throw new ApiError(409, "Mobile number already exists");
  }

  throw new ApiError(409, "Duplicate user data found");
};

const validateBasicUserPayload = payload => {
  const errors = [];

  if (!normalizeName(payload.name)) {
    errors.push({ field: "name", message: "Name is required" });
  }

  if (!normalizeMobile(payload.mobile)) {
    errors.push({ field: "mobile", message: "Mobile number is required" });
  }

  if (!normalizeEmail(payload.email)) {
    errors.push({ field: "email", message: "Email is required" });
  }

  if (!payload.password || String(payload.password).length < 6) {
    errors.push({
      field: "password",
      message: "Password must be at least 6 characters"
    });
  }

  if (errors.length > 0) {
    throw new ApiError(400, "Validation failed", errors);
  }
};

const ensureValidRole = role => {
  if (!ROLE_VALUES.includes(role)) {
    throw new ApiError(400, "Invalid user role");
  }
};

const ensureCompanyExists = async companyId => {
  if (!companyId) {
    return null;
  }

  assertValidObjectId(companyId, "company ID");

  const company = await Company.findById(companyId);

  if (!company) {
    throw new ApiError(404, "Company not found");
  }

  return company;
};

const ensureCompanyRuleForRole = async ({ role, companyId }) => {
  ensureValidRole(role);

  if (role === ROLES.SUPER_ADMIN) {
    if (companyId) {
      throw new ApiError(400, "super_admin cannot be assigned to a company");
    }

    return null;
  }

  if (isCustomerRole(role) && !companyId) {
    throw new ApiError(400, "Company is required for customer users");
  }

  return ensureCompanyExists(companyId);
};

const ensureUniqueUserIdentity = async ({ email, mobile, excludeUserId = null }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedMobile = normalizeMobile(mobile);

  const filter = {
    $or: [{ email: normalizedEmail }, { mobile: normalizedMobile }]
  };

  if (excludeUserId) {
    assertValidObjectId(excludeUserId, "user ID");
    filter._id = { $ne: excludeUserId };
  }

  const existingUser = await User.findOne(filter).select("_id email mobile");

  if (!existingUser) {
    return;
  }

  if (existingUser.email === normalizedEmail) {
    throw new ApiError(409, "Email already exists");
  }

  if (existingUser.mobile === normalizedMobile) {
    throw new ApiError(409, "Mobile number already exists");
  }

  throw new ApiError(409, "User already exists");
};

const ensureSingleCustomerAdminPerCompany = async ({
  companyId,
  excludeUserId = null
}) => {
  if (!companyId) {
    return;
  }

  const filter = {
    role: ROLES.CUSTOMER_ADMIN,
    company: companyId
  };

  if (excludeUserId) {
    filter._id = { $ne: excludeUserId };
  }

  const existingCustomerAdmin = await User.findOne(filter).select("_id email mobile");

  if (existingCustomerAdmin) {
    throw new ApiError(409, "Customer admin already exists for this company");
  }
};

const createUser = async (payload = {}, options = {}) => {
  validateBasicUserPayload(payload);

  const role = payload.role || ROLES.CUSTOMER_ADMIN;
  ensureValidRole(role);

  const name = normalizeName(payload.name);
  const mobile = normalizeMobile(payload.mobile);
  const email = normalizeEmail(payload.email);
  const companyId = payload.company || null;

  const company = await ensureCompanyRuleForRole({ role, companyId });

  await ensureUniqueUserIdentity({ email, mobile });

  if (
    role === ROLES.CUSTOMER_ADMIN &&
    options.enforceSingleCustomerAdminPerCompany !== false
  ) {
    await ensureSingleCustomerAdminPerCompany({ companyId: company?._id || companyId });
  }

  const hashedPassword = await bcrypt.hash(String(payload.password), 10);

  const userData = {
    name,
    mobile,
    email,
    password: hashedPassword,
    role,
    company: company?._id || null,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    profile: {
      firstName: payload.profile?.firstName || name,
      lastName: payload.profile?.lastName || "",
      email,
      phone: {
        countryCode:
          payload.profile?.phone?.countryCode ||
          payload.phone?.countryCode ||
          "+91",
        number: mobile
      },
      address: payload.profile?.address || payload.address || {},
      professionalDetails:
        payload.profile?.professionalDetails ||
        payload.professionalDetails ||
        {},
      isVerified: Boolean(payload.profile?.isVerified),
      verifiedBy: payload.profile?.verifiedBy || null,
      verifiedAt: payload.profile?.verifiedAt || null
    }
  };

  try {
    const user = await User.create(userData);
    return buildSafeUser(user);
  } catch (error) {
    handleDuplicateKeyError(error);
  }
};

const createCustomerAdminUser = async (payload = {}, options = {}) => {
  return createUser(
    {
      ...payload,
      role: ROLES.CUSTOMER_ADMIN
    },
    {
      ...options,
      enforceSingleCustomerAdminPerCompany: true
    }
  );
};

const listUsers = async (query = {}, authUser = null) => {
  const page = Math.max(parseInt(query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || "20", 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.role) {
    ensureValidRole(query.role);
    filter.role = query.role;
  }

  if (query.company) {
    assertValidObjectId(query.company, "company ID");
    filter.company = query.company;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === true || query.isActive === "true";
  }

  if (query.accountStatus) {
    if (!USER_STATUS_VALUES.includes(query.accountStatus)) {
      throw new ApiError(400, "Invalid accountStatus filter");
    }

    filter.isActive = query.accountStatus === "active";
  }

  if (authUser && authUser.role !== ROLES.SUPER_ADMIN) {
    if (!authUser.company) {
      return {
        page,
        limit,
        total: 0,
        totalPages: 0,
        users: []
      };
    }

    filter.company = authUser.company;
  }

  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), "i");

    filter.$or = [
      { name: regex },
      { mobile: regex },
      { email: regex },
      { "profile.firstName": regex },
      { "profile.lastName": regex },
      { "profile.email": regex },
      { "profile.phone.number": regex },
      { "profile.professionalDetails.companyName": regex }
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .populate("company", "name code status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    users: users.map(buildSafeUser)
  };
};

const getUserById = async userId => {
  assertValidObjectId(userId, "user ID");

  const user = await User.findById(userId).populate("company", "name code status");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return buildSafeUser(user);
};

const updateUser = async (userId, payload = {}, options = {}) => {
  assertValidObjectId(userId, "user ID");

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (payload.email !== undefined) {
    const email = normalizeEmail(payload.email);
    await ensureUniqueUserIdentity({
      email,
      mobile: user.mobile,
      excludeUserId: user._id
    });
    user.email = email;
    user.profile.email = email;
  }

  if (payload.mobile !== undefined) {
    const mobile = normalizeMobile(payload.mobile);
    await ensureUniqueUserIdentity({
      email: user.email,
      mobile,
      excludeUserId: user._id
    });
    user.mobile = mobile;
    user.profile.phone.number = mobile;
  }

  if (payload.name !== undefined) {
    user.name = normalizeName(payload.name);
    user.profile.firstName = payload.profile?.firstName || user.name;
  }

  if (payload.profile !== undefined) {
    user.profile = {
      ...(user.profile || {}),
      ...payload.profile
    };
  }

  if (payload.company !== undefined) {
    const company = await ensureCompanyRuleForRole({
      role: user.role,
      companyId: payload.company
    });

    user.company = company?._id || null;

    if (
      user.role === ROLES.CUSTOMER_ADMIN &&
      options.enforceSingleCustomerAdminPerCompany !== false
    ) {
      await ensureSingleCustomerAdminPerCompany({
        companyId: user.company,
        excludeUserId: user._id
      });
    }
  }

  try {
    await user.save();
    return buildSafeUser(user);
  } catch (error) {
    handleDuplicateKeyError(error);
  }
};

const verifyUser = async ({ userId, isVerified = true, verifiedBy = null }) => {
  assertValidObjectId(userId, "user ID");

  if (verifiedBy) {
    assertValidObjectId(verifiedBy, "verifiedBy user ID");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.profile) {
    user.profile = {};
  }

  user.profile.isVerified = Boolean(isVerified);
  user.profile.verifiedBy = isVerified ? verifiedBy : null;
  user.profile.verifiedAt = isVerified ? new Date() : null;

  await user.save();

  return buildSafeUser(user);
};

const ensureAtLeastOneSuperAdmin = async targetUser => {
  if (targetUser.role !== ROLES.SUPER_ADMIN) {
    return;
  }

  const superAdminCount = await User.countDocuments({
    role: ROLES.SUPER_ADMIN,
    isActive: true
  });

  if (superAdminCount <= 1) {
    throw new ApiError(400, "At least one active super_admin must remain in the system");
  }
};

const updateUserRole = async ({
  userId,
  role,
  company = undefined,
  authUserId = null
}) => {
  assertValidObjectId(userId, "user ID");

  if (authUserId && String(authUserId) === String(userId)) {
    throw new ApiError(400, "You cannot change your own role");
  }

  ensureValidRole(role);

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === ROLES.SUPER_ADMIN && role !== ROLES.SUPER_ADMIN) {
    await ensureAtLeastOneSuperAdmin(user);
  }

  const targetCompanyId =
    role === ROLES.SUPER_ADMIN
      ? null
      : company !== undefined
        ? company
        : user.company;

  const companyDoc = await ensureCompanyRuleForRole({
    role,
    companyId: targetCompanyId
  });

  if (role === ROLES.CUSTOMER_ADMIN) {
    await ensureSingleCustomerAdminPerCompany({
      companyId: companyDoc?._id || targetCompanyId,
      excludeUserId: user._id
    });
  }

  user.role = role;
  user.company = companyDoc?._id || null;

  await user.save();

  return buildSafeUser(user);
};

const updateUserStatus = async ({
  userId,
  isActive,
  accountStatus,
  authUserId = null
}) => {
  assertValidObjectId(userId, "user ID");

  if (authUserId && String(authUserId) === String(userId)) {
    throw new ApiError(400, "You cannot change your own status");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  let nextIsActive;

  if (typeof isActive === "boolean") {
    nextIsActive = isActive;
  } else if (accountStatus) {
    if (!USER_STATUS_VALUES.includes(accountStatus)) {
      throw new ApiError(400, "Invalid accountStatus");
    }

    nextIsActive = accountStatus === "active";
  } else {
    throw new ApiError(400, "isActive or accountStatus is required");
  }

  if (user.role === ROLES.SUPER_ADMIN && nextIsActive === false) {
    await ensureAtLeastOneSuperAdmin(user);
  }

  user.isActive = nextIsActive;

  await user.save();

  return buildSafeUser(user);
};

const assignUserToCompany = async ({ userId, companyId, role = null }) => {
  assertValidObjectId(userId, "user ID");
  assertValidObjectId(companyId, "company ID");

  const company = await ensureCompanyExists(companyId);

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === ROLES.SUPER_ADMIN) {
    throw new ApiError(400, "super_admin cannot be assigned to a customer company");
  }

  const targetRole = role || user.role;

  ensureValidRole(targetRole);

  if (targetRole === ROLES.SUPER_ADMIN) {
    throw new ApiError(400, "super_admin cannot be assigned to a customer company");
  }

  if (targetRole === ROLES.CUSTOMER_ADMIN) {
    await ensureSingleCustomerAdminPerCompany({
      companyId: company._id,
      excludeUserId: user._id
    });
  }

  user.company = company._id;
  user.role = targetRole;

  await user.save();

  return buildSafeUser(user);
};

module.exports = {
  normalizeEmail,
  normalizeMobile,
  buildSafeUser,
  createUser,
  createCustomerAdminUser,
  listUsers,
  getUserById,
  updateUser,
  verifyUser,
  updateUserRole,
  updateUserStatus,
  assignUserToCompany,
  ensureUniqueUserIdentity,
  ensureSingleCustomerAdminPerCompany
};