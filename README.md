# Archid Flow Server V4

Node.js REST API, MongoDB and MQTT backend. Use Node 22.13+.

## Local setup

```bash
npm ci
cp .env.example .env
# Set MONGODB_URI, JWT_SECRET and your local MQTT configuration in .env.
npm run seed:superadmin
npm run dev
```

Swagger: `/api-docs`; JSON: `/api-docs.json`; health: `/health`.

## Phase 09 stabilization

- Fixed Mongoose 9 user validation (`next()` is no longer supported in pre hooks).
- Wired user routes to the existing service and validators. `POST /api/v1/users` creates users as super admin. Status changes persist `isActive`; legacy `accountStatus` input maps active to true and inactive/blocked to false.
- Fixed company isolation on device updates, status, connection and live state.
- One canonical User model; old import path delegates to it.
- Optimistic concurrency on device saves prevents two concurrent claims succeeding.
- Malformed/retained MQTT snapshots do not mark devices online; topic category must match the registered device.
- Profile rejects nested privileged fields and invalid scalar types.

## Tests

```bash
npm test
npm run test:postman
```

The Postman test runner creates a disposable MongoDB and HTTP server, seeds a temporary super admin, executes the committed collection and stops both. It never uses your production database. First run downloads a MongoDB test binary. Set `MONGOMS_SYSTEM_BINARY` to an installed compatible mongod if needed.

For manual Phase 01–10 testing, follow the [Postman guide](docs/postman-phase-01-to-10-guide.md). Import `postman/phase-10-direct-mqtt.postman_collection.json` and `postman/local.postman_environment.json`, then run the complete collection in order. Tokens and record IDs are captured automatically.

Run `npm run postman:build` after editing the generator. The older Phase 05 collection is retained for compatibility; the empty Phase 03 placeholder is not a runnable collection.

## Existing databases

```bash
npm run db:check-indexes
# Once reported duplicate company administrators are resolved:
npm run db:check-indexes -- --create
```

The default command is read-only. `--create` adds declared indexes without dropping data or indexes. A duplicate-admin finding requires deciding which existing account should retain that role; this script never makes that decision.

## Next branch

`phase-10-direct-mqtt-access` builds on this stabilization branch. The intended realtime path is app ↔ broker ↔ device. REST grants device access; it does not forward each command. Broker deployment and a real MQTT integration test remain required before production.

## Phase 10 direct access

See [direct MQTT access setup](docs/phase-10-direct-mqtt-access.md). The feature defaults to disabled until Mosquitto Dynamic Security and the independent supervised guard are configured.

Import `postman/phase-10-direct-mqtt.postman_collection.json` with the same local environment to run the baseline plus grant/renew/revoke APIs. Use its collection variables for manual MQTT testing; it revokes the final credentials at the end. To keep a temporary session for manual checks, run the grant request again after the full collection, then explicitly revoke it when finished.

```bash
npm run mqtt:guard
# Separate terminal, after guard/broker configuration:
npm start
```

For production use the supplied systemd supervision instead of these foreground commands. New devices use the canonical Phase 09 topic format. Existing noncanonical topics require explicit migration; no production data is changed by checkout.
