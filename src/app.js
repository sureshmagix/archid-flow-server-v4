const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");

const config = require("./config/env");
const swaggerDocument = require("./config/swagger");

const sendResponse = require("./common/utils/sendResponse");
const notFoundMiddleware = require("./common/middleware/notFound.middleware");
const errorMiddleware = require("./common/middleware/error.middleware");

const app = express();

// ==========================
// SECURITY MIDDLEWARE
// ==========================
app.use(helmet());

// ==========================
// REQUEST LOGGING
// ==========================
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));

// ==========================
// CORS
// ==========================
app.use(
  cors({
    origin: config.corsOrigin === "*" ? "*" : config.corsOrigin.split(","),
    credentials: true
  })
);

// ==========================
// BODY PARSERS
// ==========================
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ==========================
// RATE LIMITING
// ==========================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

app.use(apiLimiter);

// ==========================
// HEALTH CHECK
// ==========================
app.get("/health", (req, res) => {
  return sendResponse(res, 200, "Server is healthy", {
    appName: config.appName,
    appCode: config.appCode,
    environment: config.nodeEnv,
    apiVersion: config.apiVersion,
    timestamp: new Date().toISOString()
  });
});

// ==========================
// API ROOT
// ==========================
app.get("/", (req, res) => {
  return sendResponse(res, 200, "Welcome to Archid Flow Server V4", {
    docs: "/api-docs",
    health: "/health",
    apiVersion: config.apiVersion
  });
});

// ==========================
// SWAGGER DOCS
// ==========================
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/api-docs.json", (req, res) => {
  res.json(swaggerDocument);
});

// ==========================
// FUTURE API ROUTES
// ==========================
// Phase 02 onwards:
// app.use("/api/v1/auth", authRoutes);
// app.use("/api/v1/users", userRoutes);
// app.use("/api/v1/companies", companyRoutes);
// app.use("/api/v1/sites", siteRoutes);
// app.use("/api/v1/device-types", deviceTypeRoutes);
// app.use("/api/v1/devices", deviceRoutes);
// app.use("/api/v1/provisioning", provisioningRoutes);
// app.use("/api/v1/device-sharing", deviceSharingRoutes);
// app.use("/api/v1/mqtt-access", mqttAccessRoutes);

// ==========================
// 404 HANDLER
// ==========================
app.use(notFoundMiddleware);

// ==========================
// GLOBAL ERROR HANDLER
// ==========================
app.use(errorMiddleware);

module.exports = app;
