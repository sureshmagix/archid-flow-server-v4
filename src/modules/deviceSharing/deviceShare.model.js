const mongoose = require("mongoose");

const DEVICE_SHARE_PERMISSION_LEVELS = ["view", "control", "admin"];

const DEVICE_SHARE_STATUSES = ["active", "revoked", "expired"];

const DEVICE_SHARE_PERMISSION_WEIGHT = {
  view: 1,
  control: 2,
  admin: 3
};

const normalizeLowercase = value => {
  if (value === undefined || value === null || value === "") {
    return value;
  }

  return String(value).trim().toLowerCase();
};

const deviceShareSchema = new mongoose.Schema(
  {
    // ==========================
    // DEVICE BEING SHARED
    // ==========================
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
      index: true
    },

    // Company that owns the device at the time of sharing.
    // This helps customer_admin list/manage shares only inside their company.
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },

    // User who receives shared access.
    sharedWith: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // User who created the share.
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    permission: {
      type: String,
      enum: DEVICE_SHARE_PERMISSION_LEVELS,
      required: true,
      default: "view",
      index: true
    },

    status: {
      type: String,
      enum: DEVICE_SHARE_STATUSES,
      default: "active",
      index: true
    },

    // Null means no expiry.
    expiresAt: {
      type: Date,
      default: null,
      index: true
    },

    revokedAt: {
      type: Date,
      default: null
    },

    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    revokeReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

// ==========================
// INDEXES
// ==========================

// Prevent duplicate active sharing for same device and same user.
// Revoked / expired historical records can still exist.
deviceShareSchema.index(
  { device: 1, sharedWith: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "active"
    }
  }
);

deviceShareSchema.index({ company: 1, status: 1 });
deviceShareSchema.index({ sharedWith: 1, status: 1 });
deviceShareSchema.index({ sharedBy: 1, status: 1 });
deviceShareSchema.index({ device: 1, status: 1 });
deviceShareSchema.index({ device: 1, sharedWith: 1, status: 1 });

// ==========================
// NORMALIZATION
// ==========================

deviceShareSchema.pre("validate", function () {
  if (this.permission) {
    this.permission = normalizeLowercase(this.permission);
  }

  if (this.status) {
    this.status = normalizeLowercase(this.status);
  }

  if (this.status === "revoked" && !this.revokedAt) {
    this.revokedAt = new Date();
  }
});

// ==========================
// INSTANCE HELPERS
// ==========================

deviceShareSchema.methods.isCurrentlyActive = function () {
  if (this.status !== "active") {
    return false;
  }

  if (this.expiresAt && this.expiresAt <= new Date()) {
    return false;
  }

  return true;
};

deviceShareSchema.methods.hasPermission = function (requiredPermission) {
  if (!this.isCurrentlyActive()) {
    return false;
  }

  const currentWeight = DEVICE_SHARE_PERMISSION_WEIGHT[this.permission] || 0;
  const requiredWeight = DEVICE_SHARE_PERMISSION_WEIGHT[requiredPermission] || 0;

  return currentWeight >= requiredWeight;
};

// ==========================
// STATIC HELPERS
// ==========================

deviceShareSchema.statics.findActiveShare = function ({ deviceId, userId }) {
  return this.findOne({
    device: deviceId,
    sharedWith: userId,
    status: "active",
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
  });
};

deviceShareSchema.statics.userHasDevicePermission = async function ({
  deviceId,
  userId,
  permission
}) {
  const share = await this.findActiveShare({ deviceId, userId });

  if (!share) {
    return false;
  }

  return share.hasPermission(permission);
};

// ==========================
// JSON OUTPUT
// ==========================

deviceShareSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    return ret;
  }
});

const DeviceShare = mongoose.model("DeviceShare", deviceShareSchema);

module.exports = {
  DeviceShare,
  DEVICE_SHARE_PERMISSION_LEVELS,
  DEVICE_SHARE_STATUSES,
  DEVICE_SHARE_PERMISSION_WEIGHT
};
