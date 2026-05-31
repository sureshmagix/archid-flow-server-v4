const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const Company = require("../companies/company.model");
const Site = require("../sites/site.model");
const User = require("../users/user.model");
const { DeviceType } = require("../deviceTypes/deviceType.model");
const { Device } = require("./device.model");

const ApiError = require("../../common/utils/ApiError");
const sendResponse = require("../../common/utils/sendResponse");
const { ROLES } = require("../../common/constants/roles");

const isSuperAdmin = user => user?.role === ROLES.SUPER_ADMIN;
const isCustomerAdmin = user => user?.role === ROLES.CUSTOMER_ADMIN;
const isCustomerControlUser = user => user?.role === ROLES.CUSTOMER_CONTROL_USER;
const isCustomerViewUser = user => user?.role === ROLES.CUSTOMER_VIEW_USER;

const escapeRegex = value => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeCode = value => String(value || "").trim().toUpperCase();

const normalizeOptionalCode = value => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim().toUpperCase();
};

const normalizeHardwareId = value => normalizeCode(value);

const normalizeTopicSegment = value =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const generateClaimCode = () => crypto.randomInt(100000, 1000000).toString();

const buildQrPayload = (hardwareId, claimCode) => {
  return `archid://claim?hardwareId=${encodeURIComponent(hardwareId)}&claimCode=${encodeURIComponent(claimCode)}`;
};

const buildMqttTopicBase = (deviceType, hardwareId) => {
  const typeSegment = normalizeTopicSegment(deviceType?.slug || deviceType?.category || "device");
  const hardwareSegment = normalizeTopicSegment(hardwareId);

  return `archid/${typeSegment}/${hardwareSegment}`;
};

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

const handleDuplicateDevice = error => {
  if (error && error.code === 11000) {
    throw new ApiError(
      409,
      "Device with this hardwareId, serialNumber, macAddress, or company deviceCode already exists"
    );
  }

  throw error;
};

const assertDeviceAccess = (req, device) => {
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
};

const assertCanClaimDevice = req => {
  if (isCustomerAdmin(req.user)) {
    return;
  }

  if (isSuperAdmin(req.user)) {
    throw new ApiError(403, "super_admin cannot claim a customer device");
  }

  if (isCustomerViewUser(req.user) || isCustomerControlUser(req.user)) {
    throw new ApiError(403, "Only customer_admin can claim devices");
  }

  throw new ApiError(403, "Only customer_admin can claim devices");
};

const resolveDeviceType = async deviceTypeId => {
  const deviceType = await DeviceType.findById(deviceTypeId);

  if (!deviceType) {
    throw new ApiError(404, "Device type not found");
  }

  if (deviceType.isActive === false) {
    throw new ApiError(400, "Cannot assign inactive device type");
  }

  return deviceType;
};

const resolveCompanyForCreate = async req => {
  if (isSuperAdmin(req.user)) {
    if (!req.body.company) {
      throw new ApiError(400, "company is required for super_admin device creation");
    }

    const company = await Company.findById(req.body.company);

    if (!company) {
      throw new ApiError(404, "Company not found");
    }

    if (company.status && company.status !== "active") {
      throw new ApiError(403, "Selected company is not active");
    }

    return company;
  }

  if (!req.user?.company) {
    throw new ApiError(400, "Logged-in user is not assigned to any company");
  }

  if (req.body.company && String(req.body.company) !== String(req.user.company)) {
    throw new ApiError(403, "You cannot create a device for another company");
  }

  const company = await Company.findById(req.user.company);

  if (!company) {
    throw new ApiError(404, "Assigned company not found");
  }

  if (company.status && company.status !== "active") {
    throw new ApiError(403, "Assigned company is not active");
  }

  return company;
};

