const mqtt = require("mqtt");
const config = require("../../config/env");
const { createBackendClientId } = require("./mqtt.utils");

let client = null;

const runtimeStatus = {
  configured: Boolean(config.mqtt.url),
  clientId: null,
  url: config.mqtt.url || null,
  connected: false,
  connecting: false,
  reconnecting: false,
  lastConnectAt: null,
  lastReconnectAt: null,
  lastCloseAt: null,
  lastOfflineAt: null,
  lastError: null,
  subscriptions: []
};

const buildMqttOptions = () => {
  const options = {
    clientId: createBackendClientId(),
    clean: config.mqtt.clean,
    reconnectPeriod: config.mqtt.reconnectPeriod,
    connectTimeout: config.mqtt.connectTimeout,
    keepalive: 60,
    resubscribe: true,
    reconnectOnConnackError: true
  };

  if (config.mqtt.username) {
    options.username = config.mqtt.username;
  }

  if (config.mqtt.password) {
    options.password = config.mqtt.password;
  }

  return options;
};

const setMqttSubscriptions = subscriptions => {
  runtimeStatus.subscriptions = Array.isArray(subscriptions) ? subscriptions : [];
};

const connectMqtt = ({ onConnect, onMessage } = {}) => {
  if (client) {
    return client;
  }

  if (!config.mqtt.url) {
    console.warn("⚠️ MQTT_URL is not configured. MQTT client will not start.");
    runtimeStatus.configured = false;
    return null;
  }

  const options = buildMqttOptions();

  runtimeStatus.clientId = options.clientId;
  runtimeStatus.connecting = true;
  runtimeStatus.lastError = null;

  console.log("====================================");
  console.log(" MQTT");
  console.log("====================================");
  console.log(`MQTT URL: ${config.mqtt.url}`);
  console.log(`MQTT Client ID: ${options.clientId}`);
  console.log("====================================");

  client = mqtt.connect(config.mqtt.url, options);

  client.on("connect", connack => {
    runtimeStatus.connected = true;
    runtimeStatus.connecting = false;
    runtimeStatus.reconnecting = false;
    runtimeStatus.lastConnectAt = new Date().toISOString();
    runtimeStatus.lastError = null;

    console.log("✅ MQTT connected");

    if (onConnect) {
      Promise.resolve(onConnect(client, connack)).catch(error => {
        runtimeStatus.lastError = error.message;
        console.error("❌ MQTT onConnect handler failed:", error);
      });
    }
  });

  client.on("reconnect", () => {
    runtimeStatus.connected = false;
    runtimeStatus.connecting = false;
    runtimeStatus.reconnecting = true;
    runtimeStatus.lastReconnectAt = new Date().toISOString();

    console.warn(" MQTT reconnecting...");
  });

  client.on("offline", () => {
    runtimeStatus.connected = false;
    runtimeStatus.connecting = false;
    runtimeStatus.reconnecting = false;
    runtimeStatus.lastOfflineAt = new Date().toISOString();

    console.warn("⚠️ MQTT offline");
  });

  client.on("close", () => {
    runtimeStatus.connected = false;
    runtimeStatus.connecting = false;
    runtimeStatus.reconnecting = false;
    runtimeStatus.lastCloseAt = new Date().toISOString();

    console.warn(" MQTT connection closed");
  });

  client.on("end", () => {
    runtimeStatus.connected = false;
    runtimeStatus.connecting = false;
    runtimeStatus.reconnecting = false;
    runtimeStatus.lastCloseAt = new Date().toISOString();

    console.log(" MQTT client ended");
  });

  client.on("error", error => {
    runtimeStatus.lastError = error.message;
    runtimeStatus.connected = false;
    runtimeStatus.connecting = false;

    console.error("❌ MQTT error:", error.message);
  });

  client.on("message", (topic, message, packet) => {
    if (!onMessage) {
      return;
    }

    Promise.resolve(onMessage(topic, message, packet)).catch(error => {
      runtimeStatus.lastError = error.message;
      console.error("❌ MQTT message handler failed:", error);
    });
  });

  return client;
};

const getMqttClient = () => client;

const isMqttConnected = () => {
  return Boolean(client && client.connected);
};

const publishRaw = (topic, payload, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!client) {
      return reject(new Error("MQTT client has not been started"));
    }

    if (!client.connected) {
      return reject(new Error("MQTT client is not connected"));
    }

    const publishOptions = {
      qos: 0,
      retain: false,
      ...options
    };

    client.publish(topic, payload, publishOptions, error => {
      if (error) {
        return reject(error);
      }

      return resolve({
        topic,
        qos: publishOptions.qos,
        retain: publishOptions.retain,
        publishedAt: new Date().toISOString()
      });
    });
  });
};

const disconnectMqtt = () => {
  return new Promise(resolve => {
    if (!client) {
      return resolve();
    }

    const activeClient = client;
    client = null;

    const timeout = setTimeout(() => {
      console.warn("⚠️ MQTT shutdown timeout. Continuing shutdown.");
      resolve();
    }, 3000);

    if (timeout.unref) {
      timeout.unref();
    }

    activeClient.end(false, {}, () => {
      clearTimeout(timeout);

      runtimeStatus.connected = false;
      runtimeStatus.connecting = false;
      runtimeStatus.reconnecting = false;
      runtimeStatus.lastCloseAt = new Date().toISOString();
      runtimeStatus.subscriptions = [];

      console.log(" MQTT client disconnected");
      resolve();
    });
  });
};

const getMqttStatus = () => {
  return {
    ...runtimeStatus,
    connected: isMqttConnected()
  };
};

module.exports = {
  connectMqtt,
  disconnectMqtt,
  getMqttClient,
  getMqttStatus,
  isMqttConnected,
  publishRaw,
  setMqttSubscriptions
};