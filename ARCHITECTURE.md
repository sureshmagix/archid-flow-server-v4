# Archid Flow Server V4 Architecture Roadmap

This document defines the phased implementation roadmap for the Archid Flow V4 backend, direct MQTT access, client applications, testing, and production deployment.

| Phase | Branch | Implementation scope | Current status |
| --- | --- | --- | --- |
| **01 — Bootstrap** | `phase-01-bootstrap` | Project structure, Express, environment validation, MongoDB, error handling and health checks | Implemented |
| **02 — Authentication** | `phase-02-auth` | Signup, login, password hashing, JWT and authentication middleware | Implemented |
| **03 — Users and Profile** | `phase-03-users-profile` | Profiles, user management, roles, verification and one customer administrator per company | Implemented |
| **04 — Companies and Sites** | `phase-04-company-site` | Company/site management, user associations and company isolation | Implemented |
| **05 — Device Types** | `phase-05-device-types` | Device templates, capabilities, command definitions and telemetry schemas | Implemented |
| **06 — Device Inventory** | `phase-06-devices` | Hardware identity, inventory, ownership, site assignment, listing and lifecycle status | Implemented |
| **07 — Provisioning** | `phase-07-provisioning` | Factory registration, QC, claim codes, customer claiming and activation | Implemented |
| **08 — Sharing and Permissions** | `phase-08-sharing-permissions` | Device-specific view/control/admin permissions, sharing and revocation | Implemented |
| **09 — MQTT Core** | `phase-09-mqtt-core` | Backend MQTT connection, topic builder, incoming state/telemetry/ack processing and offline detection | Implemented |
| **09A — Stabilization and Baseline Tests** | `phase-09-stabilization-postman` | Resolve integration issues, reconcile duplicate files/models, verify database indexes and test Phases 01–09 through Postman | **Next** |
| **10 — Direct MQTT Access** | `phase-10-direct-mqtt-access` | Device access endpoint, scoped MQTT credentials, broker-enforced permissions, expiry, renewal and revocation | Pending |
| **11 — Realtime Command Contract** | `phase-11-realtime-command-lifecycle` | Direct app-to-broker commands, command IDs, device acknowledgements, timeout behavior, duplicate handling and state reconciliation | Pending |
| **12 — History and Audit** | `phase-12-history-audit` | Background command/result recording, telemetry history, pagination, retention and administrative audit events | Pending |
| **13 — Complete API Documentation and Tests** | `phase-13-swagger-postman` | Accurate OpenAPI, complete Postman collection, environments, automatic token/ID capture and negative permission tests | Partial groundwork |
| **14 — Production Readiness** | `phase-14-production` | PM2 configuration, Nginx/TLS, broker configuration, deployment guide, monitoring, backups and recovery tests | Partial groundwork |
| **15 — React Web Application** | `phase-15-react-web` | Login, dashboard, device pages, direct MQTT control, live readings and role-based management screens | Pending |
| **16 — React Native Mobile Application** | `phase-16-react-native` | Mobile login/dashboard, direct MQTT, QR claiming, BLE/SoftAP provisioning and connection lifecycle handling | Pending |
