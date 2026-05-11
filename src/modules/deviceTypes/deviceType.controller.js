const { DeviceType } = require("./deviceType.model");
const ApiError = require("../../common/utils/ApiError");
const asyncHandler = require("../../common/utils/asyncHandler");

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pickDeviceTypeFields = (body) => {
  const allowedFields = [
    "name",
    "description",
    "category",
    "manufacturer",
    "model",
    "protocols",
    "capabilities",
    "commandSchema",
    "telemetrySchema",
    "metadata",
    "isActive"
  ];

  return allowedFields.reduce((payload, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }

    return payload;
  }, {});
};

const handleDuplicateDeviceType = (error) => {
  if (error && error.code === 11000) {
    throw new ApiError(409, "Device type with this name or slug already exists");
  }

  throw error;
};

const createDeviceType = asyncHandler(async (req, res) => {
  const payload = pickDeviceTypeFields(req.body);

  const existingDeviceType = await DeviceType.findOne({
    name: new RegExp(`^${escapeRegex(payload.name)}$`, "i")
  });

  if (existingDeviceType) {
    throw new ApiError(409, "Device type already exists");
  }

  try {
    const deviceType = await DeviceType.create({
      ...payload,
      createdBy: req.user?._id,
      updatedBy: req.user?._id
    });

    return res.status(201).json({
      success: true,
      message: "Device type created successfully",
      data: {
        deviceType
      }
    });
  } catch (error) {
    handleDuplicateDeviceType(error);
  }
});

const getDeviceTypes = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    isActive,
    page = 1,
    limit = 20
  } = req.query;

  const currentPage = Number.parseInt(page, 10);
  const pageLimit = Number.parseInt(limit, 10);
  const skip = (currentPage - 1) * pageLimit;

  const filter = {};

  if (search) {
    filter.$or = [
      { name: new RegExp(escapeRegex(search), "i") },
      { slug: new RegExp(escapeRegex(search), "i") },
      { description: new RegExp(escapeRegex(search), "i") },
      { manufacturer: new RegExp(escapeRegex(search), "i") },
      { model: new RegExp(escapeRegex(search), "i") }
    ];
  }

  if (category) {
    filter.category = category;
  }

  if (typeof isActive !== "undefined") {
    filter.isActive = isActive === "true" || isActive === true;
  }

  const [deviceTypes, total] = await Promise.all([
    DeviceType.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit)
      .populate("createdBy", "name email profile.firstName profile.lastName")
      .populate("updatedBy", "name email profile.firstName profile.lastName"),

    DeviceType.countDocuments(filter)
  ]);

  return res.status(200).json({
    success: true,
    message: "Device types fetched successfully",
    data: {
      deviceTypes,
      pagination: {
        total,
        page: currentPage,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit)
      }
    }
  });
});

const getDeviceTypeById = asyncHandler(async (req, res) => {
  const { deviceTypeId } = req.params;

  const deviceType = await DeviceType.findById(deviceTypeId)
    .populate("createdBy", "name email profile.firstName profile.lastName")
    .populate("updatedBy", "name email profile.firstName profile.lastName");

  if (!deviceType) {
    throw new ApiError(404, "Device type not found");
  }

  return res.status(200).json({
    success: true,
    message: "Device type fetched successfully",
    data: {
      deviceType
    }
  });
});

const updateDeviceType = asyncHandler(async (req, res) => {
  const { deviceTypeId } = req.params;
  const payload = pickDeviceTypeFields(req.body);

  const deviceType = await DeviceType.findById(deviceTypeId);

  if (!deviceType) {
    throw new ApiError(404, "Device type not found");
  }

  if (payload.name) {
    const duplicate = await DeviceType.findOne({
      _id: { $ne: deviceTypeId },
      name: new RegExp(`^${escapeRegex(payload.name)}$`, "i")
    });

    if (duplicate) {
      throw new ApiError(409, "Another device type already uses this name");
    }
  }

  Object.assign(deviceType, payload, {
    updatedBy: req.user?._id
  });

  try {
    await deviceType.save();
  } catch (error) {
    handleDuplicateDeviceType(error);
  }

  return res.status(200).json({
    success: true,
    message: "Device type updated successfully",
    data: {
      deviceType
    }
  });
});

const updateDeviceTypeStatus = asyncHandler(async (req, res) => {
  const { deviceTypeId } = req.params;
  const { isActive } = req.body;

  const deviceType = await DeviceType.findById(deviceTypeId);

  if (!deviceType) {
    throw new ApiError(404, "Device type not found");
  }

  deviceType.isActive = isActive;
  deviceType.updatedBy = req.user?._id;

  await deviceType.save();

  return res.status(200).json({
    success: true,
    message: isActive
      ? "Device type activated successfully"
      : "Device type deactivated successfully",
    data: {
      deviceType
    }
  });
});

module.exports = {
  createDeviceType,
  getDeviceTypes,
  getDeviceTypeById,
  updateDeviceType,
  updateDeviceTypeStatus
};
