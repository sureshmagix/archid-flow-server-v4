const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const USER_ROLES = [
  "super_admin",
  "customer_admin",
  "customer_control_user",
  "customer_view_user"
];

const USER_STATUSES = ["active", "inactive", "blocked"];

const phoneSchema = new mongoose.Schema(
  {
    countryCode: {
      type: String,
      trim: true,
      default: "+91"
    },
    number: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    addressLine1: {
      type: String,
      trim: true,
      default: ""
    },
    addressLine2: {
      type: String,
      trim: true,
      default: ""
    },
    district: {
      type: String,
      trim: true,
      default: ""
    },
    city: {
      type: String,
      trim: true,
      default: ""
    },
    state: {
      type: String,
      trim: true,
      default: ""
    },
    pincode: {
      type: String,
      trim: true,
      default: ""
    },
    country: {
      type: String,
      trim: true,
      default: "India"
    }
  },
  { _id: false }
);

const professionalDetailsSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      trim: true,
      default: ""
    },
    designation: {
      type: String,
      trim: true,
      default: ""
    },
    department: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { _id: false }
);

const profileSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
      default: ""
    },
    lastName: {
      type: String,
      trim: true,
      default: ""
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },
    phone: {
      type: phoneSchema,
      default: () => ({})
    },
    address: {
      type: addressSchema,
      default: () => ({})
    },
    professionalDetails: {
      type: professionalDetailsSchema,
      default: () => ({})
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: ""
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
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true
    },

    mobile: {
      type: String,
      trim: true,
      required: true,
      unique: true,
      index: true
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      index: true,
      set: value => {
        if (!value) return undefined;
        return String(value).trim().toLowerCase();
      }
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    role: {
      type: String,
      enum: USER_ROLES,
      default: "customer_admin",
      index: true
    },

    accountStatus: {
      type: String,
      enum: USER_STATUSES,
      default: "active",
      index: true
    },

    profile: {
      type: profileSchema,
      default: () => ({})
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre("validate", function syncProfile(next) {
  if (!this.profile) {
    this.profile = {};
  }

  if (this.email && !this.profile.email) {
    this.profile.email = this.email;
  }

  if (this.mobile && !this.profile.phone?.number) {
    this.profile.phone = {
      ...(this.profile.phone || {}),
      number: this.mobile
    };
  }

  if (!this.profile.firstName && this.name) {
    const parts = this.name.trim().split(" ");
    this.profile.firstName = parts[0] || "";
    this.profile.lastName = parts.slice(1).join(" ") || "";
  }

  next();
});

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    return next();
  }

  const alreadyHashed = /^\$2[aby]\$\d{2}\$/.test(this.password);

  if (!alreadyHashed) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject({
    versionKey: false
  });

  delete obj.password;

  return obj;
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

User.USER_ROLES = USER_ROLES;
User.USER_STATUSES = USER_STATUSES;

module.exports = User;