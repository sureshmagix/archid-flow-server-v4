const fs = require("fs");
const path = require("path");
const YAML = require("yamljs");

const openapiPath = path.join(process.cwd(), "docs/openapi/openapi.yaml");
const openapi = YAML.load(openapiPath);

openapi.tags = openapi.tags || [];
if (!openapi.tags.some(tag => tag.name === "Devices")) {
  openapi.tags.push({
    name: "Devices",
    description: "Customer IoT device inventory and live-state APIs"
  });
}

openapi.paths = openapi.paths || {};
openapi.components = openapi.components || {};
openapi.components.schemas = openapi.components.schemas || {};

const errorResponse = { $ref: "#/components/schemas/ErrorResponse" };
const bearer = [{ bearerAuth: [] }];

openapi.paths["/api/v1/devices"] = {
  post: {
    tags: ["Devices"],
    summary: "Create device",
    description:
      "Creates a device under a company and optional site. super_admin must send company ID. customer_admin can create only under their assigned company.",
    security: bearer,
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateDeviceRequest" },
          example: {
            company: "65f1234567890abcdef12345",
            site: "65f1234567890abcdef12345",
            deviceType: "65f1234567890abcdef12345",
            name: "Demo Basic Light 01",
            deviceCode: "LIGHT-001",
            hardwareId: "ATL-LIGHT-0001",
            serialNumber: "SN-LIGHT-0001",
            macAddress: "AA:BB:CC:DD:EE:01",
            firmwareVersion: "1.0.0",
            provisioningStatus: "unclaimed",
            operationalStatus: "active",
            connectionStatus: "offline",
            liveState: {
              power: false
            },
            metadata: {
              locationLabel: "Reception"
            },
            notes: "Created during Phase 06 testing"
          }
        }
      }
    },
    responses: {
      201: {
        description: "Device created successfully",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DeviceResponse" }
          }
        }
      },
      400: {
        description: "Validation failed or invalid relation",
        content: { "application/json": { schema: errorResponse } }
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: errorResponse } }
      },
      403: {
        description: "Forbidden",
        content: { "application/json": { schema: errorResponse } }
      },
      404: {
        description: "Company, site, owner, or device type not found",
        content: { "application/json": { schema: errorResponse } }
      },
      409: {
        description: "Duplicate hardwareId or company deviceCode",
        content: { "application/json": { schema: errorResponse } }
      }
    }
  },
  get: {
    tags: ["Devices"],
    summary: "List devices",
    description:
      "Lists devices. super_admin can list all devices or filter by company. Customer users can list only devices under their assigned company.",
    security: bearer,
    parameters: [
      { in: "query", name: "page", schema: { type: "integer", example: 1 } },
      { in: "query", name: "limit", schema: { type: "integer", example: 20 } },
      { in: "query", name: "company", schema: { type: "string", example: "65f1234567890abcdef12345" } },
      { in: "query", name: "site", schema: { type: "string", example: "65f1234567890abcdef12345" } },
      { in: "query", name: "deviceType", schema: { type: "string", example: "65f1234567890abcdef12345" } },
      { in: "query", name: "owner", schema: { type: "string", example: "65f1234567890abcdef12345" } },
      { in: "query", name: "operationalStatus", schema: { $ref: "#/components/schemas/DeviceOperationalStatus" } },
      { in: "query", name: "connectionStatus", schema: { $ref: "#/components/schemas/DeviceConnectionStatus" } },
      { in: "query", name: "provisioningStatus", schema: { $ref: "#/components/schemas/DeviceProvisioningStatus" } },
      { in: "query", name: "q", schema: { type: "string", example: "LIGHT-001" } }
    ],
    responses: {
      200: {
        description: "Devices fetched successfully",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DeviceListResponse" }
          }
        }
      },
      400: {
        description: "Invalid filter query",
        content: { "application/json": { schema: errorResponse } }
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: errorResponse } }
      },
      403: {
        description: "Forbidden",
        content: { "application/json": { schema: errorResponse } }
      }
    }
  }
};

