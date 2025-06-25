const { default: axios } = require("axios");
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

        contractScan(payload, apiToken)
          .then((results) => {
            console.log("Scan results:",JSON.stringify(results, null, 2));
          })
          .catch((error) => {
            console.error("\nError during scan:", error);
          });
      } catch (error) {
        console.error("\nError with API token:", error);
        process.exit(1);
      }
    }
  } else if (args[0] === "local") {
    const projectPath = args[1];
    const apiKeyFromArgs = args[2] && !process.env.SOLIDITYSCAN_API_KEY;
    const apiKey = process.env.SOLIDITYSCAN_API_KEY || args[2];
    const projectName = apiKeyFromArgs ? args[3] : args[2];

    if(!projectName){
      projectName = "LocalScan";
    }

    if (!projectPath) {
      console.error("Usage: solisityscan run-tests <projectPath>");
      process.exit(1);
    }

    analyzeProject(projectPath, apiKey, projectName)
      .then((results) => {
        if(results?.scan_details?.link){
        axios.get(results.scan_details.link)
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
  } else if (args.includes("-l")) {
    // Start local WebSocket file server to expose file system
    const dirFlagIndex = args.indexOf("-p");
    const serveDirectory =
      dirFlagIndex !== -1 && args[dirFlagIndex + 1]
        ? args[dirFlagIndex + 1]
        : process.cwd();

    const portFlagIndex = args.indexOf("--port");
    const port =
      portFlagIndex !== -1 && args[portFlagIndex + 1]
        ? parseInt(args[portFlagIndex + 1], 10)
        : 8080;
    
    const useTunnel = args.includes("--secure-tunnel");
    const tunnelSubdomain = args.indexOf("--subdomain") !== -1 ? args[args.indexOf("--subdomain") + 1] : null;

    try {
      const wss = utils.startLocalFileServer(serveDirectory, port);
      
      if (useTunnel) {
        try {
          console.log('Creating secure tunnel to expose local server...');
          const localtunnel = require('localtunnel');
          const tunnelOptions = {};
          
          if (tunnelSubdomain) {
            tunnelOptions.subdomain = tunnelSubdomain;
            console.log(`Attempting to use requested subdomain: ${tunnelSubdomain}`);
          }
          
          const dots = ['.', '..', '...', '....'];
          let dotIndex = 0;
          const loadingInterval = setInterval(() => {
            process.stdout.write(`\rEstablishing secure tunnel${dots[dotIndex % dots.length]}     `);
            dotIndex++;
          }, 500);
          
          (async () => {
            try {
              const tunnel = await localtunnel({ port, ...tunnelOptions });
              clearInterval(loadingInterval); 
              process.stdout.write('\r'); 
              
              console.log(`SolidityScan secure tunnel established!`);
              console.log(`HTTPS URL: ${tunnel.url}`);
              console.log(`WebSocket URL: ${tunnel.url.replace('https://', 'wss://')}`);
              
              tunnel.on('close', () => {
                console.log('\nTunnel closed');
              });
              
              tunnel.on('error', (err) => {
                console.error('\nTunnel error:', err);
              });
            } catch (tunnelError) {
              clearInterval(loadingInterval); 
              process.stdout.write('\r'); 
              console.error('Failed to create tunnel:', tunnelError.message);
              console.log('Local server is still running on ws://localhost:' + port + ' without secure tunnel');
              console.log('Try again or check your network connection');
            }
          })();
        } catch (requireError) {
          console.error('Could not load localtunnel module:', requireError.message);
          console.log('Make sure localtunnel is installed: npm install --save localtunnel');
        }
      }
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
    // keep the process alive when in local server mode
    return;
  } else {
    console.error(
      "Unknown command. Usage: solidityscan scan <projectUrl> <branch> <apiKey>"
    );
    process.exit(1);
  }
}

if (require.main === module) {
  // executed via `node src/cli.js ...` – run the CLI
  scan();
}

module.exports = {
  scan,
};
