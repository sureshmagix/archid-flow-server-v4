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

// ==========================
// MODULE ROUTES
// ==========================
const authRoutes = require("./modules/auth/auth.routes");
const profileRoutes = require("./modules/profile/profile.routes");
const userRoutes = require("./modules/users/user.routes");

// Phase 04 Routes
const companyRoutes = require("./modules/companies/company.routes");
const siteRoutes = require("./modules/sites/site.routes");

const app = express();

// ==========================
// TRUST PROXY
// ==========================
// Required because production runs behind Nginx reverse proxy.
// Flow: Client -> Nginx -> Express
// This fixes express-rate-limit X-Forwarded-For warning.
app.set("trust proxy", 1);

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
const corsOrigin = config.corsOrigin || "*";

app.use(
  cors({
    origin: corsOrigin === "*" ? "*" : corsOrigin.split(","),
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
    apiVersion: config.apiVersion,
    routes: {
      auth: `/api/${config.apiVersion}/auth`,
      profile: `/api/${config.apiVersion}/profile`,
      users: `/api/${config.apiVersion}/users`,
      companies: `/api/${config.apiVersion}/companies`,
      sites: `/api/${config.apiVersion}/sites`
    }
  });
});

// ==========================
// BROWSER / SEO DEFAULT ROUTES
// ==========================
// Browsers automatically request /favicon.ico.
// Search engines or tools may request /robots.txt and /sitemap.xml.
// These routes prevent unnecessary 404 error logs.

app.get("/favicon.ico", (req, res) => {
  return res.status(204).end();
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain");

  return res.send(`User-agent: *
Allow: /

Sitemap: ${config.apiBaseUrl}/sitemap.xml
`);
});

app.get("/sitemap.xml", (req, res) => {
  res.type("application/xml");

  return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${config.apiBaseUrl}/</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${config.apiBaseUrl}/health</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${config.apiBaseUrl}/api-docs</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`);
});

// ==========================
// API ROUTES
// ==========================
// Example final URL when apiVersion = v1:
// /api/v1/auth
// /api/v1/profile
// /api/v1/users
// /api/v1/companies
// /api/v1/sites

app.use(`/api/${config.apiVersion}/auth`, authRoutes);
app.use(`/api/${config.apiVersion}/profile`, profileRoutes);
app.use(`/api/${config.apiVersion}/users`, userRoutes);

// Phase 04 Routes
app.use(`/api/${config.apiVersion}/companies`, companyRoutes);
app.use(`/api/${config.apiVersion}/sites`, siteRoutes);

// ==========================
// SWAGGER DOCS
// ==========================
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/api-docs.json", (req, res) => {
  return res.json(swaggerDocument);
});

// ==========================
// FUTURE API ROUTES
// ==========================
// app.use(`/api/${config.apiVersion}/device-types`, deviceTypeRoutes);
// app.use(`/api/${config.apiVersion}/devices`, deviceRoutes);
// app.use(`/api/${config.apiVersion}/provisioning`, provisioningRoutes);
// app.use(`/api/${config.apiVersion}/device-sharing`, deviceSharingRoutes);
// app.use(`/api/${config.apiVersion}/mqtt-access`, mqttAccessRoutes);

// ==========================
// 404 HANDLER
// ==========================
app.use(notFoundMiddleware);

// ==========================
// GLOBAL ERROR HANDLER
// ==========================
app.use(errorMiddleware);

module.exports = app;