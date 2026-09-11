# Test Phases 01–10 with Postman

The Phase 10 collection runs the REST checks for Phases 01–10 in dependency order. It contains 72 requests and 149 assertions. It creates isolated test records, captures tokens and IDs automatically, and tests successful and denied operations.

Use a dedicated test database. Each full run creates a new company, users, site, device type, and devices.

## 1. Prepare the API

```bash
git fetch origin
git checkout phase-10-direct-mqtt-access
git pull origin phase-10-direct-mqtt-access
npm ci
cp .env.example .env
```

Set `MONGODB_URI`, `JWT_SECRET`, and the `SUPER_ADMIN_*` values in `.env`, then create or update the test super admin:

```bash
npm run seed:superadmin
npm start
```

Keep the API terminal running. Confirm `http://127.0.0.1:4000/health` responds before starting Postman.

Phases 01–09 can run with `MQTT_ACCESS_ENABLED=false`. Phase 10 requires a Mosquitto 2.x Dynamic Security test broker and the access guard described in [Phase 10 — Direct MQTT access](phase-10-direct-mqtt-access.md). Set these values before starting both processes:

```dotenv
MQTT_ACCESS_ENABLED=true
MQTT_DYNSEC_URL=mqtt://127.0.0.1:1883
MQTT_DYNSEC_USERNAME=your_dynamic_security_admin
MQTT_DYNSEC_PASSWORD=your_dynamic_security_admin_password
MQTT_PUBLIC_URL=wss://your-test-broker.example/mqtt
```

Run the independent guard in another terminal:

```bash
npm run mqtt:guard
```

Wait for `MQTT access guard ready`. The Phase 10 grant endpoints return 503 until the guard and broker control connection are healthy.

## 2. Import into Postman

Import both files:

- `postman/phase-10-direct-mqtt.postman_collection.json`
- `postman/local.postman_environment.json`

Postman supports importing by selecting **Import** and choosing the files or dragging them into the Import dialog.

Select the **Archid Flow V4 Local Test** environment and set:

| Variable | Value |
| --- | --- |
| `baseUrl` | `http://127.0.0.1:4000` |
| `superAdminIdentifier` | The seeded super-admin email or mobile |
| `superAdminPassword` | The seeded super-admin password |

Do not append `/api/v1` to `baseUrl`. For a deployed test server, replace it with the HTTPS API origin.

## 3. Run the complete collection

Open **Archid Flow V4 — Phase 10 direct MQTT access**, select **Run**, keep the folder order unchanged, and run one iteration. Requests depend on tokens and resource IDs captured by earlier requests.

A successful complete run reports:

- 72 requests passed
- 149 assertions passed
- zero failed requests or assertions

The folders map directly to setup and Phases 01–10. Phase 10 verifies credential grant, company isolation, revoked-share denial, credential rotation, and idempotent revocation. The final requests deliberately revoke and clear the temporary MQTT credentials.

If you only configured Phases 01–09, select folders **00 Test setup** through **Phase 09 — MQTT Core**, plus **Common negative validation**. Run Phase 10 after the Dynamic Security broker and guard are configured.

## 4. Verify live MQTT in Postman

The Collection Runner tests the MQTT access REST lifecycle. Test actual app-to-broker-to-device delivery with a Postman MQTT request:

1. Run the collection through Phase 09, then run **55 Grant customer direct access**. Do not run requests 59–61 until the live MQTT check is finished.
2. Open the collection variables and copy `mqttBrokerUrl`, `mqttUsername`, `mqttPassword`, and `mqttClientId`.
3. In Postman, select **Add > MQTT**, enter `mqttBrokerUrl`, and configure the copied username, password, and client ID. When using the Postman web app, use the Postman Desktop Agent for MQTT connections.
4. Subscribe with QoS 1 to the exact values in `mqttStateTopic`, `mqttTelemetryTopic`, `mqttAckTopic`, and `mqttHeartbeatTopic`. Do not replace them with wildcards.
5. Publish a device-supported command to `mqttCommandTopic` with QoS 1 and retained messaging disabled. Example transport payload:

```json
{
  "commandId": "postman-001",
  "command": "set",
  "payload": {
    "on": true
  },
  "timestamp": "2026-09-11T00:00:00.000Z"
}
```

6. Confirm the device receives the command and that its acknowledgement or new state appears on the subscribed topic. The firmware or simulator must implement the same command payload contract.
7. Disconnect the MQTT request, then run **59 Rotate MQTT session**, reconnect with the new credentials if desired, and finish with requests **60** and **61** to revoke access.

The direct path for live traffic is frontend/mobile app ↔ MQTT broker ↔ device. The API is used only to authenticate the user and grant, rotate, or revoke scoped MQTT credentials; it does not relay each MQTT message.

## 5. Optional command-line regression checks

```bash
npm test
npm run test:postman
```

`npm run test:mqtt` performs the broker ACL integration test when `MOSQUITTO_BIN` and `MOSQUITTO_DYNSEC_PLUGIN` point to a local Mosquitto executable and Dynamic Security plugin. It uses an isolated test broker and does not contact production.
