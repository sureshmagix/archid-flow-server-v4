const path = require("path");
const YAML = require("yamljs");

const swaggerDocumentPath = path.join(__dirname, "../../docs/openapi/openapi.yaml");

const swaggerDocument = YAML.load(swaggerDocumentPath);

// Additions are kept separate from the existing phase documentation.
const fs = require("fs");
const additions = path.join(__dirname, "../../docs/openapi/additions.json");
if (fs.existsSync(additions)) {
  const patch = JSON.parse(fs.readFileSync(additions, "utf8"));
  for (const [route, methods] of Object.entries(patch.paths || {})) {
    swaggerDocument.paths[route] = { ...swaggerDocument.paths[route], ...methods };
  }
}
module.exports = swaggerDocument;