const resolveCustomerCompany = async req => {
  if (!req.user?.company) {
    throw new ApiError(400, "Logged-in user is not assigned to any company");
  }

  const company = await Company.findById(req.user.company);

  if (!company) {
    throw new ApiError(404, "Assigned company not found");
  }

  if (company.status && company.status !== "active") {
    throw new ApiError(403, "Assigned company is not active");
  }

  return company;
};

const resolveSite = async (siteId, companyId) => {
  if (!siteId) {
    return null;
  }

  const site = await Site.findById(siteId);

  if (!site) {
    throw new ApiError(404, "Site not found");
  }

  if (String(site.company) !== String(companyId)) {
    throw new ApiError(400, "Selected site does not belong to the selected company");
  }

  if (site.status && site.status !== "active") {
    throw new ApiError(403, "Selected site is not active");
  }

  return site;
};

const resolveOwner = async (ownerId, companyId, fallbackUserId) => {
  const finalOwnerId = ownerId || fallbackUserId || null;

  if (!finalOwnerId) {
    return null;
  }

  const owner = await User.findById(finalOwnerId);

  if (!owner) {
    throw new ApiError(404, "Owner user not found");
  }

  if (owner.role === ROLES.SUPER_ADMIN) {
    throw new ApiError(400, "super_admin cannot be assigned as a customer device owner");
  }

  if (!owner.company || String(owner.company) !== String(companyId)) {
    throw new ApiError(400, "Owner user must belong to the selected company");
  }

  return owner;
};

