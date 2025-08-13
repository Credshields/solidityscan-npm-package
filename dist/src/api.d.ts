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
declare function projectScan(projectPayload: ProjectScanPayload, apiToken?: string): Promise<any>;
declare function generateReport(generateReportPayload: GenerateReportPayload, apiToken?: string): Promise<any>;
declare function contractScan(contractPayload: ContractScanPayload, apiToken?: string): Promise<any>;
declare function analyzeProject(projectDirectory: string, apiToken: string | undefined, projectName: string, isRunningTest?: boolean): Promise<any>;
type RunTestsReturn = {
    metadata: unknown;
    scanDetails: unknown;
    resultFile: string;
};
declare function runTests(projectDirectory: string, apiToken: string | undefined, projectName: string): Promise<RunTestsReturn | unknown>;
export { projectScan, generateReport, contractScan, analyzeProject, runTests, };
