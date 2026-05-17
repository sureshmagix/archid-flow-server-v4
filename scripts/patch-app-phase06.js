const fs = require("fs");
const path = require("path");

const appPath = path.join(process.cwd(), "src/app.js");
let content = fs.readFileSync(appPath, "utf8");

if (!content.includes('const deviceRoutes = require("./modules/devices/device.routes");')) {
  content = content.replace(
    '// Phase 05 Routes\nconst deviceTypeRoutes = require("./modules/deviceTypes/deviceType.routes");',
    '// Phase 05 Routes\nconst deviceTypeRoutes = require("./modules/deviceTypes/deviceType.routes");\n\n// Phase 06 Routes\nconst deviceRoutes = require("./modules/devices/device.routes");'
  );
}

if (!content.includes('devices: `/api/${config.apiVersion}/devices`')) {
  content = content.replace(
    'deviceTypes: `/api/${config.apiVersion}/device-types`',
    'deviceTypes: `/api/${config.apiVersion}/device-types`,\n      devices: `/api/${config.apiVersion}/devices`'
  );
}

const devicesMount = 'app.use(`/api/${config.apiVersion}/devices`, deviceRoutes);';

if (!content.includes(`\n${devicesMount}\n`)) {
  content = content.replace(
    '// Phase 05 Routes\napp.use(`/api/${config.apiVersion}/device-types`, deviceTypeRoutes);',
    '// Phase 05 Routes\napp.use(`/api/${config.apiVersion}/device-types`, deviceTypeRoutes);\n\n// Phase 06 Routes\napp.use(`/api/${config.apiVersion}/devices`, deviceRoutes);'
  );
}

content = content.replace(
  '// app.use(`/api/${config.apiVersion}/devices`, deviceRoutes);\n',
  ''
);

fs.writeFileSync(appPath, content);
console.log("src/app.js updated for Phase 06 Devices routes");
