const config = require("../../config/env");

const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || (err.code === 11000 || err.name === "VersionError" ? 409 :
    ["ValidationError", "CastError"].includes(err.name) ? 400 : 500);

  const response = {
    success: false,
    message: err.message || "Internal Server Error"
  };

  if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
    response.errors = err.errors;
  }

  // Show stack only when explicitly enabled.
  // Keep this false on Utho/cloud testing and production.
  if (config.showErrorStack === true) {
    response.stack = err.stack;
  }

  console.error("❌ Error:", {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message: err.message
  });

  return res.status(statusCode).json(response);
};

module.exports = errorMiddleware;
