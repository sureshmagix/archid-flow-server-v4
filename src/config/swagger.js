const path = require("path");
const YAML = require("yamljs");

const swaggerDocumentPath = path.join(__dirname, "../../docs/openapi/openapi.yaml");

const swaggerDocument = YAML.load(swaggerDocumentPath);

module.exports = swaggerDocument;