const http = require("http");
const mongoose = require("mongoose");

const app = require("./app");
const config = require("./config/env");
const connectDB = require("./config/db");

let server;
let isShuttingDown = false;

const startServer = async () => {
  try {
    console.log("🚀 Starting Archid Flow Server V4...");

    // ==========================
    // CONNECT DATABASE FIRST
    // ==========================
    await connectDB();

    // ==========================
    // START HTTP SERVER
    // ==========================
    server = http.createServer(app);

    const host = config.host || "0.0.0.0";

    server.listen(config.port, host, () => {
      console.log("✅ Archid Flow Server V4 started successfully");
      console.log(`✅ Server running on: ${host}:${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`🧩 API Version: ${config.apiVersion}`);

      console.log("====================================");
      console.log("📘 Documentation");
      console.log("====================================");
      console.log(`📘 Swagger Docs: ${config.apiBaseUrl}/api-docs`);
      console.log(`📄 Swagger JSON: ${config.apiBaseUrl}/api-docs.json`);
      console.log(`❤️ Health Check: ${config.apiBaseUrl}/health`);

      console.log("====================================");
      console.log("🔗 API Base Routes");
      console.log("====================================");
      console.log(`🔐 Auth Base: ${config.apiBaseUrl}/api/${config.apiVersion}/auth`);
      console.log(`👤 Profile Base: ${config.apiBaseUrl}/api/${config.apiVersion}/profile`);
      console.log(`👥 Users Base: ${config.apiBaseUrl}/api/${config.apiVersion}/users`);
      console.log(`🏢 Companies Base: ${config.apiBaseUrl}/api/${config.apiVersion}/companies`);
      console.log(`📍 Sites Base: ${config.apiBaseUrl}/api/${config.apiVersion}/sites`);
      console.log(`🧩 Device Types Base: ${config.apiBaseUrl}/api/${config.apiVersion}/device-types`);
      console.log(`💡 Devices Base: ${config.apiBaseUrl}/api/${config.apiVersion}/devices`);

      console.log("====================================");
      console.log("🏭 Phase 06 Device Lifecycle Routes");
      console.log("====================================");
      console.log(`🏷️ Pre-register Device: POST ${config.apiBaseUrl}/api/${config.apiVersion}/devices/pre-register`);
      console.log(`✅ Start QC: POST ${config.apiBaseUrl}/api/${config.apiVersion}/devices/:deviceId/qc/start`);
      console.log(`🧪 Record QC Result: POST ${config.apiBaseUrl}/api/${config.apiVersion}/devices/:deviceId/qc/result`);
      console.log(`🔄 Reset Customer Provisioning: PATCH ${config.apiBaseUrl}/api/${config.apiVersion}/devices/:deviceId/reset-customer-provisioning`);
      console.log(`📲 Claim Device: POST ${config.apiBaseUrl}/api/${config.apiVersion}/devices/claim`);
      console.log(`📡 Update Connection: PATCH ${config.apiBaseUrl}/api/${config.apiVersion}/devices/:deviceId/connection`);
      console.log(`📊 Update Live State: PATCH ${config.apiBaseUrl}/api/${config.apiVersion}/devices/:deviceId/live-state`);

      console.log("====================================");
      console.log("✅ Server Ready");
      console.log("====================================");
    });

    // ==========================
    // SERVER ERROR HANDLING
    // ==========================
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`❌ Port ${config.port} is already in use`);
      } else {
        console.error("❌ HTTP server error:", error);
      }

      shutdown("SERVER_ERROR");
    });

    // ==========================
    // FUTURE PHASES
    // ==========================
    // Phase 07 / 08:
    // Provisioning, customer onboarding, and device claim refinement.
    //
    // Phase 09:
    // Start MQTT only after DB is connected.
    // require("./mqtt/mqtt.listener").startMqttListener();
    // require("./jobs/offline-monitor.job").startOfflineMonitor();
  } catch (error) {
    console.error("❌ Server startup failed:", error.message);
    console.error(error);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);

  const forceShutdownTimer = setTimeout(() => {
    console.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);

  try {
    // ==========================
    // CLOSE HTTP SERVER
    // ==========================
    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          console.log("💤 HTTP server closed");
          resolve();
        });
      });
    }

    // ==========================
    // CLOSE DATABASE CONNECTION
    // ==========================
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("💤 MongoDB connection closed");
    }

    clearTimeout(forceShutdownTimer);
    process.exit(0);
  } catch (error) {
    clearTimeout(forceShutdownTimer);
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};

// ==========================
// PROCESS SIGNALS
// ==========================
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ==========================
// PROCESS ERROR HANDLING
// ==========================
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
  shutdown("UNHANDLED_REJECTION");
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  shutdown("UNCAUGHT_EXCEPTION");
});

// ==========================
// START SERVER
// ==========================
startServer();