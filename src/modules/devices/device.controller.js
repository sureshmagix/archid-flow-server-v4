const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const { Device } = require("./device.model");
const { DeviceType } = require("../deviceTypes/deviceType.model");
const Company = require("../companies/company.model");
const Site = require("../sites/site.model");
const ApiError = require("../../common/utils/ApiError");
const sendResponse = require("../../common/utils/sendResponse");
const { ROLES } = require("../../common/constants/roles");

const isSuperAdmin = user => user?.role === ROLES.SUPER_ADMIN;
const isCustomerAdmin = user => user?.role === ROLES.CUSTOMER_ADMIN;
const isCustomerControlUser = user => user?.role === ROLES.CUSTOMER_CONTROL_USER;
const isCustomerViewUser = user => user?.role === ROLES.CUSTOMER_VIEW_USER;

const escapeRegex = value => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeUpper = value => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim().toUpperCase();
};

const normalizeHardwareId = value => String(value || "").trim().toUpperCase();

const generateClaimCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const buildQrPayload = (hardwareId, claimCode) => {
  return `archid://claim?hardwareId=${encodeURIComponent(hardwareId)}&claimCode=${encodeURIComponent(claimCode)}`;
};

const populateDevice = query => {
  return query
    .populate("deviceType", "name slug category manufacturer model protocols")
    .populate("company", "name code status")
    .populate("site", "name code siteType status")
    .populate("owner", "name email mobile role")
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role")
    .populate("claimedBy", "name email role")
    .populate("qc.startedBy", "name email role")
    .populate("qc.testedBy", "name email role");
};

const ensureLifecycleObjects = device => {
  if (!device.qc) {
    device.qc = {};
  }

  if (!device.wifi) {
    device.wifi = {};
  }

  if (!device.mqtt) {
    device.mqtt = {};
  }

  if (!device.installationLocation) {
    device.installationLocation = {};
  }

  if (!device.liveState) {
    device.liveState = {};
  }

  if (!device.metadata) {
    device.metadata = {};
  }
};

const assertDeviceReadAccess = (req, device) => {
  if (isSuperAdmin(req.user)) {
    return;
  }

  if (!req.user?.company) {
    throw new ApiError(403, "Logged-in user is not assigned to any company");
  }

  if (String(req.user.company) !== String(device.company?._id || device.company)) {
    throw new ApiError(403, "You do not have permission to access this device");
  }
};

const assertDeviceManageAccess = (req, device) => {
  assertDeviceReadAccess(req, device);

  if (isSuperAdmin(req.user) || isCustomerAdmin(req.user)) {
    return;
  }

  throw new ApiError(403, "Only super_admin or customer_admin can manage this device");
};

const assertDeviceControlAccess = (req, device) => {
  assertDeviceReadAccess(req, device);

  if (isSuperAdmin(req.user) || isCustomerAdmin(req.user) || isCustomerControlUser(req.user)) {
    return;
  }

  throw new ApiError(403, "You do not have permission to control this device");
};

const resolveCustomerCompany = async req => {
  if (!req.user?.company) {
    throw new ApiError(400, "Logged-in user is not assigned to any company");
  }

  const company = await Company.findById(req.user.company);

  if (!company) {
    throw new ApiError(404, "Assigned company not found");
  }

  if (company.status !== "active") {
    throw new ApiError(403, "Assigned company is not active");
  }

  return company;
};

const assertSiteBelongsToCompany = async (siteId, companyId) => {
  const site = await Site.findById(siteId);

  if (!site) {
    throw new ApiError(404, "Site not found");
  }

  if (String(site.company) !== String(companyId)) {
    throw new ApiError(403, "Selected site does not belong to your company");
  }

  if (site.status !== "active") {
    throw new ApiError(403, "Selected site is not active");
  }

  return site;
};

const handleDuplicateDevice = error => {
  if (error && error.code === 11000) {
    throw new ApiError(409, "Device with this hardwareId, serialNumber, or macAddress already exists");
  }

  throw error;
};

