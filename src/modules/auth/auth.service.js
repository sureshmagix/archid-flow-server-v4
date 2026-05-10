const bcrypt = require("bcryptjs");

const User = require("../users/user.model");
const ApiError = require("../../common/utils/ApiError");
const { generateAccessToken } = require("../../common/utils/token");

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

const signup = async ({ name, mobile, email, password }) => {
  const existingUser = await User.findOne({
    $or: [{ mobile }, { email }]
  });

  if (existingUser) {
    throw new ApiError(409, "User already exists with this mobile number or email");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    mobile,
    email,
    password: hashedPassword,
    profile: {
      firstName: name,
      email,
      phone: {
        countryCode: "+91",
        number: mobile
      }
    }
  });

  return buildSafeUser(user);
};

const login = async ({ identifier, password }) => {
  const user = await User.findOne({
    $or: [{ mobile: identifier }, { email: identifier.toLowerCase() }]
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
