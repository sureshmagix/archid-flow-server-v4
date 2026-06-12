const dotenv = require("dotenv");

dotenv.config();

const toNumber = (value, defaultValue) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const toBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  appName: process.env.APP_NAME || "Archid Flow Server V4",
  appCode: process.env.APP_CODE || "archid-flow",
  apiVersion: process.env.API_VERSION || "v1",

  host: process.env.HOST || "0.0.0.0",
  port: toNumber(process.env.PORT, 4000),

  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:4000",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  showErrorStack: toBoolean(process.env.SHOW_ERROR_STACK, false),

  mongoUri: process.env.MONGODB_URI,

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  },

  mqtt: {
    namespace: process.env.MQTT_NAMESPACE || "archid",
    apiVersion: process.env.MQTT_API_VERSION || "v4",
    url: process.env.MQTT_URL || "mqtt://127.0.0.1:1883",
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: toNumber(process.env.MQTT_RECONNECT_PERIOD, 5000),
    connectTimeout: toNumber(process.env.MQTT_CONNECT_TIMEOUT, 30000),
    clean: toBoolean(process.env.MQTT_CLEAN, true),
    publicUrl: process.env.MQTT_PUBLIC_URL || "wss://mqtt.archidtech.in/mqtt",
    accessTtlSeconds: toNumber(process.env.MQTT_ACCESS_TTL_SECONDS, 900)
  },

  deviceMonitoring: {
    offlineThresholdSeconds: toNumber(process.env.DEVICE_OFFLINE_THRESHOLD_SECONDS, 60),
    offlineCheckIntervalSeconds: toNumber(process.env.DEVICE_OFFLINE_CHECK_INTERVAL_SECONDS, 30)
  }
};

module.exports = config;