// ==========================
// PRE-REGISTER DEVICE
// ==========================
// Factory / super_admin creates an unclaimed device.
// No customer company, site, or owner is assigned here.
const preRegisterDevice = async (req, res) => {
  const payload = req.body || {};
  const hardwareId = normalizeHardwareId(payload.hardwareId);
  const claimCode = String(payload.claimCode || generateClaimCode()).trim();

  const deviceType = await DeviceType.findById(payload.deviceType);

  if (!deviceType) {
    throw new ApiError(404, "Device type not found");
  }

  if (deviceType.isActive === false) {
    throw new ApiError(400, "Cannot pre-register device with inactive device type");
  }

  const duplicate = await Device.findOne({ hardwareId });

  if (duplicate) {
    throw new ApiError(409, "Device with this hardwareId already exists");
  }

  const claimCodeHash = await bcrypt.hash(claimCode, 10);
  const qrPayload = buildQrPayload(hardwareId, claimCode);

  try {
    const device = await Device.create({
      deviceType: deviceType._id,
      company: null,
      site: null,
      owner: null,
      name: payload.name || deviceType.name,
      displayName: null,
      hardwareId,
      serialNumber: normalizeUpper(payload.serialNumber),
      macAddress: normalizeUpper(payload.macAddress),
      firmwareVersion: payload.firmwareVersion || null,
      batchNumber: normalizeUpper(payload.batchNumber),
      protocol: payload.protocol || "mqtt",
      connectivity: payload.connectivity || "wifi",
      claimCodeHash,
      claimCodeLast4: claimCode.slice(-4),
      qrPayload,
      provisioningStatus: "unclaimed",
      operationalStatus: "inactive",
      connectionStatus: "offline",
      qc: {
        status: "pending"
      },
      wifi: {
        status: "not_configured"
      },
      mqtt: {
        clientId: hardwareId,
        baseTopic: `archid/devices/${hardwareId.toLowerCase()}`
      },
      metadata: payload.metadata || {},
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    const populatedDevice = await populateDevice(Device.findById(device._id));

    return sendResponse(res, 201, "Device pre-registered successfully", {
      device: populatedDevice,
      claimCode,
      qrPayload
    });
  } catch (error) {
    handleDuplicateDevice(error);
  }
};

// ==========================
// LIST DEVICES
// ==========================
const listDevices = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (isSuperAdmin(req.user)) {
    if (req.query.company) {
      filter.company = req.query.company;
    }
  } else {
    if (!req.user.company) {
      return sendResponse(res, 200, "Devices fetched successfully", {
        page,
        limit,
        total: 0,
        totalPages: 0,
        devices: []
      });
    }

    filter.company = req.user.company;
    filter.provisioningStatus = "claimed";
  }

  if (req.query.site) {
    filter.site = req.query.site;
  }

  if (req.query.deviceType) {
    filter.deviceType = req.query.deviceType;
  }

  if (req.query.provisioningStatus && isSuperAdmin(req.user)) {
    filter.provisioningStatus = req.query.provisioningStatus;
  }

  if (req.query.operationalStatus) {
    filter.operationalStatus = req.query.operationalStatus;
  }

  if (req.query.connectionStatus) {
    filter.connectionStatus = req.query.connectionStatus;
  }

  if (req.query.qcStatus) {
    filter["qc.status"] = req.query.qcStatus;
  }

  if (req.query.wifiStatus) {
    filter["wifi.status"] = req.query.wifiStatus;
  }

  if (req.query.q) {
    const regex = new RegExp(escapeRegex(req.query.q), "i");

    filter.$or = [
      { name: regex },
      { displayName: regex },
      { hardwareId: regex },
      { serialNumber: regex },
      { macAddress: regex },
      { batchNumber: regex }
    ];
  }

  const [devices, total] = await Promise.all([
    populateDevice(Device.find(filter))
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Device.countDocuments(filter)
  ]);

  return sendResponse(res, 200, "Devices fetched successfully", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    devices
  });
};

// ==========================
// GET DEVICE BY ID
// ==========================
const getDeviceById = async (req, res) => {
  const device = await populateDevice(Device.findById(req.params.deviceId));

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  assertDeviceReadAccess(req, device);

  return sendResponse(res, 200, "Device fetched successfully", {
    device
  });
};

