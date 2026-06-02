const User = require("../users/user.model");
const { Device } = require("../devices/device.model");

const {
  DeviceShare,
  DEVICE_SHARE_PERMISSION_WEIGHT
} = require("./deviceShare.model");

const ApiError = require("../../common/utils/ApiError");
const sendResponse = require("../../common/utils/sendResponse");
const { ROLES } = require("../../common/constants/roles");

const isSuperAdmin = user => user?.role === ROLES.SUPER_ADMIN;
const isCustomerAdmin = user => user?.role === ROLES.CUSTOMER_ADMIN;

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const isTrue = value => value === true || value === "true";

const escapeRegex = value => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getObjectId = value => value?._id || value;

const getDeviceCompanyId = device => getObjectId(device?.company);

const activeShareConditions = () => ({
  status: "active",
  $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
});

const populateDeviceShareQuery = query =>
  query
    .populate(
      "device",
      "name displayName deviceCode hardwareId company site owner operationalStatus connectionStatus provisioningStatus"
    )
    .populate("company", "name code status")
    .populate("sharedWith", "name email mobile role company isActive")
    .populate("sharedBy", "name email mobile role company")
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role")
    .populate("revokedBy", "name email role");

const expirePastActiveShares = async () => {
  await DeviceShare.updateMany(
    {
      status: "active",
      expiresAt: { $ne: null, $lte: new Date() }
    },
    {
      $set: {
        status: "expired",
        updatedAt: new Date()
      }
    }
  );
};

const refreshShareStatus = async share => {
  if (!share) {
    return share;
  }

  if (share.status === "active" && share.expiresAt && share.expiresAt <= new Date()) {
    share.status = "expired";
    await share.save();
  }

  return share;
};

const handleDuplicateShare = error => {
  if (error && error.code === 11000) {
    throw new ApiError(409, "Active share already exists for this device and user");
  }

  throw error;
};

const hasActiveSharePermission = async ({ deviceId, userId, permission }) => {
  if (!deviceId || !userId || !permission) {
    return false;
  }

  const share = await DeviceShare.findOne({
    device: deviceId,
    sharedWith: userId,
    ...activeShareConditions()
  });

  if (!share) {
    return false;
  }

  const currentWeight = DEVICE_SHARE_PERMISSION_WEIGHT[share.permission] || 0;
  const requiredWeight = DEVICE_SHARE_PERMISSION_WEIGHT[permission] || 0;

  return currentWeight >= requiredWeight;
};

const assertDeviceBelongsToUserCompany = (req, device) => {
  if (!req.user?.company) {
    throw new ApiError(403, "Logged-in user is not assigned to any company");
  }

  const deviceCompanyId = getDeviceCompanyId(device);

  if (!deviceCompanyId) {
    throw new ApiError(400, "Device is not assigned to any company");
  }

  if (String(req.user.company) !== String(deviceCompanyId)) {
    throw new ApiError(403, "You do not have permission to access this device");
  }
};

const assertCanManageSharingForDevice = async (req, device) => {
  if (isSuperAdmin(req.user)) {
    return;
  }

  if (isCustomerAdmin(req.user)) {
    assertDeviceBelongsToUserCompany(req, device);
    return;
  }

  const canManageByShare = await hasActiveSharePermission({
    deviceId: device._id,
    userId: req.user?._id,
    permission: "admin"
  });

  if (canManageByShare) {
    return;
  }

  throw new ApiError(403, "You do not have permission to manage sharing for this device");
};

const assertCanViewShare = async (req, share) => {
  if (isSuperAdmin(req.user)) {
    return;
  }

  if (isCustomerAdmin(req.user)) {
    if (!req.user?.company || String(req.user.company) !== String(share.company)) {
      throw new ApiError(403, "You do not have permission to access this share");
    }

    return;
  }

  if (String(share.sharedWith) === String(req.user?._id)) {
    return;
  }

  const canManageByShare = await hasActiveSharePermission({
    deviceId: share.device,
    userId: req.user?._id,
    permission: "admin"
  });

  if (canManageByShare) {
    return;
  }

  throw new ApiError(403, "You do not have permission to access this share");
};

