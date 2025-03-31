const { projectScan, contractScan, analyzeProject } = require("./api");
const utils = require("./utils");

function scan() {
  const [, , ...args] = process.argv;

  if (args[0] === "scan") {
    const scanType = args[1];
    if (scanType === "project") {
      const provider = args[2];
      const projectUrl = args[3];
      const projectBranch = args[4];
      const projecName = args[5];
      const recurScan = args[7];
      const apiKey = process.env.SOLIDITYSCAN_API_KEY || args[6];

      if (!provider || !projectUrl || !projectBranch || !projecName) {
        console.error("Usage: solisityscan scan <projectUrl> <branch>");
        process.exit(1);
      }

      const payload = {
        provider: provider,
        project_url: projectUrl,
        project_name: projecName,
        project_branch: projectBranch,
        recur_scans: recurScan || false,
        skip_file_paths: [],
      };

      projectScan(payload, apiKey)
        .then((results) => {
          console.log("Scan results:", results);
        })
        .catch((error) => {
          console.error("Error during scan:", error);
        });
    } else if (scanType === "contract") {
      const contractAddress = args[2];
      const contractChain = args[3];
      const contractPlatform = args[4];
      const apiKey = process.env.SOLIDITYSCAN_API_KEY || args[5];

      if (!contractAddress || !contractChain || !contractPlatform) {
        console.error("Usage: solisityscan scan <projectUrl> <branch>");
        process.exit(1);
      }

      const payload = {
        contract_address: contractAddress,
        contract_platform: contractPlatform,
        contract_chain: contractPlatform,
      };

      contractScan(payload, apiKey)
        .then((results) => {
          console.log("Scan results:", results);
        })
        .catch((error) => {
          console.error("Error during scan:", error);
        });
    }
  } else if (args[0] === "test") {
    const projectPath = args[1];
    const apiKey = process.env.SOLIDITYSCAN_API_KEY || args[2];

    if (!projectPath) {
      console.error("Usage: solisityscan run-tests <projectPath>");
      process.exit(1);
    }

    analyzeProject(projectPath, apiKey)
      .then((results) => {
        utils.displayScanResults(results);
        console.log("");
        console.log("Scan Summary");
        utils.displayScanSummary(results);
      })
      .catch((error) => {
        console.error("Error during scan:", error);
      });
  } else {
    console.error(
      "Unknown command. Usage: solidityscan scan <projectUrl> <branch> <apiKey>"
    );
    process.exit(1);
  }
}

module.exports = {
  scan,
};