openapi.paths["/api/v1/devices/{deviceId}"] = {
  get: {
    tags: ["Devices"],
    summary: "Get device by ID",
    description:
      "Fetches one device by MongoDB ObjectId. super_admin can access any device. Customer users can access only devices under their assigned company.",
    security: bearer,
    parameters: [
      {
        in: "path",
        name: "deviceId",
        required: true,
        schema: { type: "string", example: "65f1234567890abcdef12345" }
      }
    ],
    responses: {
      200: {
        description: "Device fetched successfully",
        content: { "application/json": { schema: { $ref: "#/components/schemas/DeviceResponse" } } }
      },
      400: { description: "Invalid device ID", content: { "application/json": { schema: errorResponse } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: errorResponse } } },
      403: { description: "Forbidden", content: { "application/json": { schema: errorResponse } } },
      404: { description: "Device not found", content: { "application/json": { schema: errorResponse } } }
    }
  },
  patch: {
    tags: ["Devices"],
    summary: "Update device",
    description:
      "Updates device details. super_admin can update any device. customer_admin can update only devices under their assigned company.",
    security: bearer,
    parameters: [
      {
        in: "path",
        name: "deviceId",
        required: true,
        schema: { type: "string", example: "65f1234567890abcdef12345" }
      }
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/UpdateDeviceRequest" },
          example: {
            name: "Demo Basic Light 01 Updated",
            firmwareVersion: "1.0.1",
            metadata: {
              locationLabel: "Reception Updated"
            },
            notes: "Updated during Phase 06 testing"
          }
        }
      }
    },
    responses: {
      200: {
        description: "Device updated successfully",
        content: { "application/json": { schema: { $ref: "#/components/schemas/DeviceResponse" } } }
      },
      400: { description: "Validation failed", content: { "application/json": { schema: errorResponse } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: errorResponse } } },
      403: { description: "Forbidden", content: { "application/json": { schema: errorResponse } } },
      404: { description: "Device or relation not found", content: { "application/json": { schema: errorResponse } } },
      409: { description: "Duplicate hardwareId or company deviceCode", content: { "application/json": { schema: errorResponse } } }
    }
  }
};

openapi.paths["/api/v1/devices/{deviceId}/status"] = {
  patch: {
    tags: ["Devices"],
    summary: "Update device operational status",
    description: "Updates device operational status to active, inactive, or maintenance.",
    security: bearer,
    parameters: [
      {
        in: "path",
        name: "deviceId",
        required: true,
        schema: { type: "string", example: "65f1234567890abcdef12345" }
      }
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/UpdateDeviceStatusRequest" },
          example: { operationalStatus: "maintenance" }
        }
      }
    },
    responses: {
      200: {
        description: "Device status updated successfully",
        content: { "application/json": { schema: { $ref: "#/components/schemas/DeviceResponse" } } }
      },
      400: { description: "Validation failed", content: { "application/json": { schema: errorResponse } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: errorResponse } } },
      403: { description: "Forbidden", content: { "application/json": { schema: errorResponse } } },
      404: { description: "Device not found", content: { "application/json": { schema: errorResponse } } }
    }
  }
};

openapi.paths["/api/v1/devices/{deviceId}/live-state"] = {
  patch: {
    tags: ["Devices"],
    summary: "Update device live state",
    description:
      "Updates connection status, last seen timestamps, and live state. This is useful for Phase 06 manual testing and later MQTT ingestion.",
    security: bearer,
    parameters: [
      {
        in: "path",
        name: "deviceId",
        required: true,
        schema: { type: "string", example: "65f1234567890abcdef12345" }
      }
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/UpdateDeviceLiveStateRequest" },
          example: {
            connectionStatus: "online",
            liveState: {
              power: true,
              rssi: -55
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: "Device live state updated successfully",
        content: { "application/json": { schema: { $ref: "#/components/schemas/DeviceResponse" } } }
      },
      400: { description: "Validation failed", content: { "application/json": { schema: errorResponse } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: errorResponse } } },
      403: { description: "Forbidden", content: { "application/json": { schema: errorResponse } } },
      404: { description: "Device not found", content: { "application/json": { schema: errorResponse } } }
    }
  }
};

openapi.components.schemas.DeviceOperationalStatus = {
  type: "string",
  enum: ["active", "inactive", "maintenance"],
  example: "active"
};

openapi.components.schemas.DeviceConnectionStatus = {
  type: "string",
  enum: ["online", "offline", "unknown"],
  example: "offline"
};

openapi.components.schemas.DeviceProvisioningStatus = {
  type: "string",
  enum: ["unclaimed", "claimed"],
  example: "unclaimed"
};

