const config = require("../../config/env");
const { Device } = require("../devices/device.model");
const {
  connectMqtt,
  disconnectMqtt,
  getMqttStatus,
  setMqttSubscriptions
} = require("./mqtt.client");
const { getDeviceSubscriptionTopics } = require("./mqtt.topics");
const { handleMqttMessage } = require("./mqtt.messageHandler");

let isStarted = false;
let offlineMonitorTimer = null;

const subscribeToDeviceTopics = async client => {
  const topics = getDeviceSubscriptionTopics();

  client.subscribe(topics, { qos: 0 }, (error, granted) => {
    if (error) {
      setMqttSubscriptions([]);
      console.error("❌ MQTT subscribe failed:", error.message);
      return;
    }

    const grantedTopics = Array.isArray(granted)
      ? granted.map(item => item.topic)
      : topics;

    setMqttSubscriptions(grantedTopics);

    console.log("✅ MQTT subscribed topics:");
    grantedTopics.forEach(topic => console.log(`   - ${topic}`));
  });
};

const onMqttMessage = async (topic, message, packet) => {
  await handleMqttMessage({
    topic,
    message,
    packet
  });
};

const markOfflineDevices = async () => {
  const thresholdSeconds = config.deviceMonitoring.offlineThresholdSeconds;

  if (!thresholdSeconds || thresholdSeconds <= 0) {
    return;
  }

  const thresholdDate = new Date(Date.now() - thresholdSeconds * 1000);
  const now = new Date();

  const result = await Device.updateMany(
    {
      protocol: "mqtt",
      connectionStatus: "online",
      lastSeenAt: {
        $ne: null,
        $lte: thresholdDate
      }
    },
    {
      $set: {
        connectionStatus: "offline",
        "liveState.connectionStatus": "offline",
        "liveState.connectionUpdatedAt": now
      }
    }
  );

  if (result.modifiedCount > 0) {
    console.warn(`⚠️ Marked ${result.modifiedCount} MQTT device(s) offline`);
  }
};

const startOfflineMonitor = () => {
  if (offlineMonitorTimer) {
    return;
  }

  const intervalSeconds = config.deviceMonitoring.offlineCheckIntervalSeconds;

  if (!intervalSeconds || intervalSeconds <= 0) {
    console.warn("⚠️ DEVICE_OFFLINE_CHECK_INTERVAL_SECONDS is disabled");
    return;
  }

  offlineMonitorTimer = setInterval(() => {
    markOfflineDevices().catch(error => {
      console.error("❌ MQTT offline monitor failed:", error);
    });
  }, intervalSeconds * 1000);

  if (offlineMonitorTimer.unref) {
    offlineMonitorTimer.unref();
  }

  console.log(
    `✅ MQTT offline monitor started. Threshold: ${config.deviceMonitoring.offlineThresholdSeconds}s, interval: ${intervalSeconds}s`
  );
};

const stopOfflineMonitor = () => {
  if (!offlineMonitorTimer) {
    return;
  }

  clearInterval(offlineMonitorTimer);
  offlineMonitorTimer = null;

  console.log(" MQTT offline monitor stopped");
};

const startMqttListener = () => {
  if (isStarted) {
    return;
  }

  const client = connectMqtt({
    onConnect: subscribeToDeviceTopics,
    onMessage: onMqttMessage
  });

  if (!client) {
    return;
  }

  isStarted = true;
  startOfflineMonitor();
};

const stopMqttListener = async () => {
  if (!isStarted) {
    return;
  }

  stopOfflineMonitor();
  await disconnectMqtt();

  isStarted = false;
};

const getMqttRuntimeStatus = () => {
  return {
    listenerStarted: isStarted,
    offlineMonitorStarted: Boolean(offlineMonitorTimer),
    mqtt: getMqttStatus(),
    offlineThresholdSeconds: config.deviceMonitoring.offlineThresholdSeconds,
    offlineCheckIntervalSeconds:
      config.deviceMonitoring.offlineCheckIntervalSeconds
  };
};

module.exports = {
  startMqttListener,
  stopMqttListener,
  getMqttRuntimeStatus,
  markOfflineDevices
};