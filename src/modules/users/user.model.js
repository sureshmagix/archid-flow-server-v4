const mongoose = require("mongoose");
const { ROLE_VALUES, ROLES } = require("../../common/constants/roles");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    role: {
      type: String,
      enum: ROLE_VALUES,
      default: ROLES.CUSTOMER_ADMIN,
      index: true
    },

    profile: {
      firstName: {
        type: String,
        trim: true
      },
      lastName: {
        type: String,
        trim: true
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
      professionalDetails: {
        companyName: {
          type: String,
          trim: true
        },
        siteName: {
          type: String,
          trim: true
        }
      },
      isVerified: {
        type: Boolean,
        default: false
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },
      verifiedAt: {
        type: Date,
        default: null
      }
    },

    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.methods.toSafeObject = function () {
  const user = this.toObject();

  delete user.password;

  return user;
};

module.exports = mongoose.model("User", userSchema);
