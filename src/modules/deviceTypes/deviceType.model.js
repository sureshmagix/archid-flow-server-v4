const mongoose = require("mongoose");

const DEVICE_TYPE_CATEGORIES = [
  "light",
  "relay",
  "sensor",
  "gateway",
  "controller",
  "meter",
  "camera",
  "access_control",
  "parking",
  "other"
];

const DEVICE_TYPE_PROTOCOLS = [
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

const FIELD_DATA_TYPES = [
  "boolean",
  "number",
  "string",
  "enum",
  "object"
];

const slugify = (value) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const capabilitySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    dataType: {
      type: String,
      enum: FIELD_DATA_TYPES,
      required: true
    },
    unit: {
      type: String,
      trim: true,
      default: null
    },
    min: {
      type: Number,
      default: null
    },
    max: {
      type: Number,
      default: null
    },
    enumValues: {
      type: [String],
      default: []
    },
    defaultValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    readOnly: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const commandSchema = new mongoose.Schema(
  {
    command: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: null
    },
    payloadSchema: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: false }
);

const telemetrySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    dataType: {
      type: String,
      enum: FIELD_DATA_TYPES,
      required: true
    },
    unit: {
      type: String,
      trim: true,
      default: null
    }
  },
  { _id: false }
);

const deviceTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null
    },
    category: {
      type: String,
      enum: DEVICE_TYPE_CATEGORIES,
      default: "other",
      index: true
    },
    manufacturer: {
      type: String,
      trim: true,
      default: null
    },
    model: {
      type: String,
      trim: true,
      default: null
    },
    protocols: {
      type: [String],
      enum: DEVICE_TYPE_PROTOCOLS,
      default: ["mqtt"]
    },
    capabilities: {
      type: [capabilitySchema],
      default: []
    },
    commandSchema: {
      type: [commandSchema],
      default: []
    },
    telemetrySchema: {
      type: [telemetrySchema],
      default: []
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
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

deviceTypeSchema.index({ name: 1 }, { unique: true });
deviceTypeSchema.index({ category: 1, isActive: 1 });

deviceTypeSchema.pre("validate", function () {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugify(this.name);
  }
});

deviceTypeSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    return ret;
  }
});

const DeviceType = mongoose.model("DeviceType", deviceTypeSchema);

module.exports = {
  DeviceType,
  DEVICE_TYPE_CATEGORIES,
  DEVICE_TYPE_PROTOCOLS,
  FIELD_DATA_TYPES
};