const { Device } = require("../devices/device.model");
const ApiError = require("../../common/utils/ApiError");
const sendResponse = require("../../common/utils/sendResponse");
const { ROLES } = require("../../common/constants/roles");

const normalizeHardwareId = value => String(value || "").trim().toUpperCase();

const isSuperAdmin = user => user?.role === ROLES.SUPER_ADMIN;
const isCustomerAdmin = user => user?.role === ROLES.CUSTOMER_ADMIN;

const populateDeviceQuery = query =>
  query
    .populate("company", "name code status")
    .populate("site", "name code status siteType")
    .populate("deviceType", "name slug category protocols isActive")
    .populate("owner", "name email mobile role company")
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role")
    .populate("claimedBy", "name email mobile role")
    .populate("qc.startedBy", "name email role")
    .populate("qc.testedBy", "name email role");

const assertCustomerDeviceAccess = (req, device) => {
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

const getClaimPreview = async (req, res) => {
  const hardwareId = normalizeHardwareId(req.query.hardwareId);

  const device = await populateDeviceQuery(Device.findOne({ hardwareId }));

  if (!device) {
    throw new ApiError(404, "Device not found. Please check the QR code");
  }

  const readyToClaim =
    device.provisioningStatus === "unclaimed" &&
    device.qc?.status === "passed";

  let reason = "Device is ready to claim";

  if (device.provisioningStatus !== "unclaimed") {
    reason = "Device is already claimed, blocked, or retired";
  } else if (device.qc?.status !== "passed") {
    reason = "Device is not ready to claim because QC is not passed";
  }

  return sendResponse(res, 200, "Device claim preview fetched successfully", {
    readyToClaim,
    reason,
    device: {
      id: device._id,
      hardwareId: device.hardwareId,
      name: device.name,
      displayName: device.displayName,
      deviceType: device.deviceType,
      provisioningStatus: device.provisioningStatus,
      operationalStatus: device.operationalStatus,
      connectionStatus: device.connectionStatus,
      qcStatus: device.qc?.status,
      wifiStatus: device.wifi?.status,
      claimCodeLast4: device.claimCodeLast4
    }
  });
};

const activateProvisionedDevice = async (req, res) => {
  const device = await Device.findById(req.params.deviceId);

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  if (!isSuperAdmin(req.user) && !isCustomerAdmin(req.user)) {
    throw new ApiError(403, "Only super_admin or customer_admin can activate device");
  }

  if (device.provisioningStatus !== "claimed") {
    throw new ApiError(400, "Only claimed devices can be activated");
  }

  if (device.qc?.status !== "passed") {
    throw new ApiError(400, "Only QC-passed devices can be activated");
  }

  assertCustomerDeviceAccess(req, device);

  device.operationalStatus = "active";
  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDeviceQuery(Device.findById(device._id));

  return sendResponse(res, 200, "Device activated successfully", {
    device: populatedDevice
  });
};

module.exports = {
  getClaimPreview,
  activateProvisionedDevice
};