// ==========================
// PHASE 07 - FACTORY REGISTER / PRE-REGISTER
// ==========================
const preRegisterDevice = async (req, res) => {
  if (!isSuperAdmin(req.user)) {
    throw new ApiError(403, "Only super_admin can factory-register devices");
  }

  const payload = req.body || {};
  const deviceType = await resolveDeviceType(payload.deviceType);
  const hardwareId = normalizeHardwareId(payload.hardwareId);
  const claimCode = String(payload.claimCode || generateClaimCode()).trim();

  const duplicateHardware = await Device.findOne({ hardwareId });

  if (duplicateHardware) {
    throw new ApiError(409, "hardwareId already exists");
  }

  const claimCodeHash = await bcrypt.hash(claimCode, 10);
  const qrPayload = buildQrPayload(hardwareId, claimCode);
  const mqttTopicBase = payload.mqttTopicBase || buildMqttTopicBase(deviceType, hardwareId);

  try {
    const device = await Device.create({
      company: null,
      site: null,
      deviceType: deviceType._id,
      owner: null,

      name: payload.name || deviceType.name || hardwareId,
      displayName: null,
      deviceCode: null,
      hardwareId,
      serialNumber: normalizeOptionalCode(payload.serialNumber),
      macAddress: normalizeOptionalCode(payload.macAddress),
      batchNumber: normalizeOptionalCode(payload.batchNumber),
      firmwareVersion: payload.firmwareVersion || null,

      protocol: payload.protocol || "mqtt",
      connectivity: payload.connectivity || "wifi",

      mqttTopicBase,
      mqtt: {
        clientId: hardwareId,
        baseTopic: mqttTopicBase
      },

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

      liveState: {},
      metadata: payload.metadata || {},
      notes: payload.notes || null,

      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    const populatedDevice = await populateDeviceQuery(Device.findById(device._id));

    return sendResponse(res, 201, "Device factory-registered successfully", {
      device: populatedDevice,
      claimCode,
      qrPayload
    });
  } catch (error) {
    handleDuplicateDevice(error);
  }
};

// ==========================
// PHASE 06 - DIRECT DEVICE CREATE
// ==========================
const createDevice = async (req, res) => {
  assertCanManageDevice(req);

  const payload = req.body || {};
  const company = await resolveCompanyForCreate(req);
  const deviceType = await resolveDeviceType(payload.deviceType);
  const site = await resolveSite(payload.site, company._id);

  const fallbackOwnerId = isSuperAdmin(req.user) ? null : req.user?._id;
  const owner = await resolveOwner(payload.owner, company._id, fallbackOwnerId);

  const normalizedDeviceCode = normalizeCode(payload.deviceCode);
  const normalizedHardwareId = normalizeCode(payload.hardwareId);

  const duplicateDeviceCode = await Device.findOne({
    company: company._id,
    deviceCode: normalizedDeviceCode
  });

  if (duplicateDeviceCode) {
    throw new ApiError(409, "Device code already exists for this company");
  }

  const duplicateHardware = await Device.findOne({
    hardwareId: normalizedHardwareId
  });

  if (duplicateHardware) {
    throw new ApiError(409, "hardwareId already exists");
  }

  const provisioningStatus = payload.provisioningStatus || "claimed";
  const mqttTopicBase = payload.mqttTopicBase || buildMqttTopicBase(deviceType, normalizedHardwareId);

  try {
    const device = await Device.create({
      company: company._id,
      site: site?._id || null,
      deviceType: deviceType._id,
      owner: owner?._id || null,

      name: payload.name,
      displayName: payload.displayName || payload.name,
      deviceCode: normalizedDeviceCode,
      hardwareId: normalizedHardwareId,
      serialNumber: normalizeOptionalCode(payload.serialNumber),
      macAddress: normalizeOptionalCode(payload.macAddress),
      batchNumber: normalizeOptionalCode(payload.batchNumber),
      firmwareVersion: payload.firmwareVersion || null,

      protocol: payload.protocol || "mqtt",
      connectivity: payload.connectivity || "wifi",

      mqttTopicBase,
      mqtt: {
        clientId: normalizedHardwareId,
        baseTopic: mqttTopicBase
      },

      provisioningStatus,
      claimedBy: provisioningStatus === "claimed" ? req.user._id : null,
      claimedAt: provisioningStatus === "claimed" ? new Date() : null,

      operationalStatus: payload.operationalStatus || "active",
      connectionStatus: payload.connectionStatus || "offline",

      wifi: {
        status: payload.wifiStatus || "not_configured"
      },

      liveState: payload.liveState || {},
      metadata: payload.metadata || {},
      notes: payload.notes || null,

      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    const populatedDevice = await populateDeviceQuery(Device.findById(device._id));

    return sendResponse(res, 201, "Device created successfully", {
      device: populatedDevice
    });
  } catch (error) {
    handleDuplicateDevice(error);
  }
};

// ==========================
// DEVICE LIST
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
    if (!req.user?.company) {
      return sendResponse(res, 200, "Devices fetched successfully", {
        page,
        limit,
        total: 0,
        totalPages: 0,
        devices: []
      });
    }

    filter.company = req.user.company;
  }

  const directFilters = [
    "site",
    "deviceType",
    "owner",
    "operationalStatus",
    "connectionStatus",
    "provisioningStatus",
    "batchNumber"
  ];

  directFilters.forEach(field => {
    if (req.query[field]) {
      filter[field] = req.query[field];
    }
  });

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
      { deviceCode: regex },
      { hardwareId: regex },
      { serialNumber: regex },
      { macAddress: regex },
      { firmwareVersion: regex },
      { mqttTopicBase: regex },
      { batchNumber: regex }
    ];
  }

  const [devices, total] = await Promise.all([
    populateDeviceQuery(Device.find(filter))
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
  const { deviceId } = req.params;

  const device = await populateDeviceQuery(Device.findById(deviceId));

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  assertDeviceAccess(req, device);

  return sendResponse(res, 200, "Device fetched successfully", {
    device
  });
};

// ==========================
// UPDATE DEVICE
// ==========================
const updateDevice = async (req, res) => {
  assertCanManageDevice(req);

  const { deviceId } = req.params;
  const payload = req.body || {};

  const device = await Device.findById(deviceId);

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  ensureLifecycleObjects(device);
  assertDeviceAccess(req, device);

  let targetCompanyId = device.company;

  if (payload.company) {
    if (!isSuperAdmin(req.user)) {
      throw new ApiError(403, "Only super_admin can move a device to another company");
    }

    const company = await Company.findById(payload.company);

    if (!company) {
      throw new ApiError(404, "Company not found");
    }

    if (company.status && company.status !== "active") {
      throw new ApiError(403, "Selected company is not active");
    }

    targetCompanyId = company._id;
    device.company = company._id;
  }

  let activeDeviceType = null;

  if (payload.deviceType) {
    const deviceType = await resolveDeviceType(payload.deviceType);

    activeDeviceType = deviceType;
    device.deviceType = deviceType._id;
  } else {
    activeDeviceType = await DeviceType.findById(device.deviceType);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "site")) {
    const site = await resolveSite(payload.site, targetCompanyId);

    device.site = site?._id || null;
  } else if (device.site) {
    await resolveSite(device.site, targetCompanyId);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "owner")) {
    const owner = await resolveOwner(payload.owner, targetCompanyId, null);

    device.owner = owner?._id || null;
  } else if (device.owner) {
    await resolveOwner(device.owner, targetCompanyId, null);
  }

  if (payload.deviceCode) {
    const normalizedDeviceCode = normalizeCode(payload.deviceCode);

    const duplicateDeviceCode = await Device.findOne({
      _id: { $ne: device._id },
      company: targetCompanyId,
      deviceCode: normalizedDeviceCode
    });

    if (duplicateDeviceCode) {
      throw new ApiError(409, "Device code already exists for this company");
    }

    device.deviceCode = normalizedDeviceCode;
  }

  if (payload.hardwareId) {
    const normalizedHardwareId = normalizeCode(payload.hardwareId);

    const duplicateHardware = await Device.findOne({
      _id: { $ne: device._id },
      hardwareId: normalizedHardwareId
    });

    if (duplicateHardware) {
      throw new ApiError(409, "hardwareId already exists");
    }

    device.hardwareId = normalizedHardwareId;

    if (!payload.mqttTopicBase && activeDeviceType) {
      device.mqttTopicBase = buildMqttTopicBase(activeDeviceType, normalizedHardwareId);
      device.mqtt.clientId = normalizedHardwareId;
      device.mqtt.baseTopic = device.mqttTopicBase;
    }
  }

  const allowedFields = [
    "name",
    "displayName",
    "serialNumber",
    "macAddress",
    "batchNumber",
    "firmwareVersion",
    "protocol",
    "connectivity",
    "mqttTopicBase",
    "provisioningStatus",
    "installationLocation",
    "liveState",
    "metadata",
    "notes"
  ];

  allowedFields.forEach(field => {
    if (payload[field] !== undefined) {
      device[field] = payload[field];
    }
  });

  if (payload.mqttTopicBase !== undefined) {
    device.mqtt.baseTopic = payload.mqttTopicBase;
  }

  if (payload.provisioningStatus === "claimed" && !device.claimedAt) {
    device.claimedAt = new Date();
    device.claimedBy = req.user._id;
  }

  if (payload.provisioningStatus === "unclaimed") {
    device.claimedAt = null;
    device.claimedBy = null;
    device.company = null;
    device.site = null;
    device.owner = null;
  }

  device.updatedBy = req.user._id;

  try {
    await device.save();
  } catch (error) {
    handleDuplicateDevice(error);
  }

  const populatedDevice = await populateDeviceQuery(Device.findById(device._id));

  return sendResponse(res, 200, "Device updated successfully", {
    device: populatedDevice
  });
};

