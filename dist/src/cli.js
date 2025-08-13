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
exports.scan = scan;
const axios_1 = __importDefault(require("axios"));
const api_1 = require("./api");
const utils = __importStar(require("./utils"));
function scan() {
    const [, , ...args] = process.argv;
    if (args[0] === "scan") {
        const scanType = args[1];
        if (scanType === "project") {
            const provider = args[2];
            const projectUrl = args[3];
            const projectBranch = args[4];
            const projecName = args[5];
            const recurScan = args[7] ? args[7] === 'true' : false;
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
            (0, api_1.projectScan)(payload, apiKey)
                .then((results) => {
                console.log("Scan results:", results);
            })
                .catch((error) => {
                console.error("Error during scan:", error);
            });
        }
        else if (scanType === "contract") {
            const contractAddress = args[2];
            const contractChain = args[3];
            const contractPlatform = args[4];
            const cliProvidedToken = args[5]; // CLI provided token
            if (!contractAddress || !contractChain || !contractPlatform) {
                console.error("Usage: solisityscan scan contract <address> <chain> <platform> [apiToken]");
                process.exit(1);
            }
            try {
                // Get API token from environment or command line
                const apiToken = process.env.SOLIDITYSCAN_API_KEY || cliProvidedToken;
                if (!apiToken) {
                    console.error("No API token provided. Please set SOLIDITYSCAN_API_KEY environment variable or provide token as argument.");
                    process.exit(1);
                }
                const payload = {
                    contract_address: contractAddress,
                    contract_platform: contractPlatform,
                    contract_chain: contractChain,
                };
                (0, api_1.contractScan)(payload, apiToken)
                    .then((results) => {
                    console.log("Scan results:", JSON.stringify(results, null, 2));
                })
                    .catch((error) => {
                    console.error("\nError during scan:", error);
                });
            }
            catch (error) {
                console.error("\nError with API token:", error?.message || error);
                process.exit(1);
            }
        }
    }
    else if (args[0] === "local") {
        const projectPath = args[1];
        const apiKeyFromArgs = args[2] && !process.env.SOLIDITYSCAN_API_KEY;
        const apiKey = process.env.SOLIDITYSCAN_API_KEY || args[2];
        let projectName = apiKeyFromArgs ? args[3] : args[2];
        if (!projectName) {
            projectName = "LocalScan";
        }
        if (!projectPath) {
            console.error("Usage: solisityscan run-tests <projectPath>");
            process.exit(1);
        }
        (0, api_1.analyzeProject)(projectPath, apiKey, projectName)
            .then((results) => {
            const r = results;
            if (r?.scan_details?.link) {
                axios_1.default.get(r.scan_details.link)
                    .then((response) => {
                    utils.displayScanResults(response.data.scan_report);
                })
                    .catch((error) => {
                    console.error("Error during scan:", error);
                });
            }
        })
            .catch((error) => {
            console.error("Error during scan:", error);
        });
    }
    else if (args.includes("-l")) {
        const dirFlagIndex = args.indexOf("-p");
        const serveDirectory = dirFlagIndex !== -1 && args[dirFlagIndex + 1]
            ? args[dirFlagIndex + 1]
            : process.cwd();
        const portFlagIndex = args.indexOf("--port");
        const userSpecifiedPort = portFlagIndex !== -1 && args[portFlagIndex + 1]
            ? parseInt(args[portFlagIndex + 1], 10)
            : null;
        const idFlagIndex = args.indexOf("--id");
        const tunnelId = idFlagIndex !== -1 && args[idFlagIndex + 1]
            ? args[idFlagIndex + 1]
            : null;
        if (!tunnelId) {
            console.error("Missing --id <alphanumeric> argument");
            process.exit(1);
        }
        let portAttempts = 0;
        let port = userSpecifiedPort || 9462;
        let wss;
        while (portAttempts < 5) {
            try {
                wss = utils.startLocalFileServer(serveDirectory, port);
                break; // success
            }
            catch (err) {
                if (userSpecifiedPort || err?.code !== "EADDRINUSE") {
                    console.error(err?.message || "Failed to start local server");
                    process.exit(1);
                }
                port += 1;
                portAttempts += 1;
            }
        }
        if (!wss) {
            console.error("Could not bind to any port between 9462 and 9466");
            process.exit(1);
        }
        (async () => {
            try {
                const localtunnel = require("localtunnel");
                const tunnel = await localtunnel({ port, subdomain: tunnelId });
                const clean = () => {
                    try {
                        tunnel.close();
                    }
                    catch (_) { }
                    try {
                        if (wss)
                            wss.close();
                    }
                    catch (_) { }
                    process.exit(0);
                };
                process.on("SIGINT", clean);
                process.on("SIGTERM", clean);
            }
            catch (e) {
                console.error("Error during tunnel:", e);
            }
        })();
        return;
    }
    else {
        console.error("Unknown command. Usage: solidityscan scan <projectUrl> <branch> <apiKey>");
        process.exit(1);
    }
}
if (require.main === module) {
    // executed via `node src/cli.js ...` – run the CLI
    scan();
}
//# sourceMappingURL=cli.js.map