// ==========================
// UPDATE DEVICE
// ==========================
const updateDevice = async (req, res) => {
  const payload = req.body || {};
  const device = await Device.findById(req.params.deviceId);

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  ensureLifecycleObjects(device);
  assertDeviceManageAccess(req, device);

  if (payload.site !== undefined) {
    if (!payload.site) {
      device.site = null;
    } else {
      const companyId = isSuperAdmin(req.user) ? device.company : req.user.company;
      await assertSiteBelongsToCompany(payload.site, companyId);
      device.site = payload.site;
    }
  }

  const allowedFields = [
    "name",
    "displayName",
    "firmwareVersion",
    "installationLocation",
    "metadata"
  ];

  allowedFields.forEach(field => {
    if (payload[field] !== undefined) {
      device[field] = payload[field];
    }
  });

  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDevice(Device.findById(device._id));

  return sendResponse(res, 200, "Device updated successfully", {
    device: populatedDevice
  });
};

// ==========================
// UPDATE OPERATIONAL STATUS
// ==========================
const updateOperationalStatus = async (req, res) => {
  const device = await Device.findById(req.params.deviceId);

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  ensureLifecycleObjects(device);
  assertDeviceManageAccess(req, device);

  device.operationalStatus = req.body.operationalStatus;
  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDevice(Device.findById(device._id));

  return sendResponse(res, 200, "Device operational status updated successfully", {
    device: populatedDevice
  });
};

// ==========================
// START QC
// ==========================
const startQc = async (req, res) => {
  const device = await Device.findById(req.params.deviceId);

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  ensureLifecycleObjects(device);

  if (device.provisioningStatus !== "unclaimed") {
    throw new ApiError(400, "QC can be started only for unclaimed devices");
  }

  device.qc.status = "in_progress";
  device.qc.startedBy = req.user._id;
  device.qc.startedAt = new Date();
  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDevice(Device.findById(device._id));

  return sendResponse(res, 200, "Device QC started successfully", {
    device: populatedDevice
  });
};

// ==========================
// RECORD QC RESULT
// ==========================
const recordQcResult = async (req, res) => {
  const payload = req.body || {};
  const device = await Device.findById(req.params.deviceId);

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  ensureLifecycleObjects(device);

  if (device.provisioningStatus !== "unclaimed") {
    throw new ApiError(400, "QC result can be recorded only for unclaimed devices");
  }

  device.qc.status = payload.qcStatus;
  device.qc.testedBy = req.user._id;
  device.qc.testedAt = new Date();
  device.qc.firmwareVersionTested = payload.firmwareVersionTested || device.firmwareVersion || null;
  device.qc.mqttConnected = Boolean(payload.mqttConnected);
  device.qc.heartbeatReceived = Boolean(payload.heartbeatReceived);
  device.qc.commandAckReceived = Boolean(payload.commandAckReceived);
  device.qc.functionalTestPassed = Boolean(payload.functionalTestPassed);
  device.qc.remarks = payload.remarks || null;

  if (Array.isArray(payload.checklist)) {
    device.qc.checklist = payload.checklist;
  }

  if (payload.qcStatus === "passed") {
    device.operationalStatus = "inactive";
    device.wifi.status = "not_configured";
    device.connectionStatus = "offline";
  }

  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDevice(Device.findById(device._id));

  return sendResponse(res, 200, "Device QC result recorded successfully", {
    device: populatedDevice
  });
};

// ==========================
// RESET CUSTOMER PROVISIONING
// ==========================
const resetCustomerProvisioning = async (req, res) => {
  const device = await Device.findById(req.params.deviceId);

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  ensureLifecycleObjects(device);

  if (device.qc.status !== "passed") {
    throw new ApiError(400, "Device can be reset for customer provisioning only after QC passed");
  }

  if (device.provisioningStatus !== "unclaimed") {
    throw new ApiError(400, "Only unclaimed devices can be reset to customer provisioning mode");
  }

  device.wifi.status = "not_configured";
  device.wifi.ssid = null;
  device.wifi.rssi = null;
  device.wifi.lastFailureReason = null;
  device.connectionStatus = "offline";
  device.lastSeenAt = null;
  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDevice(Device.findById(device._id));

  return sendResponse(res, 200, "Device reset to customer provisioning mode successfully", {
    device: populatedDevice
  });
};

