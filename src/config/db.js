const mongoose = require("mongoose");
const config = require("./env");

const connectDB = async () => {
  if (!config.mongoUri) {
    throw new Error("MONGODB_URI is missing in .env file");
  }

  mongoose.set("strictQuery", true);

  const connection = await mongoose.connect(config.mongoUri);

  console.log(`✅ MongoDB connected: ${connection.connection.host}`);

  return connection;
};

module.exports = connectDB;