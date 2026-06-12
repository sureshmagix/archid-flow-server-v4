const { Device } = require("../devices/device.model");
const {
  DEVICE_MQTT_MESSAGE_TYPES,
  buildDeviceBaseTopic,
  parseDeviceTopic
} = require("./mqtt.topics");
const {
  isPlainObject,
  parseJsonPayload,
  sanitizePayloadForDb
} = require("./mqtt.utils");

const buildStateObject = payload => {
  if (isPlainObject(payload)) {
    return payload;
  }

  return {
    value: payload
  };
};

const applyLiveStateUpdate = ({ setFields, messageType, payload, receivedAt }) => {
  if (messageType === DEVICE_MQTT_MESSAGE_TYPES.HEARTBEAT) {
    if (payload.liveState !== undefined) {
      setFields.liveState = {
        ...buildStateObject(payload.liveState),
        updatedAt: receivedAt
      };
      return;
    }

    if (payload.state !== undefined) {
      setFields.liveState = {
        ...buildStateObject(payload.state),
        updatedAt: receivedAt
      };
      return;
    }

    setFields["liveState.heartbeat"] = payload;
    setFields["liveState.lastHeartbeatAt"] = receivedAt;
    return;
  }

  if (messageType === DEVICE_MQTT_MESSAGE_TYPES.STATE) {
    const statePayload = payload.state !== undefined ? payload.state : payload;

    setFields.liveState = {
      ...buildStateObject(statePayload),
      updatedAt: receivedAt
    };
    return;
  }

  if (messageType === DEVICE_MQTT_MESSAGE_TYPES.TELEMETRY) {
    const telemetryPayload =
      payload.telemetry !== undefined ? payload.telemetry : payload;

    setFields["liveState.telemetry"] = telemetryPayload;
    setFields["liveState.lastTelemetryAt"] = receivedAt;
    return;
  }

  if (messageType === DEVICE_MQTT_MESSAGE_TYPES.ACK) {
    setFields["liveState.lastAck"] = payload;
    setFields["liveState.lastAckAt"] = receivedAt;
  }
};

const handleMqttMessage = async ({ topic, message, packet }) => {
  const parsedTopic = parseDeviceTopic(topic);

  if (!parsedTopic.isValid) {
    console.warn(`⚠️ Ignoring MQTT topic: ${topic}. Reason: ${parsedTopic.reason}`);
    return {
      handled: false,
      reason: parsedTopic.reason
    };
  }

  const parsedPayload = parseJsonPayload(message);
  const payload = sanitizePayloadForDb(parsedPayload.data);
  const receivedAt = new Date();

  const device = await Device.findOne({
    hardwareId: parsedTopic.hardwareId
  })
    .select("_id hardwareId deviceType protocol")
    .populate("deviceType", "category name slug");

  if (!device) {
    console.warn(
      `⚠️ MQTT message received for unknown hardwareId: ${parsedTopic.hardwareId}`
    );

    return {
      handled: false,
      reason: "DEVICE_NOT_FOUND",
      hardwareId: parsedTopic.hardwareId
    };
  }

  const category = parsedTopic.category || device.deviceType?.category || "device";

  const setFields = {
    connectionStatus: "online",
    lastSeenAt: receivedAt,

    "mqtt.baseTopic": buildDeviceBaseTopic({
      category,
      hardwareId: device.hardwareId
    }),

    "mqtt.lastPayload": {
      topic,
      category,
      messageType: parsedTopic.messageType,
      payload,
      parsed: parsedPayload.ok,
      qos: packet?.qos ?? null,
      retain: packet?.retain ?? false,
      receivedAt
    }
  };

  if (payload.clientId) {
    setFields["mqtt.clientId"] = String(payload.clientId).trim();
  }

  if (payload.firmwareVersion) {
    setFields.firmwareVersion = String(payload.firmwareVersion).trim();
  }

  if (payload.rssi !== undefined && payload.rssi !== null) {
    setFields["wifi.rssi"] = Number(payload.rssi);
  }

  if (parsedTopic.messageType === DEVICE_MQTT_MESSAGE_TYPES.HEARTBEAT) {
    setFields.lastHeartbeatAt = receivedAt;
    setFields["mqtt.lastHeartbeatAt"] = receivedAt;
    setFields["qc.mqttConnected"] = true;
    setFields["qc.heartbeatReceived"] = true;
  }

  if (parsedTopic.messageType === DEVICE_MQTT_MESSAGE_TYPES.ACK) {
    setFields["qc.commandAckReceived"] = true;
  }

  applyLiveStateUpdate({
    setFields,
    messageType: parsedTopic.messageType,
    payload,
    receivedAt
  });

  const updatedDevice = await Device.findByIdAndUpdate(
    device._id,
    {
      $set: setFields
    },
    {
      new: true
    }
  ).select(
    "_id hardwareId connectionStatus lastSeenAt lastHeartbeatAt mqtt liveState"
  );

  console.log(
    `✅ MQTT ${parsedTopic.messageType} updated device ${parsedTopic.hardwareId}`
  );

  return {
    handled: true,
    deviceId: updatedDevice._id,
    hardwareId: updatedDevice.hardwareId,
    messageType: parsedTopic.messageType
  };
};

module.exports = {
  handleMqttMessage
};