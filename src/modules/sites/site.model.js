const mongoose = require("mongoose");

const siteSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },

    siteType: {
      type: String,
      enum: [
        "office",
        "parking",
        "factory",
        "warehouse",
        "residential",
        "mall",
        "hospital",
        "hotel",
        "other"
      ],
      default: "office"
    },

    contactPerson: {
      name: {
        type: String,
        trim: true
      },
      email: {
        type: String,
        trim: true,
        lowercase: true
      },
      phone: {
        type: String,
        trim: true
      }
    },

    address: {
      addressLine1: {
        type: String,
        trim: true
      },
      addressLine2: {
        type: String,
        trim: true
      },
      district: {
        type: String,
        trim: true
      },
      city: {
        type: String,
        trim: true
      },
      state: {
        type: String,
        trim: true
      },
      pincode: {
        type: String,
        trim: true
      },
      country: {
        type: String,
        trim: true,
        default: "India"
      }
    },

    location: {
      latitude: {
        type: Number,
        default: null
      },
      longitude: {
        type: Number,
        default: null
      }
    },

    timezone: {
      type: String,
      default: "Asia/Kolkata"
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true
    },

    notes: {
      type: String,
      trim: true
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

siteSchema.index({ company: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("Site", siteSchema);