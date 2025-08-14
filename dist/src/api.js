"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectScan = projectScan;
exports.generateReport = generateReport;
exports.contractScan = contractScan;
exports.analyzeProject = analyzeProject;
exports.runTests = runTests;
exports.quickScanProject = quickScanProject;
exports.quickScanContract = quickScanContract;
const utils = __importStar(require("./utils"));
const fs_1 = __importDefault(require("fs"));
const cli_spinners_1 = __importDefault(require("cli-spinners"));
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const spinner = cli_spinners_1.default.dots;
async function projectScan(projectPayload, apiToken, spinner = true) {
    const request_payload = {
        action: "message",
        payload: {
            type: "private_project_scan_initiate",
            body: projectPayload,
        },
    };
    return utils.initializeWebSocket(apiToken, request_payload, spinner);
}
async function quickScanProject(projectPayload, apiToken, spinner = true) {
    const request_payload = {
        action: "message",
        payload: {
            type: "private_quick_scan_initiate",
            body: projectPayload,
        },
    };
    return utils.initializeWebSocket(apiToken, request_payload, spinner);
}
async function quickScanContract(contractPayload, apiToken, spinner = true) {
    const request_payload = {
        action: "message",
        payload: {
            type: "private_quick_scan_initiate",
            body: contractPayload,
        },
    };
    return utils.initializeWebSocket(apiToken, request_payload, spinner);
}
async function generateReport(generateReportPayload, apiToken, spinner = true) {
    const request_payload = {
        action: "message",
        payload: {
            type: "generate_report",
            body: generateReportPayload,
        },
    };
    return utils.initializeWebSocket(apiToken, request_payload, spinner);
}
async function contractScan(contractPayload, apiToken, spinner = true) {
    const request_payload = {
        action: "message",
        payload: {
            type: "private_threat_scan_initiate",
            body: contractPayload,
        },
    };
    return utils.initializeWebSocket(apiToken, request_payload, spinner);
}
async function analyzeProject(projectDirectory, apiToken, projectName, isRunningTest = false) {
    try {
        const initializingSpinner = await utils.showSpinnerWithStatus("Initializing Scan", spinner.frames);
        const projectZipPath = await utils.createProjectZip(projectDirectory);
        const uploadUrl = await utils.getUploadPresignedUrl(projectZipPath, apiToken);
        if (uploadUrl) {
            const fileData = fs_1.default.readFileSync(projectZipPath);
            const uploadSuccessful = await utils.uploadToS3(fileData, uploadUrl);
            if (uploadSuccessful) {
                utils.stopSpinner(initializingSpinner, "Initializing Scan");
                const scanningSpinner = await utils.showSpinnerWithStatus("Scan in progress", spinner.frames);
                const request_payload = {
                    type: "private_project_scan_initiate",
                    body: {
                        file_urls: [uploadUrl],
                        project_name: projectName,
                        project_visibility: "public",
                        project_type: "new",
                    },
                };
                const result = utils.initializeWebSocket(apiToken, request_payload);
                return result;
            }
        }
        else {
            throw new Error(`Error analyzing project`);
        }
    }
    catch (error) {
        throw new Error(`Error analyzing project from directory: ${error.message}`);
    }
}
async function runTests(projectDirectory, apiToken, projectName) {
    try {
        const results = await analyzeProject(projectDirectory, apiToken, projectName, true);
        const maybeResults = results;
        if (maybeResults && maybeResults.scan_details && maybeResults.scan_details.link) {
            const response = await axios_1.default.get(maybeResults.scan_details.link, {
                httpsAgent: new https_1.default.Agent({ rejectUnauthorized: false })
            });
            const scanData = response.data;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `scan-result-${maybeResults.scan_id}-${timestamp}.json`;
            fs_1.default.writeFileSync(filename, JSON.stringify(scanData, null, 2));
            console.log(`\nScan results saved to: ${filename}`);
            return {
                metadata: maybeResults,
                scanDetails: scanData,
                resultFile: filename
            };
        }
        else {
            console.error("Error: Scan results link not found in the response");
            return results;
        }
    }
    catch (error) {
        console.error("Error during scan:", error?.message || error);
        if (error?.response) {
            console.error("API response error:", error.response.data);
        }
        throw error;
    }
}
//# sourceMappingURL=api.js.map