// ==========================
// UPDATE OPERATIONAL STATUS
// ==========================
const updateDeviceStatus = async (req, res) => {
  assertCanManageDevice(req);

  const { deviceId } = req.params;
  const { operationalStatus } = req.body;

  const device = await Device.findById(deviceId);

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  assertDeviceAccess(req, device);

  device.operationalStatus = operationalStatus;
  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDeviceQuery(Device.findById(device._id));

  return sendResponse(res, 200, "Device status updated successfully", {
    device: populatedDevice
  });
};

// ==========================
// PHASE 07 - START QC
// ==========================
const startDeviceQc = async (req, res) => {
  if (!isSuperAdmin(req.user)) {
    throw new ApiError(403, "Only super_admin can start QC");
  }

  const { deviceId } = req.params;

  const device = await Device.findById(deviceId);

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

  const populatedDevice = await populateDeviceQuery(Device.findById(device._id));

  return sendResponse(res, 200, "Device QC started successfully", {
    device: populatedDevice
  });
};

// ==========================
// PHASE 07 - RECORD QC RESULT
// ==========================
const recordDeviceQcResult = async (req, res) => {
  if (!isSuperAdmin(req.user)) {
    throw new ApiError(403, "Only super_admin can record QC result");
  }

  const { deviceId } = req.params;
  const payload = req.body || {};

  const device = await Device.findById(deviceId);

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
    device.connectionStatus = "offline";
    device.wifi.status = "not_configured";
  }

  if (payload.qcStatus === "failed" || payload.qcStatus === "rework") {
    device.operationalStatus = "inactive";
    device.connectionStatus = "offline";
  }

  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDeviceQuery(Device.findById(device._id));

  return sendResponse(res, 200, "Device QC result recorded successfully", {
    device: populatedDevice
  });
};