// ==========================
// CLAIM DEVICE
// ==========================
const claimDevice = async (req, res) => {
  const payload = req.body || {};
  const hardwareId = normalizeHardwareId(payload.hardwareId);

  if (isSuperAdmin(req.user) || isCustomerViewUser(req.user)) {
    throw new ApiError(403, "Only customer_admin or customer_control_user can claim devices");
  }

  const company = await resolveCustomerCompany(req);
  const site = await assertSiteBelongsToCompany(payload.site, company._id);

  const device = await Device.findOne({ hardwareId }).select("+claimCodeHash");

  if (!device) {
    throw new ApiError(404, "Device not found. Please check the QR code");
  }

  ensureLifecycleObjects(device);

  if (device.provisioningStatus !== "unclaimed") {
    throw new ApiError(409, "Device is already claimed or blocked");
  }

  if (device.qc.status !== "passed") {
    throw new ApiError(403, "Device is not ready for customer claiming. QC is not passed");
  }

  const isValidClaimCode = await bcrypt.compare(String(payload.claimCode), device.claimCodeHash);

  if (!isValidClaimCode) {
    throw new ApiError(401, "Invalid claim code");
  }

  device.company = company._id;
  device.site = site._id;
  device.owner = req.user._id;
  device.claimedBy = req.user._id;
  device.claimedAt = new Date();
  device.displayName = payload.displayName;
  device.name = payload.displayName;
  device.installationLocation = payload.installationLocation || {};
  device.provisioningStatus = "claimed";
  device.operationalStatus = "active";
  device.connectionStatus = "offline";
  device.wifi.status = "not_configured";
  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDevice(Device.findById(device._id));

  return sendResponse(res, 200, "Device claimed successfully. Configure WiFi to bring it online", {
    device: populatedDevice,
    nextStep: "Send WiFi credentials from the mobile app directly to the device using BLE or SoftAP. Do not send WiFi password to backend."
  });
};

// ==========================
// UPDATE LIVE STATE
// ==========================
const updateLiveState = async (req, res) => {
  const device = await Device.findById(req.params.deviceId);

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  ensureLifecycleObjects(device);
  assertDeviceControlAccess(req, device);

  device.liveState = req.body.liveState;
  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDevice(Device.findById(device._id));

  return sendResponse(res, 200, "Device live state updated successfully", {
    device: populatedDevice
  });
};

// ==========================
// UPDATE CONNECTION
// ==========================
// Temporary REST endpoint for Phase 06/Postman testing.
// In the MQTT phase, MQTT heartbeat/status handlers should update this automatically.
const updateConnection = async (req, res) => {
  const payload = req.body || {};
  const device = await Device.findById(req.params.deviceId);

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  ensureLifecycleObjects(device);
  assertDeviceControlAccess(req, device);

  if (payload.connectionStatus) {
    device.connectionStatus = payload.connectionStatus;
  }

  if (payload.wifiStatus) {
    device.wifi.status = payload.wifiStatus;
  }

  if (payload.wifiSsid !== undefined) {
    device.wifi.ssid = payload.wifiSsid;
  }

  if (payload.wifiRssi !== undefined) {
    device.wifi.rssi = Number(payload.wifiRssi);
  }

  if (payload.firmwareVersion !== undefined) {
    device.firmwareVersion = payload.firmwareVersion;
  }

  if (payload.wifiStatus === "configured") {
    device.wifi.lastConfiguredAt = new Date();
    device.wifi.lastFailureReason = null;
  }

  if (payload.wifiStatus === "failed" && payload.wifiFailureReason) {
    device.wifi.lastFailureReason = payload.wifiFailureReason;
  }

  if (payload.connectionStatus === "online") {
    device.lastSeenAt = new Date();
    device.mqtt.lastHeartbeatAt = new Date();
  }

  if (payload.heartbeatPayload) {
    device.mqtt.lastPayload = payload.heartbeatPayload;
  }

  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDevice(Device.findById(device._id));

  return sendResponse(res, 200, "Device connection status updated successfully", {
    device: populatedDevice
  });
};

module.exports = {
  preRegisterDevice,
  listDevices,
  getDeviceById,
  updateDevice,
  updateOperationalStatus,
  startQc,
  recordQcResult,
  resetCustomerProvisioning,
  claimDevice,
  updateLiveState,
  updateConnection
};