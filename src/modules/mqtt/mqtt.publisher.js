const { publishRaw } = require("./mqtt.client");
const { buildDeviceTopic } = require("./mqtt.topics");
const { sanitizePayloadForDb } = require("./mqtt.utils");

const publishJson = async (topic, payload = {}, options = {}) => {
  const sanitizedPayload = sanitizePayloadForDb(payload);
  const message = JSON.stringify(sanitizedPayload);

  return publishRaw(topic, message, {
    qos: 0,
    retain: false,
    ...options
  });
};

const publishDeviceMessage = async ({
  category = "device",
  hardwareId,
  messageType,
  payload = {},
  qos = 0,
  retain = false
}) => {
  const topic = buildDeviceTopic({
    category,
    hardwareId,
    messageType
  });

  return publishJson(topic, payload, {
    qos,
    retain
  });
};

const publishDeviceMessageFromDevice = async ({
  device,
  messageType,
  payload = {},
  qos = 0,
  retain = false
}) => {
  if (!device) {
    throw new Error("device is required");
  }

  const category =
    device.deviceType?.category ||
    device.deviceTypeCategory ||
    device.category ||
    "device";

  return publishDeviceMessage({
    category,
    hardwareId: device.hardwareId,
    messageType,
    payload,
    qos,
    retain
  });
};

module.exports = {
  publishJson,
  publishDeviceMessage,
  publishDeviceMessageFromDevice
};