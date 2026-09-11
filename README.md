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

For manual Postman use, import `postman/phase-09-baseline.postman_collection.json` and `postman/local.postman_environment.json`. Set `superAdminIdentifier`, `superAdminPassword` and `baseUrl`, select the environment, then run the complete collection **in order**. Tokens and record IDs are captured in collection variables. Use a test database: each run creates new records. QC inputs are simulated and do not prove hardware/MQTT operation. Clear collection variables after use because they contain test credentials and tokens.

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
