const User = require("../users/user.model");
const ApiError = require("../../common/utils/ApiError");

const restrictedFields = [
  "password",
  "role",
  "accountStatus",
  "isVerified",
  "verifiedBy",
  "verifiedAt"
];

const normalizeString = value => {
  if (typeof value !== "string") return value;
  return value.trim();
};

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

// ==========================
// GET MY PROFILE
// GET /api/v1/profile
// ==========================
const getMyProfile = async (req, res) => {
  const userId = getAuthUserId(req);

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
    data: {
      user: toSafeUser(user)
    }
  });
};

// ==========================
// UPDATE MY PROFILE
// PATCH /api/v1/profile
// ==========================
const updateMyProfile = async (req, res) => {
  const userId = getAuthUserId(req);
  const body = req.body || {};

  const hasRestrictedField = restrictedFields.some(field =>
    Object.prototype.hasOwnProperty.call(body, field)
  );

  if (hasRestrictedField) {
    throw new ApiError(400, "Restricted fields cannot be updated from profile endpoint");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const profileInput =
    body.profile && typeof body.profile === "object"
      ? {
          ...body,
          ...body.profile
        }
      : body;

  if (!user.profile) {
    user.profile = {};
  }

  let changed = false;

  if (Object.prototype.hasOwnProperty.call(profileInput, "name")) {
    user.name = normalizeString(profileInput.name);
    changed = true;
  }

  if (Object.prototype.hasOwnProperty.call(profileInput, "email")) {
    const email = normalizeString(profileInput.email)?.toLowerCase();

    user.email = email || undefined;
    user.profile.email = email || "";
    changed = true;
  }

  if (Object.prototype.hasOwnProperty.call(profileInput, "mobile")) {
    user.mobile = normalizeString(profileInput.mobile);

    user.profile.phone = {
      ...(user.profile.phone || {}),
      number: normalizeString(profileInput.mobile)
    };

    changed = true;
  }

  if (Object.prototype.hasOwnProperty.call(profileInput, "firstName")) {
    user.profile.firstName = normalizeString(profileInput.firstName);
    changed = true;
  }

  if (Object.prototype.hasOwnProperty.call(profileInput, "lastName")) {
    user.profile.lastName = normalizeString(profileInput.lastName);
    changed = true;
  }

  if (Object.prototype.hasOwnProperty.call(profileInput, "avatarUrl")) {
    user.profile.avatarUrl = normalizeString(profileInput.avatarUrl);
    changed = true;
  }

  if (profileInput.phone && typeof profileInput.phone === "object") {
    user.profile.phone = {
      ...(user.profile.phone || {}),
      ...profileInput.phone
    };

    changed = true;
  }

  if (profileInput.address && typeof profileInput.address === "object") {
    user.profile.address = {
      ...(user.profile.address || {}),
      ...profileInput.address
    };

    changed = true;
  }

  if (
    profileInput.professionalDetails &&
    typeof profileInput.professionalDetails === "object"
  ) {
    user.profile.professionalDetails = {
      ...(user.profile.professionalDetails || {}),
      ...profileInput.professionalDetails
    };

    changed = true;
  }

  if (!changed) {
    throw new ApiError(400, "No valid profile fields provided");
  }

  await saveUserSafely(user);

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      user: toSafeUser(user)
    }
  });
};

module.exports = {
  getMyProfile,
  updateMyProfile
};