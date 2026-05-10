const jwt = require("jsonwebtoken");
const config = require("../../config/env");

const generateAccessToken = (user) => {
  if (!config.jwt.secret) {
    throw new Error("JWT_SECRET is missing in .env file");
  }

  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn
    }
  );
};

const verifyAccessToken = (token) => {
  if (!config.jwt.secret) {
    throw new Error("JWT_SECRET is missing in .env file");
  }

  return jwt.verify(token, config.jwt.secret);
};

module.exports = {
  generateAccessToken,
  verifyAccessToken
};
