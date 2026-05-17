const mongoose = require("mongoose");

const DEVICE_PROTOCOLS = [
  "mqtt",
  "http",
  "modbus",
  "rs485",
  "rs232",
  "ble",
  "zigbee",
  "wifi",
  "ethernet",
  "lora",
  "other"
];

const DEVICE_CONNECTIVITY_TYPES = [
  "wifi",
  "ethernet",
  "gsm",
  "lora",
  "ble",
  "zigbee",
  "other"
];

const DEVICE_PROVISIONING_STATUSES = [
  "unclaimed",
  "claimed",
  "blocked",
  "retired"
];

const DEVICE_OPERATIONAL_STATUSES = [
  "active",
  "inactive",
  "maintenance",
  "retired"
];

const DEVICE_CONNECTION_STATUSES = [
  "online",
  "offline",
  "unknown"
];

const DEVICE_WIFI_STATUSES = [
  "not_configured",
  "configuring",
  "configured",
  "failed"
];

const DEVICE_QC_STATUSES = [
  "pending",
  "in_progress",
  "passed",
  "failed",
  "rework"
];

const normalizeCode = value => {
  if (value === undefined || value === null || value === "") {
    return value;
  }

  return String(value).trim().toUpperCase();
};

const qcChecklistSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      trim: true
    },
    label: {
      type: String,
      trim: true
    },
    passed: {
      type: Boolean,
      default: false
    },
    remarks: {
      type: String,
      trim: true,
      default: null
    }
  },
  { _id: false }
);

const deviceSchema = new mongoose.Schema(
  {
    // ==========================
    // CORE DEVICE IDENTITY
    // ==========================

    deviceType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeviceType",
      required: true,
      index: true
    },

    // company is NOT required during factory pre-registration.
    // It is assigned only when customer claims the device.
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true
    },

    // site is selected only during customer claim / installation.
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      default: null,
      index: true
    },

    // owner is assigned only during customer claim.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true
    },

    displayName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null
    },

    // deviceCode is NOT required during pre-registration.
    // It can be used later as a customer/company internal code.
    deviceCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 60,
      default: null
    },

    hardwareId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
      maxlength: 120
    },

    serialNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null
    },

    macAddress: {
      type: String,
      trim: true,
      uppercase: true,
      default: null
    },

    batchNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null
    },

    firmwareVersion: {
      type: String,
      trim: true,
      default: null
    },

    protocol: {
      type: String,
      enum: DEVICE_PROTOCOLS,
      default: "mqtt"
    },

    connectivity: {
      type: String,
      enum: DEVICE_CONNECTIVITY_TYPES,
      default: "wifi"
    },

    // Kept for backward compatibility with earlier Phase 06 testing.
    mqttTopicBase: {
      type: String,
      trim: true,
      default: null,
      index: true
    },

    // ==========================
    // CLAIM / QR DETAILS
    // ==========================

    claimCodeHash: {
      type: String,
      select: false,
      default: null
    },

    claimCodeLast4: {
      type: String,
      trim: true,
      default: null
    },

    qrPayload: {
      type: String,
      trim: true,
      default: null
    },

    provisioningStatus: {
      type: String,
      enum: DEVICE_PROVISIONING_STATUSES,
      default: "unclaimed",
      index: true
    },

    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    claimedAt: {
      type: Date,
      default: null
    },

    // ==========================
    // OPERATION / CONNECTION
    // ==========================

    operationalStatus: {
      type: String,
      enum: DEVICE_OPERATIONAL_STATUSES,
      default: "inactive",
      index: true
    },

    connectionStatus: {
      type: String,
      enum: DEVICE_CONNECTION_STATUSES,
      default: "offline",
      index: true
    },

    lastSeenAt: {
      type: Date,
      default: null
    },

    // Kept for backward compatibility.
    lastHeartbeatAt: {
      type: Date,
      default: null
    },

    // ==========================
    // QUALITY CHECK
    // ==========================

    qc: {
      status: {
        type: String,
        enum: DEVICE_QC_STATUSES,
        default: "pending",
        index: true
      },
      startedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },
      startedAt: {
        type: Date,
        default: null
      },
      testedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },
      testedAt: {
        type: Date,
        default: null
      },
      firmwareVersionTested: {
        type: String,
        trim: true,
        default: null
      },
      mqttConnected: {
        type: Boolean,
        default: false
      },
      heartbeatReceived: {
        type: Boolean,
        default: false
      },
      commandAckReceived: {
        type: Boolean,
        default: false
      },
      functionalTestPassed: {
        type: Boolean,
        default: false
      },
      checklist: {
        type: [qcChecklistSchema],
        default: []
      },
      remarks: {
        type: String,
        trim: true,
        default: null
      }
    },

    // ==========================
    // WIFI PROVISIONING STATUS
    // ==========================

    wifi: {
      status: {
        type: String,
        enum: DEVICE_WIFI_STATUSES,
        default: "not_configured",
        index: true
      },
      ssid: {
        type: String,
        trim: true,
        default: null
      },
      rssi: {
        type: Number,
        default: null
      },
      lastConfiguredAt: {
        type: Date,
        default: null
      },
      lastFailureReason: {
        type: String,
        trim: true,
        default: null
      }
    },

    // ==========================
    // MQTT STATUS
    // ==========================

    mqtt: {
      clientId: {
        type: String,
        trim: true,
        default: null
      },
      baseTopic: {
        type: String,
        trim: true,
        default: null
      },
      lastHeartbeatAt: {
        type: Date,
        default: null
      },
      lastPayload: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      }
    },

    // ==========================
    // INSTALLATION DETAILS
    // ==========================

    installationLocation: {
      building: {
        type: String,
        trim: true,
        default: null
      },
      floor: {
        type: String,
        trim: true,
        default: null
      },
      room: {
        type: String,
        trim: true,
        default: null
      },
      area: {
        type: String,
        trim: true,
        default: null
      }
    },

    liveState: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    notes: {
      type: String,
      trim: true,
      default: null
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

// NOTE:
// Do not add deviceSchema.index({ hardwareId: 1 }) here.
// hardwareId already has unique: true and index: true in the field definition.

// serialNumber should be unique only when present.
deviceSchema.index(
  { serialNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      serialNumber: { $type: "string" }
    }
  }
);

