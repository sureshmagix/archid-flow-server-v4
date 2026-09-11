# Phase 10 — Direct MQTT access

Realtime traffic is **app ↔ MQTT broker ↔ device**. REST grants/renews/revokes credentials; it never forwards individual commands. The existing backend listener persists incoming device messages independently.

## API

Bearer login token required; device must be claimed, active, MQTT-enabled, and belong to an active company/device type.

- `POST /api/v1/devices/:deviceId/mqtt-access` — empty body; returns `201 { success, data: { access } }`.
- `POST /api/v1/devices/:deviceId/mqtt-access/:sessionId/renew` — empty body; deletes old broker credentials and returns a new session. Reconnect with the new credentials.
- `DELETE /api/v1/devices/:deviceId/mqtt-access/:sessionId` — revokes the caller's session and disconnects it. Idempotent for an already revoked session. Broker failure returns 503 and leaves durable cleanup work for the guard.

`access` includes brokerUrl, username, password, clientId, sessionId, expiresAt, permission, exact subscribe/publish topic lists, MQTT options and command options. Responses use `Cache-Control: no-store`. Passwords are generated randomly, delivered once, and never stored in MongoDB or logged. Mosquitto stores their password hashes.

Company isolation is enforced even for customer administrators. Owners/admins receive control; active shares determine other permissions. A globally view-only user is always subscribe-only. Client IDs are bound to credentials. Apps cannot choose topic names, credentials, permissions or TTL. New devices now use the shared `archid/v4/devices/<category>/<HARDWARE_ID>` builder. Any noncanonical existing device topic must be migrated explicitly before using this feature: update firmware and then PATCH its `mqttTopicBase` through the device API. The grant endpoint deliberately returns 409 instead of silently changing live device topics.

## Browser/mobile behavior

1. Login and fetch a device using REST.
2. Request MQTT access; connect using returned WSS URL and credentials.
3. Subscribe to the returned exact topics; do not use wildcards.
4. Publish only to the returned command topic with `retain:false`. Display pending until actual state/ack arrives.
5. Revoke access when leaving a device/logout. On expiry/connection failure, obtain fresh access through REST. Never reconnect forever with expired credentials.
6. Renew before expiry and reconnect using the rotated clientId/password. Each tab/device screen needs its own session.

Default lease is 900 seconds, bounded by the REST token expiry and share expiry (configured TTL must be 30–3600). Use clean sessions. The command contract, device deduplication, persistent command history and simulator firmware behavior are Phase 11; Phase 10 grants transport access only. MQTT QoS 1 is not proof of physical execution.

## Broker and guard requirements

Use Mosquitto 2.x Dynamic Security. Official reference: https://mosquitto.org/documentation/dynamic-security/ . Plain username/password or an API JWT alone does not install topic permissions.

1. Back up the existing broker configuration. Provision and test a separate test broker first.
2. Enable the Dynamic Security plugin with its own persistent config. Provision existing device and backend clients/roles as part of migration; do not remove the current password backend until those identities are tested.
3. Set Dynamic Security default `publishClientSend`, `publishClientReceive`, and `subscribe` ACL access to false (deny). Explicitly grant device/backend roles the required topics. The guard refuses readiness with permissive defaults. Reserve `archid-app-` usernames/role names for this application. Do not manually assign groups/other roles to them. Each temporary role explicitly denies all unmatched application and control/system topics.
4. Create a separate Dynamic Security administration account. Allow only the control API and response topic; keep credentials on the server. Set `MQTT_DYNSEC_URL`, `MQTT_DYNSEC_USERNAME`, `MQTT_DYNSEC_PASSWORD`. Use localhost or verified TLS; never expose the admin listener unencrypted to the internet.
5. Configure WSS/TLS at `MQTT_PUBLIC_URL` and `allow_anonymous false`. Never disable certificate verification in clients.
6. **Deploy exactly one independent guard process per broker/database**, using the supplied systemd unit with paths/user adjusted. Install the supplied Mosquitto drop-in to stop the broker if the guard stops or its watchdog expires. Install `systemd-notify`. Do not use the API process itself as the sole expiry mechanism.
7. Set `MQTT_ACCESS_ENABLED=true` for API and guard. Restart the guard and broker together; wait for “MQTT access guard ready”. Access endpoints fail with 503 until a recent healthy guard heartbeat exists.

Example (after configuration review and test-broker validation):

```bash
sudo systemctl daemon-reload
sudo systemctl enable archid-mqtt-access-guard
sudo systemctl restart archid-mqtt-access-guard mosquitto
```

### Expiry and outage behavior

Dynamic Security does not provide native credential TTL. The guard rechecks expiry, user activity, company/device status, ownership, shares and topic changes every **5 seconds plus processing time**. Revocation is bounded by that interval while healthy, not instantaneous at expiresAt. It deletes credentials before role cleanup and rechecks current permissions for every active session. On guard restart, all `archid-app-` sessions are purged and apps must reconnect with new grants. Records are never TTL-deleted before broker cleanup.

On database/broker-control failure the guard attempts to purge temporary broker clients, then exits. The required systemd coupling stops the broker on guard failure, and the watchdog detects a stalled guard. This trades broker availability for fail-closed access; device MQTT traffic also pauses if the broker is stopped. A 30-second watchdog is an outage detection bound, not a zero-delay expiry guarantee. Do not enable direct access in production without this supervision. After an outage, restart guard and broker together after fixing the cause.

## Validation

`npm test` includes policy/database/guard tests. `npm run test:postman` retains the Phase 09 regression suite. `npm run test:mqtt` runs an isolated real Mosquitto Dynamic Security integration test when `MOSQUITTO_BIN` and `MOSQUITTO_DYNSEC_PLUGIN` point to installed executables/library. See its output for test results; neither script contacts the production broker.
