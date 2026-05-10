const http = require("http");

const app = require("./app");
const config = require("./config/env");
const connectDB = require("./config/db");

let server;

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

    server.listen(config.port, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`📘 Swagger Docs: ${config.apiBaseUrl}/api-docs`);
      console.log(`❤️ Health Check: ${config.apiBaseUrl}/health`);
    });

    // ==========================
    // FUTURE PHASES
    // ==========================
    // Phase 09:
    // Start MQTT only after DB is connected.
    // require("./mqtt/mqtt.listener").startMqttListener();
    // require("./jobs/offline-monitor.job").startOfflineMonitor();

  } catch (error) {
    console.error("❌ Server startup failed:", error.message);
    process.exit(1);
  }
};

const shutdown = (signal) => {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);

  if (!server) {
    process.exit(0);
  }

  server.close(() => {
    console.log("💤 HTTP server closed");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
  shutdown("UNHANDLED_REJECTION");
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  shutdown("UNCAUGHT_EXCEPTION");
});

startServer();
