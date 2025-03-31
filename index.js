const api = require("./src/api");
const cli = require("./src/cli");

module.exports = {
  projectScan: api.projectScan,
  contractScan: api.contractScan,
  analyseProject: api.analyzeProject,
  runTests: api.runTests,
  scan: cli.scan,
};