// macAddress should be unique only when present.
deviceSchema.index(
  { macAddress: 1 },
  {
    unique: true,
    partialFilterExpression: {
      macAddress: { $type: "string" }
    }
  }
);

// deviceCode should be unique only inside a company,
// and only when both company and deviceCode are present.
deviceSchema.index(
  { company: 1, deviceCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      company: { $type: "objectId" },
      deviceCode: { $type: "string" }
    }
  }
);

deviceSchema.index({ company: 1, site: 1 });
deviceSchema.index({ company: 1, operationalStatus: 1 });
deviceSchema.index({ company: 1, connectionStatus: 1 });
deviceSchema.index({ provisioningStatus: 1, "qc.status": 1 });
deviceSchema.index({ batchNumber: 1 });

// NOTE:
// Do not add deviceSchema.index({ "wifi.status": 1 }) here.
// wifi.status already has index: true in the field definition.

// ==========================
// NORMALIZATION
// ==========================

deviceSchema.pre("validate", function () {
  if (this.deviceCode) {
    this.deviceCode = normalizeCode(this.deviceCode);
  }

  if (this.hardwareId) {
    this.hardwareId = normalizeCode(this.hardwareId);
  }

  if (this.serialNumber) {
    this.serialNumber = normalizeCode(this.serialNumber);
  }

  if (this.macAddress) {
    this.macAddress = normalizeCode(this.macAddress);
  }

  if (this.batchNumber) {
    this.batchNumber = normalizeCode(this.batchNumber);
  }
});

// ==========================
// JSON OUTPUT
// ==========================

deviceSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret.claimCodeHash;
    return ret;
  }
});

const Device = mongoose.model("Device", deviceSchema);

module.exports = {
  Device,

  DEVICE_PROTOCOLS,
  DEVICE_CONNECTIVITY_TYPES,

  DEVICE_OPERATIONAL_STATUSES,
  DEVICE_CONNECTION_STATUSES,
  DEVICE_PROVISIONING_STATUSES,

  DEVICE_WIFI_STATUSES,
  DEVICE_QC_STATUSES,

  // Aliases for final Phase 06 validation/controller compatibility
  OPERATIONAL_STATUSES: DEVICE_OPERATIONAL_STATUSES,
  CONNECTION_STATUSES: DEVICE_CONNECTION_STATUSES,
  PROVISIONING_STATUSES: DEVICE_PROVISIONING_STATUSES,
  WIFI_STATUSES: DEVICE_WIFI_STATUSES,
  QC_STATUSES: DEVICE_QC_STATUSES
};