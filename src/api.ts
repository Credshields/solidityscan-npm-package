import * as utils from "./utils";
import fs from "fs";
import cliSpinners from "cli-spinners";
import axios from "axios";
import https from "https";
const spinner = cliSpinners.dots;

export interface ProjectScanPayload {
  provider: string;
  project_url: string;
  project_name: string;
  project_branch: string;
  recur_scans?: boolean;
  skip_file_paths?: string[];
}

export interface ContractScanPayload {
  contract_address: string;
  contract_platform: string;
  contract_chain: string;
}

export interface GenerateReportPayload {
  project_id: string;
  scan_id: string;
  scan_type: string;
}

async function projectScan(projectPayload: ProjectScanPayload, apiToken?: string, spinner: boolean = true) {
  const request_payload = {
    action: "message",
    payload: {
      type: "private_project_scan_initiate",
      body: projectPayload,
    },
  };
  return utils.initializeWebSocket(apiToken, request_payload, spinner);
}

async function quickScanProject(projectPayload: ProjectScanPayload, apiToken?: string, spinner: boolean = true) {
  const request_payload = {
    action: "message",
    payload: {
      type: "private_quick_scan_initiate",
      body: projectPayload,
    },
  };
  return utils.initializeWebSocket(apiToken, request_payload, spinner);
}

async function quickScanContract(contractPayload: ContractScanPayload, apiToken?: string, spinner: boolean = true) {
  const request_payload = {
    action: "message",
    payload: {
      type: "private_quick_scan_initiate",
      body: contractPayload,
    },
  };
  return utils.initializeWebSocket(apiToken, request_payload, spinner);
}


async function generateReport(
  generateReportPayload: GenerateReportPayload,
  apiToken?: string,
  spinner: boolean = true
) {
  const request_payload = {
    action: "message",
    payload: {
      type: "generate_report",
      body: generateReportPayload,
    },
  };
  return utils.initializeWebSocket(apiToken, request_payload, spinner);
}

async function contractScan(contractPayload: ContractScanPayload, apiToken?: string, spinner: boolean = true) {
  const request_payload = {
    action: "message",
    payload: {
      type: "private_threat_scan_initiate",
      body: contractPayload,
    },
  };
  return utils.initializeWebSocket(apiToken, request_payload, spinner);
}

async function analyzeProject(
  projectDirectory: string,
  apiToken: string | undefined,
  projectName: string,
  isRunningTest = false
) {
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
          request_payload
        );
        return result;
      }
    } else {
      throw new Error(`Error analyzing project`);
    }
  } catch (error: any) {
    throw new Error(`Error analyzing project from directory: ${error.message}`);
  }
}

type RunTestsReturn = {
  metadata: unknown;
  scanDetails: unknown;
  resultFile: string;
};

async function runTests(
  projectDirectory: string,
  apiToken: string | undefined,
  projectName: string
): Promise<RunTestsReturn | unknown> {
  try {
    const results = await analyzeProject(projectDirectory, apiToken, projectName, true);
    
    const maybeResults: any = results as any;
    if (maybeResults && maybeResults.scan_details && maybeResults.scan_details.link) {
      const response = await axios.get(maybeResults.scan_details.link, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false })
      });
      
      const scanData = response.data;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `scan-result-${maybeResults.scan_id}-${timestamp}.json`;
      
      fs.writeFileSync(filename, JSON.stringify(scanData, null, 2));
      console.log(`\nScan results saved to: ${filename}`);
      
      return {
        metadata: maybeResults,
        scanDetails: scanData,
        resultFile: filename
      };
    } else {
      console.error("Error: Scan results link not found in the response");
      return results; 
    }
  } catch (error: any) {
    console.error("Error during scan:", error?.message || error);
    if (error?.response) {
      console.error("API response error:", error.response.data);
    }
    throw error;
  }
}

export {
  projectScan,
  generateReport,
  contractScan,
  analyzeProject,
  runTests,
  quickScanProject,
  quickScanContract,
};
