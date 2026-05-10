const mongoose = require("mongoose");

const User = require("./user.model");
const ApiError = require("../../common/utils/ApiError");

const USER_ROLES = [
  "super_admin",
  "customer_admin",
  "customer_control_user",
  "customer_view_user"
];

const USER_STATUSES = ["active", "inactive", "blocked"];

const getAuthUserId = req => {
  return req.user?._id || req.user?.id;
};

const toSafeUser = user => {
  if (!user) return null;

  const obj = user.toObject
    ? user.toObject({ versionKey: false })
    : { ...user };

  delete obj.password;

  return obj;
};

const escapeRegex = value => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const saveUserSafely = async user => {
  try {
    await user.save();
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "Email or mobile number already exists");
    }

    throw error;
  }
};

const assertValidUserId = userId => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }
};

const assertNotSelf = (req, userId, actionName) => {
  const authUserId = String(getAuthUserId(req));

  if (String(userId) === authUserId) {
    throw new ApiError(400, `You cannot ${actionName} your own account`);
  }
};

const ensureAtLeastOneSuperAdmin = async targetUser => {
  if (targetUser.role !== "super_admin") {
    return;
  }

  const superAdminCount = await User.countDocuments({
    role: "super_admin"
  });

  if (superAdminCount <= 1) {
    throw new ApiError(400, "At least one super_admin must remain in the system");
  }
};

// ==========================
// LIST USERS
// GET /api/v1/users
// ==========================
const listUsers = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.role) {
    if (!USER_ROLES.includes(req.query.role)) {
      throw new ApiError(400, "Invalid role filter");
    }

    filter.role = req.query.role;
  }

  if (req.query.accountStatus) {
    if (!USER_STATUSES.includes(req.query.accountStatus)) {
      throw new ApiError(400, "Invalid accountStatus filter");
    }

    filter.accountStatus = req.query.accountStatus;
  }

  if (req.query.q) {
    const regex = new RegExp(escapeRegex(req.query.q), "i");

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
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  return res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    data: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      users: users.map(toSafeUser)
    }
  });
};

// ==========================
// GET USER BY ID
// GET /api/v1/users/:userId
// ==========================
const getUserById = async (req, res) => {
  const { userId } = req.params;

  assertValidUserId(userId);

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json({
    success: true,
    message: "User fetched successfully",
    data: {
      user: toSafeUser(user)
    }
  });
};

// ==========================
// VERIFY USER
// PATCH /api/v1/users/:userId/verify
// ==========================
const verifyUser = async (req, res) => {
  const { userId } = req.params;

  assertValidUserId(userId);

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.profile) {
    user.profile = {};
  }

  const isVerified = req.body?.isVerified !== false;

  user.profile.isVerified = isVerified;
  user.profile.verifiedBy = isVerified ? getAuthUserId(req) : null;
  user.profile.verifiedAt = isVerified ? new Date() : null;

  await saveUserSafely(user);

  return res.status(200).json({
    success: true,
    message: isVerified
      ? "User verified successfully"
      : "User verification removed successfully",
    data: {
      user: toSafeUser(user)
    }
  });
};

// ==========================
// UPDATE USER ROLE
// PATCH /api/v1/users/:userId/role
// ==========================
const updateUserRole = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body || {};

  assertValidUserId(userId);
  assertNotSelf(req, userId, "change the role of");

  if (!USER_ROLES.includes(role)) {
    throw new ApiError(400, "Invalid role");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === role) {
    return res.status(200).json({
      success: true,
      message: "User already has this role",
      data: {
        user: toSafeUser(user)
      }
    });
  }

  if (user.role === "super_admin" && role !== "super_admin") {
    await ensureAtLeastOneSuperAdmin(user);
  }

  user.role = role;

  await saveUserSafely(user);

  return res.status(200).json({
    success: true,
    message: "User role updated successfully",
    data: {
      user: toSafeUser(user)
    }
  });
};

// ==========================
// UPDATE USER STATUS
// PATCH /api/v1/users/:userId/status
// ==========================
const updateUserStatus = async (req, res) => {
  const { userId } = req.params;
  const { accountStatus } = req.body || {};

  assertValidUserId(userId);
  assertNotSelf(req, userId, "change the status of");

  if (!USER_STATUSES.includes(accountStatus)) {
    throw new ApiError(400, "Invalid accountStatus");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === "super_admin" && accountStatus !== "active") {
    await ensureAtLeastOneSuperAdmin(user);
  }

  user.accountStatus = accountStatus;

  await saveUserSafely(user);

  return res.status(200).json({
    success: true,
    message: "User status updated successfully",
    data: {
      user: toSafeUser(user)
    }
  });
};

module.exports = {
  listUsers,
  getUserById,
  verifyUser,
  updateUserRole,
  updateUserStatus
};