const resolveDeviceForSharing = async deviceId => {
  const device = await Device.findById(deviceId);

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  if (!device.company) {
    throw new ApiError(400, "Only claimed/company-assigned devices can be shared");
  }

  return device;
};

const resolveSharedUser = async ({ sharedWith, deviceCompanyId }) => {
  const user = await User.findById(sharedWith);

  if (!user) {
    throw new ApiError(404, "sharedWith user not found");
  }

  if (user.isActive === false) {
    throw new ApiError(403, "Cannot share device with an inactive user");
  }

  if (user.role === ROLES.SUPER_ADMIN) {
    throw new ApiError(400, "super_admin does not require device sharing");
  }

  if (!user.company) {
    throw new ApiError(400, "sharedWith user is not assigned to any company");
  }

  if (String(user.company) !== String(deviceCompanyId)) {
    throw new ApiError(400, "Device can be shared only with users from the device company");
  }

  return user;
};

const getShareByIdOrFail = async shareId => {
  const share = await DeviceShare.findById(shareId);

  if (!share) {
    throw new ApiError(404, "Device share not found");
  }

  await refreshShareStatus(share);

  return share;
};

const getPopulatedShare = shareId => populateDeviceShareQuery(DeviceShare.findById(shareId));

const buildListFilter = async req => {
  const filter = {};
  const andConditions = [];

  if (isSuperAdmin(req.user)) {
    if (req.query.company) {
      filter.company = req.query.company;
    }
  } else if (isCustomerAdmin(req.user)) {
    if (!req.user?.company) {
      return null;
    }

    filter.company = req.user.company;
  } else {
    if (!req.user?.company) {
      return null;
    }

    const adminDeviceIds = await DeviceShare.find({
      sharedWith: req.user._id,
      permission: "admin",
      ...activeShareConditions()
    }).distinct("device");

    filter.company = req.user.company;

    andConditions.push({
      $or: [
        { sharedWith: req.user._id },
        { device: { $in: adminDeviceIds } }
      ]
    });
  }

  const directFilters = ["device", "sharedWith", "sharedBy", "permission"];

  directFilters.forEach(field => {
    if (req.query[field]) {
      filter[field] = req.query[field];
    }
  });

  if (req.query.status) {
    filter.status = req.query.status;
  } else if (!isTrue(req.query.includeExpired)) {
    filter.status = { $ne: "expired" };
  }

  if (req.query.q) {
    const regex = new RegExp(escapeRegex(req.query.q), "i");

    andConditions.push({
      $or: [
        { notes: regex },
        { revokeReason: regex }
      ]
    });
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }

  return filter;
};

