const express = require("express");
const authMiddleware = require("../../common/middleware/auth.middleware");
const requireRole = require("../../common/middleware/requireRole");
const asyncHandler = require("../../common/utils/asyncHandler");
const sendResponse = require("../../common/utils/sendResponse");
const { ROLES } = require("../../common/constants/roles");
const { getMqttRuntimeStatus } = require("./mqtt.listener");

const router = express.Router();

// Base path: /api/v1/mqtt

router.get(
  "/status",
  authMiddleware,
  requireRole(ROLES.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    return sendResponse(res, 200, "MQTT status fetched successfully", {
      status: getMqttRuntimeStatus()
    });
  })
);

module.exports = router;