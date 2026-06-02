const fs = require("fs");

const controllerPath = "src/modules/devices/device.controller.js";
const routesPath = "src/modules/devices/device.routes.js";

let controller = fs.readFileSync(controllerPath, "utf8");
let routes = fs.readFileSync(routesPath, "utf8");

// ==========================
// PATCH device.controller.js
// ==========================

if (!controller.includes("../deviceSharing/deviceShare.model")) {
  controller = controller.replace(
`const { DeviceType } = require("../deviceTypes/deviceType.model");
const { Device } = require("./device.model");`,
`const { DeviceType } = require("../deviceTypes/deviceType.model");
const { Device } = require("./device.model");
const {
  DeviceShare,
  DEVICE_SHARE_PERMISSION_WEIGHT
} = require("../deviceSharing/deviceShare.model");`
  );
}

controller = controller.replace(
`const assertDeviceAccess = (req, device) => {
  if (isSuperAdmin(req.user)) {
    return;
  }

  if (!req.user?.company) {
    throw new ApiError(403, "Logged-in user is not assigned to any company");
  }

  const deviceCompanyId = device.company?._id || device.company;

  if (String(req.user.company) !== String(deviceCompanyId)) {
    throw new ApiError(403, "You do not have permission to access this device");
  }
};

const assertCanManageDevice = req => {
  if (isSuperAdmin(req.user) || isCustomerAdmin(req.user)) {
    return;
  }

  throw new ApiError(403, "Only super_admin or customer_admin can manage devices");
};

const assertCanControlDevice = req => {
  if (isSuperAdmin(req.user) || isCustomerAdmin(req.user) || isCustomerControlUser(req.user)) {
    return;
  }

  throw new ApiError(403, "You do not have permission to control this device");
};`,
`const getObjectId = value => value?._id || value;

const getDeviceCompanyId = device => getObjectId(device?.company);

const getDeviceOwnerId = device => getObjectId(device?.owner);

const activeShareConditions = () => ({
  status: "active",
  $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
});

const getAllowedSharePermissions = requiredPermission => {
  const requiredWeight = DEVICE_SHARE_PERMISSION_WEIGHT[requiredPermission] || 0;

  return Object.entries(DEVICE_SHARE_PERMISSION_WEIGHT)
    .filter(([, weight]) => weight >= requiredWeight)
    .map(([permission]) => permission);
};

const hasActiveDeviceSharePermission = async ({ deviceId, userId, permission }) => {
  if (!deviceId || !userId || !permission) {
    return false;
  }

  const share = await DeviceShare.findOne({
    device: deviceId,
    sharedWith: userId,
    permission: { $in: getAllowedSharePermissions(permission) },
    ...activeShareConditions()
  });

  return Boolean(share);
};

const getSharedDeviceIdsForUser = async ({ userId, permission }) => {
  if (!userId || !permission) {
    return [];
  }

  return DeviceShare.find({
    sharedWith: userId,
    permission: { $in: getAllowedSharePermissions(permission) },
    ...activeShareConditions()
  }).distinct("device");
};

const assertDeviceAccess = async (req, device, requiredPermission = "view") => {
  if (isSuperAdmin(req.user)) {
    return;
  }

  if (!req.user?.company) {
    throw new ApiError(403, "Logged-in user is not assigned to any company");
  }

  const deviceCompanyId = getDeviceCompanyId(device);

  if (!deviceCompanyId || String(req.user.company) !== String(deviceCompanyId)) {
    throw new ApiError(403, "You do not have permission to access this device");
  }

  if (isCustomerAdmin(req.user)) {
    return;
  }

  const deviceOwnerId = getDeviceOwnerId(device);

  if (deviceOwnerId && String(deviceOwnerId) === String(req.user?._id)) {
    return;
  }

  const hasSharePermission = await hasActiveDeviceSharePermission({
    deviceId: device._id,
    userId: req.user?._id,
    permission: requiredPermission
  });

  if (hasSharePermission) {
    return;
  }

  throw new ApiError(403, \`You need \${requiredPermission} permission for this device\`);
};

const assertCanManageDevice = async (req, device = null) => {
  if (isSuperAdmin(req.user) || isCustomerAdmin(req.user)) {
    return;
  }

  if (device) {
    await assertDeviceAccess(req, device, "admin");
    return;
  }

  throw new ApiError(403, "Only super_admin or customer_admin can create devices");
};

const assertCanControlDevice = async (req, device) => {
  if (isSuperAdmin(req.user) || isCustomerAdmin(req.user)) {
    return;
  }

  await assertDeviceAccess(req, device, "control");
};`
);

controller = controller.replace(
`const createDevice = async (req, res) => {
  assertCanManageDevice(req);`,
`const createDevice = async (req, res) => {
  await assertCanManageDevice(req);`
);

controller = controller.replace(
`  const filter = {};

  if (isSuperAdmin(req.user)) {`,
`  const filter = {};
  const andConditions = [];

  if (isSuperAdmin(req.user)) {`
);

