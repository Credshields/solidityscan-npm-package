const utils = require("./utils");
const fs = require("fs");
const cliSpinners = require("cli-spinners");
const spinner = cliSpinners.dots;

async function projectScan(projectPayload, apiToken) {
  const request_payload = {
    action: "message",
    payload: {
      type: "private_project_scan_initiate",
      body: projectPayload,
    },
  };
  return utils.initializeWebSocket(apiToken, request_payload);
}

async function contractScan(contractPayload, apiToken) {
  const request_payload = {
    action: "message",
    payload: {
      type: "private_threat_scan_initiate",
      body: contractPayload,
    },
  };
  return utils.initializeWebSocket(apiToken, request_payload);
}

async function analyzeProject(projectDirectory, apiToken, projectName) {
  try {
    const initializingSpinner = await utils.showSpinnerWithStatus(
      "Initializing Scan",
      spinner.frames
    );
    const projectZipPath = await utils.createProjectZip(projectDirectory);
    const uploadUrl = await utils.getUploadPresignedUrl(
      projectZipPath,
      apiToken
    );
    if (uploadUrl) {
      const fileData = fs.readFileSync(projectZipPath);
      const uploadSuccessful = await utils.uploadToS3(fileData, uploadUrl);
      if (uploadSuccessful) {
        utils.stopSpinner(initializingSpinner, "Initializing Scan");
        const scanningSpinner = await utils.showSpinnerWithStatus(
          "Scan in progress",
          spinner.frames
        );
        const request_payload = {
          type: "private_project_scan_initiate",
          body: {
            file_urls: [uploadUrl],
            project_name: projectName,
            project_visibility: "public",
            project_type: "new",
          },
        };
        const result = utils.initializeWebSocket(
          apiToken,
          request_payload,
          scanningSpinner
        );
        return result;
      }
    } else {
      throw new Error(`Error analyzing project`);
    }
  } catch (error) {
    throw new Error(`Error analyzing project from directory: ${error.message}`);
  }
}

async function runTests(projectDirectory, apiToken) {
  analyzeProject(projectDirectory, apiToken)
    .then((results) => {
      utils.displayScanResults(results);
      console.log("");
      console.log("Scan Summary");
      utils.displayScanSummary(results);
    })
    .catch((error) => {
      console.error("Error during scan:", error);
    });
}

module.exports = {
  projectScan,
  contractScan,
  analyzeProject,
  runTests,
};
