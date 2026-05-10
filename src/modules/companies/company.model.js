const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },

    email: {
      type: String,
      trim: true,
      lowercase: true
    },

    phone: {
      countryCode: {
        type: String,
        default: "+91"
      },
      number: {
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

    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
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

module.exports = mongoose.model("Company", companySchema);