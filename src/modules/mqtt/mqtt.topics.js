const config = require("../../config/env");
const {
  normalizeHardwareId,
  safeTopicSegment
} = require("./mqtt.utils");

const DEVICE_MQTT_MESSAGE_TYPES = {
  HEARTBEAT: "heartbeat",
  STATE: "state",
  TELEMETRY: "telemetry",
  ACK: "ack"
};

const getMqttRootTopic = () => {
  const namespace = safeTopicSegment(config.mqtt.namespace, "archid");
  const apiVersion = safeTopicSegment(config.mqtt.apiVersion, "v4");

  return `${namespace}/${apiVersion}`;
};

const buildDeviceBaseTopic = ({ category = "device", hardwareId }) => {
  const normalizedHardwareId = normalizeHardwareId(hardwareId);

  if (!normalizedHardwareId) {
    throw new Error("hardwareId is required to build MQTT device topic");
  }

  return [
    getMqttRootTopic(),
    "devices",
    safeTopicSegment(category, "device"),
    normalizedHardwareId
  ].join("/");
};

const buildDeviceTopic = ({ category = "device", hardwareId, messageType }) => {
  if (!messageType) {
    throw new Error("messageType is required to build MQTT device topic");
  }

  return `${buildDeviceBaseTopic({ category, hardwareId })}/${safeTopicSegment(messageType)}`;
};

const buildDeviceTopics = ({ category = "device", hardwareId }) => {
  return {
    base: buildDeviceBaseTopic({ category, hardwareId }),
    heartbeat: buildDeviceTopic({
      category,
      hardwareId,
      messageType: DEVICE_MQTT_MESSAGE_TYPES.HEARTBEAT
    }),
    state: buildDeviceTopic({
      category,
      hardwareId,
      messageType: DEVICE_MQTT_MESSAGE_TYPES.STATE
    }),
    telemetry: buildDeviceTopic({
      category,
      hardwareId,
      messageType: DEVICE_MQTT_MESSAGE_TYPES.TELEMETRY
    }),
    ack: buildDeviceTopic({
      category,
      hardwareId,
      messageType: DEVICE_MQTT_MESSAGE_TYPES.ACK
    })
  };
};

const getDeviceSubscriptionTopics = () => {
  const root = getMqttRootTopic();

  return [
    `${root}/devices/+/+/${DEVICE_MQTT_MESSAGE_TYPES.HEARTBEAT}`,
    `${root}/devices/+/+/${DEVICE_MQTT_MESSAGE_TYPES.STATE}`,
    `${root}/devices/+/+/${DEVICE_MQTT_MESSAGE_TYPES.TELEMETRY}`,
    `${root}/devices/+/+/${DEVICE_MQTT_MESSAGE_TYPES.ACK}`
  ];
};

const parseDeviceTopic = topic => {
  const parts = String(topic || "").split("/").filter(Boolean);
  const rootParts = getMqttRootTopic().split("/");

  const result = {
    isValid: false,
    topic,
    namespace: null,
    apiVersion: null,
    category: null,
    hardwareId: null,
    messageType: null,
    reason: null
  };

  if (parts.length !== 6) {
    return {
      ...result,
      reason: "Topic must match namespace/apiVersion/devices/category/hardwareId/messageType"
    };
  }

  const [namespace, apiVersion, resource, category, hardwareId, messageType] = parts;

  if (namespace !== rootParts[0] || apiVersion !== rootParts[1]) {
    return {
      ...result,
      namespace,
      apiVersion,
      reason: "Topic namespace/apiVersion does not match backend MQTT config"
    };
  }

  if (resource !== "devices") {
    return {
      ...result,
      namespace,
      apiVersion,
      reason: "Topic resource must be devices"
    };
  }

  const allowedTypes = Object.values(DEVICE_MQTT_MESSAGE_TYPES);

  if (!allowedTypes.includes(messageType)) {
    return {
      ...result,
      namespace,
      apiVersion,
      category,
      hardwareId: normalizeHardwareId(hardwareId),
      messageType,
      reason: "Unsupported MQTT device message type"
    };
  }

  return {
    isValid: true,
    topic,
    namespace,
    apiVersion,
    category,
    hardwareId: normalizeHardwareId(hardwareId),
    messageType,
    reason: null
  };
};

module.exports = {
  DEVICE_MQTT_MESSAGE_TYPES,
  getMqttRootTopic,
  buildDeviceBaseTopic,
  buildDeviceTopic,
  buildDeviceTopics,
  getDeviceSubscriptionTopics,
  parseDeviceTopic
};