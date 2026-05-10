const config = require("../../config/env");

const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  const response = {
    success: false,
    message: err.message || "Internal Server Error"
  };

  if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
    response.errors = err.errors;
  }

  if (config.nodeEnv !== "production") {
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