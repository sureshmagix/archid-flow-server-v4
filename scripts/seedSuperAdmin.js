const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const connectDB = require("../src/config/db");
const User = require("../src/modules/users/user.model");

const SUPER_ADMIN_ROLE = "super_admin";
const ACTIVE_STATUS = "active";

const getRequiredEnv = (key) => {
  const value = process.env[key];

  if (!value || String(value).trim() === "") {
    throw new Error(`${key} is required in .env`);
  }

  return String(value).trim();
};

const buildSuperAdminPayload = async () => {
  const name = getRequiredEnv("SUPER_ADMIN_NAME");
  const mobile = getRequiredEnv("SUPER_ADMIN_MOBILE");
  const email = getRequiredEnv("SUPER_ADMIN_EMAIL").toLowerCase();
  const password = getRequiredEnv("SUPER_ADMIN_PASSWORD");

  const hashedPassword = await bcrypt.hash(password, 10);

  const nameParts = name.split(" ").filter(Boolean);
  const firstName = nameParts[0] || name;
  const lastName = nameParts.slice(1).join(" ");

  return {
    name,
    mobile,
    email,
    password: hashedPassword,
    role: SUPER_ADMIN_ROLE,
    accountStatus: ACTIVE_STATUS,
    profile: {
      firstName,
      lastName,
      email,
      phone: {
        countryCode: process.env.SUPER_ADMIN_COUNTRY_CODE || "+91",
        number: mobile
      },
      address: {
        addressLine1: "",
        addressLine2: "",
        district: "",
        city: "",
        state: "",
        pincode: "",
        country: "India"
      },
      professionalDetails: {
        companyName: "ArchidTech",
        designation: "Super Admin",
        department: "Platform"
      },
      avatarUrl: "",
      isVerified: true,
      verifiedBy: null,
      verifiedAt: new Date()
    }
  };
};

const seedSuperAdmin = async () => {
  try {
    console.log("🚀 Starting super admin seed...");

    await connectDB();

    const payload = await buildSuperAdminPayload();

    const existingUser = await User.findOne({
      $or: [
        { email: payload.email },
        { mobile: payload.mobile }
      ]
    }).select("+password");

    if (existingUser) {
      console.log("ℹ️ Existing user found. Updating role/status/profile...");

      existingUser.name = payload.name;
      existingUser.mobile = payload.mobile;
      existingUser.email = payload.email;
      existingUser.role = SUPER_ADMIN_ROLE;
      existingUser.accountStatus = ACTIVE_STATUS;
      existingUser.profile = {
        ...(existingUser.profile || {}),
        ...payload.profile
      };

      if (process.env.RESET_SUPER_ADMIN_PASSWORD === "true") {
        existingUser.password = payload.password;
        console.log("🔐 Super admin password reset enabled");
      }

      await existingUser.save();

      console.log("✅ Super admin updated successfully");
      console.log({
        id: existingUser._id.toString(),
        name: existingUser.name,
        mobile: existingUser.mobile,
        email: existingUser.email,
        role: existingUser.role,
        accountStatus: existingUser.accountStatus
      });

      return;
    }

    const superAdmin = await User.create(payload);

    console.log("✅ Super admin created successfully");
    console.log({
      id: superAdmin._id.toString(),
      name: superAdmin.name,
      mobile: superAdmin.mobile,
      email: superAdmin.email,
      role: superAdmin.role,
      accountStatus: superAdmin.accountStatus
    });
  } catch (error) {
    console.error("❌ Super admin seed failed:", error.message);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("💤 MongoDB connection closed");
  }
};

seedSuperAdmin();