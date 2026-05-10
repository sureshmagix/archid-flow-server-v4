const ApiError = require("../utils/ApiError");
const { verifyAccessToken } = require("../utils/token");
const User = require("../../modules/users/user.model");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new ApiError(401, "Unauthorized. Bearer token is required"));
    }

    const token = authHeader.split(" ")[1];

    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ApiError(401, "Invalid token. User not found"));
    }

    if (user.isActive === false) {
      return next(new ApiError(403, "User account is inactive"));
    }

    req.user = user;

    return next();
  } catch (error) {
    return next(new ApiError(401, `Authentication failed: ${error.message}`));
  }
};

module.exports = authMiddleware;
