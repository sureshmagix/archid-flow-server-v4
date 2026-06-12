const crypto = require("crypto");

const MAX_DB_PAYLOAD_BYTES = 64 * 1024;

const normalizeHardwareId = value => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim().toUpperCase();
};

const safeTopicSegment = (value, fallback = "unknown") => {
  const raw = value === undefined || value === null || value === "" ? fallback : value;

  const segment = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return segment || fallback;
};

const truncateString = (value, maxLength = MAX_DB_PAYLOAD_BYTES) => {
  const text = String(value);

  if (Buffer.byteLength(text, "utf8") <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength);
};

const isPlainObject = value => {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
};

const parseJsonPayload = message => {
  const raw = Buffer.isBuffer(message)
    ? message.toString("utf8")
    : String(message ?? "");

  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      ok: true,
      raw,
      data: {}
    };
  }

  try {
    const parsed = JSON.parse(trimmed);

    return {
      ok: true,
      raw,
      data: isPlainObject(parsed) ? parsed : { value: parsed }
    };
  } catch (error) {
    return {
      ok: false,
      raw,
      data: {
        raw: truncateString(raw),
        parseError: error.message
      }
    };
  }
};

const sanitizePayloadForDb = payload => {
  try {
    const json = JSON.stringify(payload ?? {});

    if (Buffer.byteLength(json, "utf8") <= MAX_DB_PAYLOAD_BYTES) {
      return JSON.parse(json);
    }

    return {
      truncated: true,
      raw: truncateString(json)
    };
  } catch (error) {
    return {
      serializationError: error.message,
      value: String(payload)
    };
  }
};

const createBackendClientId = () => {
  const random = crypto.randomBytes(4).toString("hex");
  return `archid-backend-${process.pid}-${random}`;
};

module.exports = {
  MAX_DB_PAYLOAD_BYTES,
  normalizeHardwareId,
  safeTopicSegment,
  parseJsonPayload,
  sanitizePayloadForDb,
  createBackendClientId,
  isPlainObject
};