openapi.components.schemas.Device = {
  type: "object",
  properties: {
    _id: { type: "string", example: "65f1234567890abcdef12345" },
    id: { type: "string", example: "65f1234567890abcdef12345" },
    company: { type: "object" },
    site: { type: "object", nullable: true },
    deviceType: { type: "object" },
    owner: { type: "object", nullable: true },
    name: { type: "string", example: "Demo Basic Light 01" },
    deviceCode: { type: "string", example: "LIGHT-001" },
    hardwareId: { type: "string", example: "ATL-LIGHT-0001" },
    serialNumber: { type: "string", nullable: true, example: "SN-LIGHT-0001" },
    macAddress: { type: "string", nullable: true, example: "AA:BB:CC:DD:EE:01" },
    firmwareVersion: { type: "string", nullable: true, example: "1.0.0" },
    mqttTopicBase: { type: "string", nullable: true, example: "archid/basic-light/atl-light-0001" },
    provisioningStatus: { $ref: "#/components/schemas/DeviceProvisioningStatus" },
    operationalStatus: { $ref: "#/components/schemas/DeviceOperationalStatus" },
    connectionStatus: { $ref: "#/components/schemas/DeviceConnectionStatus" },
    lastSeenAt: { type: "string", format: "date-time", nullable: true },
    lastHeartbeatAt: { type: "string", format: "date-time", nullable: true },
    liveState: { type: "object", additionalProperties: true },
    metadata: { type: "object", additionalProperties: true },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" }
  }
};

openapi.components.schemas.CreateDeviceRequest = {
  type: "object",
  required: ["deviceType", "name", "deviceCode", "hardwareId"],
  properties: {
    company: { type: "string", description: "Required for super_admin. customer_admin uses assigned company." },
    site: { type: "string", nullable: true },
    deviceType: { type: "string" },
    owner: { type: "string", nullable: true },
    name: { type: "string" },
    deviceCode: { type: "string" },
    hardwareId: { type: "string" },
    serialNumber: { type: "string", nullable: true },
    macAddress: { type: "string", nullable: true },
    firmwareVersion: { type: "string", nullable: true },
    mqttTopicBase: { type: "string", nullable: true },
    provisioningStatus: { $ref: "#/components/schemas/DeviceProvisioningStatus" },
    operationalStatus: { $ref: "#/components/schemas/DeviceOperationalStatus" },
    connectionStatus: { $ref: "#/components/schemas/DeviceConnectionStatus" },
    liveState: { type: "object", additionalProperties: true },
    metadata: { type: "object", additionalProperties: true },
    notes: { type: "string", nullable: true }
  }
};

openapi.components.schemas.UpdateDeviceRequest = {
  allOf: [{ $ref: "#/components/schemas/CreateDeviceRequest" }]
};

openapi.components.schemas.UpdateDeviceStatusRequest = {
  type: "object",
  required: ["operationalStatus"],
  properties: {
    operationalStatus: { $ref: "#/components/schemas/DeviceOperationalStatus" }
  }
};

openapi.components.schemas.UpdateDeviceLiveStateRequest = {
  type: "object",
  properties: {
    connectionStatus: { $ref: "#/components/schemas/DeviceConnectionStatus" },
    liveState: { type: "object", additionalProperties: true },
    lastSeenAt: { type: "string", format: "date-time" },
    lastHeartbeatAt: { type: "string", format: "date-time" }
  }
};

openapi.components.schemas.DeviceResponse = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string", example: "Device fetched successfully" },
    data: {
      type: "object",
      properties: {
        device: { $ref: "#/components/schemas/Device" }
      }
    }
  }
};

openapi.components.schemas.DeviceListResponse = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string", example: "Devices fetched successfully" },
    data: {
      type: "object",
      properties: {
        page: { type: "integer", example: 1 },
        limit: { type: "integer", example: 20 },
        total: { type: "integer", example: 1 },
        totalPages: { type: "integer", example: 1 },
        devices: {
          type: "array",
          items: { $ref: "#/components/schemas/Device" }
        }
      }
    }
  }
};

const output = YAML.stringify(openapi, 20, 2);
fs.writeFileSync(openapiPath, output);
console.log("docs/openapi/openapi.yaml updated with Phase 06 Devices APIs");