// ==========================
// PHASE 07 - RESET CUSTOMER PROVISIONING
// ==========================
const resetDeviceToCustomerProvisioning = async (req, res) => {
  if (!isSuperAdmin(req.user)) {
    throw new ApiError(403, "Only super_admin can reset device provisioning");
  }

  const { deviceId } = req.params;

  const device = await Device.findById(deviceId);

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
  device.wifi.lastConfiguredAt = null;
  device.wifi.lastFailureReason = null;

  device.connectionStatus = "offline";
  device.lastSeenAt = null;
  device.lastHeartbeatAt = null;

  device.mqtt.lastHeartbeatAt = null;
  device.mqtt.lastPayload = {};

  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDeviceQuery(Device.findById(device._id));

  return sendResponse(res, 200, "Device reset to customer provisioning mode successfully", {
    device: populatedDevice
  });
};

// ==========================
// PHASE 07 - CLAIM DEVICE
// ==========================
const claimDevice = async (req, res) => {
  assertCanClaimDevice(req);

  const payload = req.body || {};
  const hardwareId = normalizeHardwareId(payload.hardwareId);

  const company = await resolveCustomerCompany(req);
  const site = await resolveSite(payload.site, company._id);

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

  if (!device.claimCodeHash) {
    throw new ApiError(400, "Device does not have a valid claim code. Please contact support");
  }

  const isValidClaimCode = await bcrypt.compare(String(payload.claimCode), device.claimCodeHash);

  if (!isValidClaimCode) {
    throw new ApiError(401, "Invalid claim code");
  }

  device.company = company._id;
  device.site = site?._id || null;
  device.owner = req.user._id;
  device.claimedBy = req.user._id;
  device.claimedAt = new Date();

  device.displayName = payload.displayName;
  device.name = payload.displayName;

  device.installationLocation = {
    ...(device.installationLocation || {}),
    ...(payload.installationLocation || {})
  };

  device.provisioningStatus = "claimed";
  device.operationalStatus = "active";
  device.connectionStatus = "offline";
  device.wifi.status = "not_configured";

  if (!device.mqttTopicBase) {
    const deviceType = await DeviceType.findById(device.deviceType);
    device.mqttTopicBase = buildMqttTopicBase(deviceType, device.hardwareId);
  }

  device.mqtt.clientId = device.hardwareId;
  device.mqtt.baseTopic = device.mqttTopicBase;

  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDeviceQuery(Device.findById(device._id));

  return sendResponse(res, 200, "Device claimed successfully. Configure WiFi to bring it online", {
    device: populatedDevice,
    nextStep: "Send WiFi credentials from the mobile app directly to the device using BLE or SoftAP. Do not send WiFi password to backend."
  });
};

