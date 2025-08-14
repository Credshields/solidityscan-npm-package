import * as api from "./src/api";
import * as cli from "./src/cli";

export const projectScan = api.projectScan;
export const generateReport = api.generateReport;
export const quickScanProject = api.quickScanProject;
export const quickScanContract = api.quickScanContract;
export const contractScan = api.contractScan;
export const analyseProject = api.analyzeProject;
export const runTests = api.runTests;
export const scan = cli.scan;
