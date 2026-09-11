# Branch verification

Base reviewed: `b84ef0f1bb656645d22674ac3a0312aa8256fe4e`.

## Phase 09 stabilization

- Node test runner: canonical Mongoose user validation, duplicate company-admin index enforcement, optimistic device concurrency, topic validation, and retained/malformed MQTT rejection passed.
- Committed Postman baseline executed through Newman against a disposable MongoDB and HTTP API: **54 requests, 109 assertions, zero failures**.
- Includes blocked-token rejection, profile privilege rejection, share/revoke flows and four cross-company device update rejection cases.

## Phase 10 direct MQTT access

- **9 Node tests passed** (policy, real MongoDB lifecycle and Phase 09 regressions).
- Real Mosquitto **2.0.22 Dynamic Security** test on isolated loopback broker: exact-topic subscriptions, wildcard/cross-device denial, client-ID binding, direct command delivery, device acknowledgement, viewer state delivery, publish denial, caller-owned sessions, credential rotation, active-client disconnection on expiry/revocation, restart cleanup and preservation of device credentials passed.
- Combined committed Postman collection: **61 requests, 127 assertions, zero failures**.
- Failure-injection lifecycle test covers broker provisioning failure leaving durable cleanup work and stale guard heartbeat rejection.

The integration broker used TCP on loopback; production WSS/TLS termination, installed broker plugins, systemd watchdog/coupling and physical device firmware were not deployed or tested here. The systemd configuration is a deployment prerequisite, not a claim that the production broker is configured. Expiry/revocation is guard-based (5-second interval plus processing time), not native Mosquitto token expiry. See the Phase 10 setup document for watchdog and availability behavior.

Phase 11 command IDs/deduplication/timeout firmware contract and durable history remain future work. These tests demonstrate transport and access permissions; they do not prove physical motor/relay operation.