// ==========================
// UPDATE LIVE STATE
// ==========================
const updateDeviceLiveState = async (req, res) => {
  assertCanControlDevice(req);

  const { deviceId } = req.params;
  const payload = req.body || {};

  const device = await Device.findById(deviceId);

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  ensureLifecycleObjects(device);
  assertDeviceAccess(req, device);

  if (payload.connectionStatus) {
    device.connectionStatus = payload.connectionStatus;
  }

  if (payload.liveState) {
    device.liveState = {
      ...(device.liveState || {}),
      ...payload.liveState
    };
  }

  if (payload.lastSeenAt) {
    device.lastSeenAt = new Date(payload.lastSeenAt);
  } else if (payload.connectionStatus === "online") {
    device.lastSeenAt = new Date();
  }

  if (payload.lastHeartbeatAt) {
    device.lastHeartbeatAt = new Date(payload.lastHeartbeatAt);
    device.mqtt.lastHeartbeatAt = new Date(payload.lastHeartbeatAt);
  } else if (payload.connectionStatus === "online") {
    device.lastHeartbeatAt = new Date();
    device.mqtt.lastHeartbeatAt = new Date();
  }

  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDeviceQuery(Device.findById(device._id));

  return sendResponse(res, 200, "Device live state updated successfully", {
    device: populatedDevice
  });
};

// ==========================
// UPDATE CONNECTION
// ==========================
const updateDeviceConnection = async (req, res) => {
  assertCanControlDevice(req);

  const { deviceId } = req.params;
  const payload = req.body || {};

  const device = await Device.findById(deviceId);

  if (!device) {
    throw new ApiError(404, "Device not found");
  }

  ensureLifecycleObjects(device);
  assertDeviceAccess(req, device);

  if (payload.connectionStatus) {
    device.connectionStatus = payload.connectionStatus;
  }

  if (payload.wifiStatus) {
    device.wifi.status = payload.wifiStatus;
  }

  if (payload.wifiSsid !== undefined) {
    device.wifi.ssid = payload.wifiSsid || null;
  }

  if (payload.wifiRssi !== undefined) {
    device.wifi.rssi = payload.wifiRssi === null || payload.wifiRssi === "" ? null : Number(payload.wifiRssi);
  }

  if (payload.firmwareVersion !== undefined) {
    device.firmwareVersion = payload.firmwareVersion || null;
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
    device.lastHeartbeatAt = new Date();
    device.mqtt.lastHeartbeatAt = new Date();
  }

  if (payload.heartbeatPayload) {
    device.mqtt.lastPayload = payload.heartbeatPayload;
  }

  device.updatedBy = req.user._id;

  await device.save();

  const populatedDevice = await populateDeviceQuery(Device.findById(device._id));

  return sendResponse(res, 200, "Device connection status updated successfully", {
    device: populatedDevice
  });
};

module.exports = {
  // Phase 07 provisioning lifecycle
  preRegisterDevice,
  startDeviceQc,
  recordDeviceQcResult,
  resetDeviceToCustomerProvisioning,
  claimDevice,

  // Phase 06 device inventory
  createDevice,
  listDevices,
  getDeviceById,
  updateDevice,
  updateDeviceStatus,
  updateDeviceLiveState,
  updateDeviceConnection,

  // Backward-compatible aliases
  updateOperationalStatus: updateDeviceStatus,
  startQc: startDeviceQc,
  recordQcResult: recordDeviceQcResult,
  resetCustomerProvisioning: resetDeviceToCustomerProvisioning,
  updateLiveState: updateDeviceLiveState,
  updateConnection: updateDeviceConnection
};