controller = controller.replace(
`    filter.company = req.user.company;
  }

  const directFilters = [`,
`    filter.company = req.user.company;

    if (!isCustomerAdmin(req.user)) {
      const sharedDeviceIds = await getSharedDeviceIdsForUser({
        userId: req.user._id,
        permission: "view"
      });

      andConditions.push({
        $or: [
          { owner: req.user._id },
          { _id: { $in: sharedDeviceIds } }
        ]
      });
    }
  }

  const directFilters = [`
);

controller = controller.replace(
`    filter.$or = [
      { name: regex },
      { displayName: regex },
      { deviceCode: regex },
      { hardwareId: regex },
      { serialNumber: regex },
      { macAddress: regex },
      { firmwareVersion: regex },
      { mqttTopicBase: regex },
      { batchNumber: regex }
    ];
  }

  const [devices, total] = await Promise.all([`,
`    andConditions.push({
      $or: [
        { name: regex },
        { displayName: regex },
        { deviceCode: regex },
        { hardwareId: regex },
        { serialNumber: regex },
        { macAddress: regex },
        { firmwareVersion: regex },
        { mqttTopicBase: regex },
        { batchNumber: regex }
      ]
    });
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }

  const [devices, total] = await Promise.all([`
);

controller = controller.replace(
`  assertDeviceAccess(req, device);

  return sendResponse(res, 200, "Device fetched successfully", {`,
`  await assertDeviceAccess(req, device, "view");

  return sendResponse(res, 200, "Device fetched successfully", {`
);

controller = controller.replace(
`const updateDevice = async (req, res) => {
  assertCanManageDevice(req);

  const { deviceId } = req.params;`,
`const updateDevice = async (req, res) => {
  const { deviceId } = req.params;`
);

controller = controller.replace(
`  ensureLifecycleObjects(device);
  assertDeviceAccess(req, device);`,
`  ensureLifecycleObjects(device);
  await assertCanManageDevice(req, device);`
);

controller = controller.replace(
`const updateDeviceStatus = async (req, res) => {
  assertCanManageDevice(req);

  const { deviceId } = req.params;`,
`const updateDeviceStatus = async (req, res) => {
  const { deviceId } = req.params;`
);

controller = controller.replace(
`  assertDeviceAccess(req, device);

  device.operationalStatus = operationalStatus;`,
`  await assertCanManageDevice(req, device);

  device.operationalStatus = operationalStatus;`
);

controller = controller.replace(
`const updateDeviceLiveState = async (req, res) => {
  assertCanControlDevice(req);

  const { deviceId } = req.params;`,
`const updateDeviceLiveState = async (req, res) => {
  const { deviceId } = req.params;`
);

controller = controller.replace(
`  ensureLifecycleObjects(device);
  assertDeviceAccess(req, device);

  if (payload.connectionStatus) {`,
`  ensureLifecycleObjects(device);
  await assertCanControlDevice(req, device);

  if (payload.connectionStatus) {`
);

controller = controller.replace(
`const updateDeviceConnection = async (req, res) => {
  assertCanControlDevice(req);

  const { deviceId } = req.params;`,
`const updateDeviceConnection = async (req, res) => {
  const { deviceId } = req.params;`
);

controller = controller.replace(
`  ensureLifecycleObjects(device);
  assertDeviceAccess(req, device);

  if (payload.connectionStatus) {`,
`  ensureLifecycleObjects(device);
  await assertCanControlDevice(req, device);

  if (payload.connectionStatus) {`
);

fs.writeFileSync(controllerPath, controller);

// ==========================
// PATCH device.routes.js
// ==========================

routes = routes.replace(
`// CONNECTION STATUS UPDATE
// ==========================
router.patch(
  "/:deviceId/connection",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER
  ),`,
`// CONNECTION STATUS UPDATE
// ==========================
// Controller enforces Phase 08 device sharing permission:
// - super_admin and customer_admin can update
// - users with active control/admin share can update
router.patch(
  "/:deviceId/connection",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),`
);

routes = routes.replace(
`// LIVE STATE UPDATE
// ==========================
router.patch(
  "/:deviceId/live-state",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER
  ),`,
`// LIVE STATE UPDATE
// ==========================
// Controller enforces Phase 08 device sharing permission:
// - super_admin and customer_admin can update
// - users with active control/admin share can update
router.patch(
  "/:deviceId/live-state",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),`
);

routes = routes.replace(
`// OPERATIONAL STATUS UPDATE
// ==========================
router.patch(
  "/:deviceId/status",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN),`,
`// OPERATIONAL STATUS UPDATE
// ==========================
// Controller enforces Phase 08 admin permission.
router.patch(
  "/:deviceId/status",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),`
);

routes = routes.replace(
`// DEVICE UPDATE
// Keep this after specific PATCH routes.
// ==========================
router.patch(
  "/:deviceId",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN),`,
`// DEVICE UPDATE
// Keep this after specific PATCH routes.
// ==========================
// Controller enforces Phase 08 admin permission.
router.patch(
  "/:deviceId",
  authMiddleware,
  requireRole(
    ROLES.SUPER_ADMIN,
    ROLES.CUSTOMER_ADMIN,
    ROLES.CUSTOMER_CONTROL_USER,
    ROLES.CUSTOMER_VIEW_USER
  ),`
);

fs.writeFileSync(routesPath, routes);

console.log("Phase 08 device permission integration patched successfully.");