// ==========================
// CREATE DEVICE SHARE
// ==========================
const createDeviceShare = async (req, res) => {
  await expirePastActiveShares();

  const payload = req.body || {};

  const device = await resolveDeviceForSharing(payload.device);
  await assertCanManageSharingForDevice(req, device);

  if (String(payload.sharedWith) === String(req.user?._id)) {
    throw new ApiError(400, "You cannot share a device with yourself");
  }

  const deviceCompanyId = getDeviceCompanyId(device);

  const sharedWithUser = await resolveSharedUser({
    sharedWith: payload.sharedWith,
    deviceCompanyId
  });

  const existingActiveShare = await DeviceShare.findOne({
    device: device._id,
    sharedWith: sharedWithUser._id,
    ...activeShareConditions()
  });

  if (existingActiveShare) {
    throw new ApiError(409, "Active share already exists for this device and user");
  }

  try {
    const share = await DeviceShare.create({
      device: device._id,
      company: deviceCompanyId,
      sharedWith: sharedWithUser._id,
      sharedBy: req.user._id,
      permission: payload.permission,
      status: "active",
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
      notes: payload.notes || null,
      metadata: payload.metadata || {},
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    const populatedShare = await getPopulatedShare(share._id);

    return sendResponse(res, 201, "Device shared successfully", {
      share: populatedShare
    });
  } catch (error) {
    handleDuplicateShare(error);
  }
};

// ==========================
// LIST DEVICE SHARES
// ==========================
const listDeviceShares = async (req, res) => {
  await expirePastActiveShares();

  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = await buildListFilter(req);

  if (!filter) {
    return sendResponse(res, 200, "Device shares fetched successfully", {
      page,
      limit,
      total: 0,
      totalPages: 0,
      shares: []
    });
  }

  const [shares, total] = await Promise.all([
    populateDeviceShareQuery(DeviceShare.find(filter))
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    DeviceShare.countDocuments(filter)
  ]);

  return sendResponse(res, 200, "Device shares fetched successfully", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    shares
  });
};

// ==========================
// GET DEVICE SHARE BY ID
// ==========================
const getDeviceShareById = async (req, res) => {
  const { shareId } = req.params;

  const share = await getShareByIdOrFail(shareId);

  await assertCanViewShare(req, share);

  const populatedShare = await getPopulatedShare(share._id);

  return sendResponse(res, 200, "Device share fetched successfully", {
    share: populatedShare
  });
};

// ==========================
// UPDATE DEVICE SHARE
// ==========================
const updateDeviceShare = async (req, res) => {
  await expirePastActiveShares();

  const { shareId } = req.params;
  const payload = req.body || {};

  const share = await getShareByIdOrFail(shareId);
  const device = await resolveDeviceForSharing(share.device);

  await assertCanManageSharingForDevice(req, device);

  if (hasOwn(payload, "permission")) {
    share.permission = payload.permission;
  }

  if (hasOwn(payload, "expiresAt")) {
    share.expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
  }

  if (hasOwn(payload, "notes")) {
    share.notes = payload.notes || null;
  }

  if (hasOwn(payload, "metadata")) {
    share.metadata = payload.metadata || {};
  }

  if (hasOwn(payload, "revokeReason")) {
    share.revokeReason = payload.revokeReason || null;
  }

  if (hasOwn(payload, "status")) {
    share.status = payload.status;

    if (payload.status === "revoked") {
      share.revokedAt = new Date();
      share.revokedBy = req.user._id;
      share.revokeReason = payload.revokeReason || share.revokeReason || "Share revoked";
    }

    if (payload.status === "active") {
      if (share.expiresAt && share.expiresAt <= new Date()) {
        throw new ApiError(400, "expiresAt must be a future date for an active share");
      }

      const duplicateActiveShare = await DeviceShare.findOne({
        _id: { $ne: share._id },
        device: share.device,
        sharedWith: share.sharedWith,
        ...activeShareConditions()
      });

      if (duplicateActiveShare) {
        throw new ApiError(409, "Active share already exists for this device and user");
      }

      share.revokedAt = null;
      share.revokedBy = null;
      share.revokeReason = null;
    }
  }

  if (share.status === "active" && share.expiresAt && share.expiresAt <= new Date()) {
    share.status = "expired";
  }

  share.updatedBy = req.user._id;

  try {
    await share.save();
  } catch (error) {
    handleDuplicateShare(error);
  }

  const populatedShare = await getPopulatedShare(share._id);

  return sendResponse(res, 200, "Device share updated successfully", {
    share: populatedShare
  });
};

// ==========================
// DELETE / REVOKE DEVICE SHARE
// ==========================
const deleteDeviceShare = async (req, res) => {
  await expirePastActiveShares();

  const { shareId } = req.params;
  const payload = req.body || {};

  const share = await getShareByIdOrFail(shareId);
  const device = await resolveDeviceForSharing(share.device);

  await assertCanManageSharingForDevice(req, device);

  if (share.status !== "revoked") {
    share.status = "revoked";
    share.revokedAt = new Date();
    share.revokedBy = req.user._id;
    share.revokeReason = payload.revokeReason || "Share revoked";
    share.updatedBy = req.user._id;

    await share.save();
  }

  const populatedShare = await getPopulatedShare(share._id);

  return sendResponse(res, 200, "Device share revoked successfully", {
    share: populatedShare
  });
};

module.exports = {
  createDeviceShare,
  listDeviceShares,
  getDeviceShareById,
  updateDeviceShare,
  deleteDeviceShare,

  // Helpers for later Phase 08 integration with device view/control APIs.
  hasActiveSharePermission,
  assertCanManageSharingForDevice
};
