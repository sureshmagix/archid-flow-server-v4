const bcrypt = require("bcryptjs");

const User = require("../users/user.model");
const Company = require("../companies/company.model");
const ApiError = require("../../common/utils/ApiError");
const { generateAccessToken } = require("../../common/utils/token");
const { ROLES } = require("../../common/constants/roles");

const buildSafeUser = (user) => {
  if (!user) {
    return null;
  }

  if (typeof user.toSafeObject === "function") {
    return user.toSafeObject();
  }

  const safeUser = user.toObject ? user.toObject() : { ...user };
  delete safeUser.password;

  return safeUser;
};

const normalizeEmail = (value) => {
  return String(value || "").trim().toLowerCase();
};

const normalizeMobile = (value) => {
  return String(value || "").trim().replace(/\s+/g, "");
};

const handleDuplicateKeyError = (error) => {
  if (error?.code !== 11000) {
    throw error;
  }

  const keyPattern = error.keyPattern || {};
  const keyValue = error.keyValue || {};

  if (keyPattern.email || keyValue.email) {
    throw new ApiError(409, "Email already exists");
  }

  if (keyPattern.mobile || keyValue.mobile) {
    throw new ApiError(409, "Mobile number already exists");
  }

  if (keyPattern.company && keyPattern.role) {
    throw new ApiError(409, "Customer admin already exists for this company");
  }

  throw new ApiError(409, "Duplicate user data found");
};

const signup = async ({ name, mobile, email, password, company }) => {
  const normalizedName = String(name || "").trim().replace(/\s+/g, " ");
  const normalizedMobile = normalizeMobile(mobile);
  const normalizedEmail = normalizeEmail(email);

  if (!company) {
    throw new ApiError(400, "Company is required for customer admin signup");
  }

  const existingCompany = await Company.findById(company).select("_id status");

  if (!existingCompany) {
    throw new ApiError(404, "Company not found");
  }

  if (existingCompany.status && existingCompany.status !== "active") {
    throw new ApiError(400, "Company is not active");
  }

  const existingUser = await User.findOne({
    $or: [{ mobile: normalizedMobile }, { email: normalizedEmail }]
  });

  if (existingUser) {
    throw new ApiError(409, "User already exists with this mobile number or email");
  }

  const existingCustomerAdmin = await User.findOne({
    role: ROLES.CUSTOMER_ADMIN,
    company: existingCompany._id
  });

  if (existingCustomerAdmin) {
    throw new ApiError(409, "Customer admin already exists for this company");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await User.create({
      name: normalizedName,
      mobile: normalizedMobile,
      email: normalizedEmail,
      password: hashedPassword,
      role: ROLES.CUSTOMER_ADMIN,
      company: existingCompany._id,
      profile: {
        firstName: normalizedName,
        email: normalizedEmail,
        phone: {
          countryCode: "+91",
          number: normalizedMobile
        },
        address: {
          country: "India"
        }
      }
    });

    return buildSafeUser(user);
  } catch (error) {
    handleDuplicateKeyError(error);
  }
};

const login = async ({ identifier, password }) => {
  const normalizedIdentifier = String(identifier || "").trim();

  const user = await User.findOne({
    $or: [
      { mobile: normalizeMobile(normalizedIdentifier) },
      { email: normalizeEmail(normalizedIdentifier) }
    ]
  }).select("+password");

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (user.isActive === false) {
    throw new ApiError(403, "User account is inactive");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = generateAccessToken(user);

  return {
    token,
    user: buildSafeUser(user)
  };
};

const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return buildSafeUser(user);
};

module.exports = {
  signup,
  login,
  getCurrentUser
};