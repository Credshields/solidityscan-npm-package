const request = require("request");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const axios = require("axios");
const Table = require("cli-table3");

const cliSpinners = require("cli-spinners");
const spinner = cliSpinners.dots;

const getApi = (apiToken) => {
  const apiBaseUrl = "https://api.solidityscan.com/";
  if (apiToken) {
    const instance = axios.create({
      baseURL: apiBaseUrl,
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json, text/plain, */*",
        "Authorization": `Bearer ${apiToken}`,
        "cache-control": "no-cache",
      }
    });
    return instance;
  } else {
    const instance = axios.create({
      baseURL: apiBaseUrl,
      headers: {
        "Content-Type": "application/json",
        "CF-Access-Client-Secret": "",
        "CF-Access-Client-Id": "",
      }
    });
    return instance;
  }
};

const initializeWebSocket = (apiToken, payload, spinner) => {
  const wsUrl = 'wss://api-ws.solidityscan.com/';
    const ws = new WebSocket(wsUrl, {
    rejectUnauthorized: false 
  });
  
  const emitMessage = (messagePayload) => {
    ws.send(
      JSON.stringify({
        action: "message",
        payload: messagePayload,
      })
    );
  };

  return new Promise((resolve, reject) => {
    const connectionTimeout = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket connection timed out waiting for scan results"));
    }, 60000); // 60 second timeout
    ws.on("open", () => {
      if (apiToken) {
        emitMessage({
          type: "auth_token_register",
          body: {
            auth_token: apiToken,
          },
        });
      } else {
        console.log("No authentication token provided, sending payload directly");
        emitMessage(payload);
      }
    });

    ws.on("message", (data) => {
      try {
        const receivedMessage = JSON.parse(data);
        clearTimeout(connectionTimeout);        
        if (receivedMessage.type === "auth_token_register") {
         
          if (payload.payload) {
            emitMessage(payload.payload);
          } else {
            emitMessage(payload);
          }
        } 
        else if (receivedMessage.type === "scan_status") {
          if (receivedMessage.payload?.scan_status === "scan_done") {
            resolve(receivedMessage.payload);
            if (spinner) stopSpinner(spinner, "Scan in progress");
            ws.close();
          }
        }
        else if (receivedMessage.type === "quick_scan_status") {
          if (receivedMessage.payload?.scan_status === "scan_done") {
            resolve(receivedMessage.payload);
            if (spinner) stopSpinner(spinner, "Scan in progress");
            ws.close();
          } else {
            console.log(`\n[WebSocket] Waiting for scan to complete. Current status: ${receivedMessage.payload?.scan_status || receivedMessage.payload?.quick_scan_status || 'processing'}`);
          }
        }
        else if (receivedMessage.type === "quick_scan_result") {          
          if (receivedMessage.payload?.scan_details?.link) {
            request.get(
              receivedMessage.payload.scan_details.link,
              (error, response, body) => {
                if (error) {
                  resolve(error);
                } else if (response.statusCode !== 200) {
                  resolve(error);
                } else {
                  try {
                    const scan_result = JSON.parse(body);
                    resolve(scan_result.scan_report || scan_result);
                  } catch (e) {
                    resolve(body); 
                  }
                }
                if (spinner) stopSpinner(spinner, "Scan in progress");
                ws.close();
              }
            );
          }
        } 
        else if (receivedMessage.type === "error") {
          console.log("\n Error received from server:", receivedMessage.payload?.payload?.error_message || receivedMessage.payload?.error_message || "Unknown error");
          ws.close();
          reject(receivedMessage.payload?.payload?.error_message || receivedMessage.payload?.error_message || "Unknown error from server");
        }
        else {
          if (spinner) {
            process.stdout.write("."); 
          }
        }
      } catch (error) {
        console.error("\nError processing message:", error);
        console.error("\nRaw message data:", data.toString());
      }
    });

    ws.on("error", (error) => {
      console.log(error);
      reject(error);
    });

    ws.on("close", () => {});
  });
};

const createProjectZip = async (projectDirectory) => {
  try {
    const zipFileName = "project.zip";
    const output = fs.createWriteStream(zipFileName);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);

    const gatherSolFiles = (directory) => {
      const files = fs.readdirSync(directory);

      files.forEach((file) => {
        const filePath = path.join(directory, file);

        if (fs.statSync(filePath).isDirectory() && file !== "node_modules") {
          gatherSolFiles(filePath);
        } else if (path.extname(file) === ".sol") {
          const relativePath = path.relative(projectDirectory, filePath);
          const fileContent = fs.readFileSync(filePath);
          archive.append(fileContent, { name: relativePath });
        }
      });
    };

    gatherSolFiles(projectDirectory);

    await archive.finalize();

    return zipFileName;
  } catch (error) {
    throw new Error(`Error creating project ZIP: ${error.message}`);
  }
};

const getUploadPresignedUrl = async (fileName, apiToken) => {
  try {
    const apiUrl = `private/api-get-presigned-url/?file_name=${fileName}`;
    const API = getApi(apiToken);
    const response = await API.get(apiUrl);
    if (response.status === 200 && response.data && response.data.result) {
      return response.data.result.url;
    } else {
      return null;
    }
  } catch (error) {
    throw new Error(`Failed to get presigned URL: ${error.message}`);
  }
};

const uploadToS3 = async (fileData, uploadUrl) => {
  try {
    const response = await axios.put(uploadUrl, fileData, {
      headers: {
        "Content-Type": "application/octet-stream",
      }
    });
        
    if (response.status === 200 || response.status === 204) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
};

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatHtmlForTerminal(htmlContent) {
  if (!htmlContent) return '';
  let text = htmlContent.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<code>(.*?)<\/code>/gi, '`$1`');
  text = text.replace(/<\/?[^>]+(>|$)/g, '');
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

const displayScanResults = (scan) => {
  const table = new Table({
    head: ["#", "NAME", "SEVERITY", "CONFIDENCE", "DESCRIPTION", "REMEDIATION"],
    chars: {
      'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
      'right': '│', 'right-mid': '┤', 'middle': '│'
    },
    style: {
      head: ['bold']
    },
    // Configure optimal column widths
    colWidths: [5, 20, 12, 12, 35, 35],
    wordWrap: true
  });

  console.log("scan===>",scan);
  

  let issueCount = 0;
  scan.multi_file_scan_details.forEach((detail) => {
    const { template_details } = detail;
    if (detail.metric_wise_aggregated_findings) {
      detail.metric_wise_aggregated_findings.forEach((bug) => {
        issueCount++;
        const filePath = bug.findings[0].file_path;
        const location = `${filePath.replace("/project", "")}\nL${bug.findings[0].line_nos_start} - L${bug.findings[0].line_nos_end}`;
        const description = formatHtmlForTerminal(template_details.issue_description);
        const fullDescription = `${description}\n\nLocation:\n${location}`;
        
        const row = [
          `${issueCount}.`,
          template_details.issue_name,
          capitalizeFirstLetter(template_details.issue_severity),
          template_details.issue_confidence,
          fullDescription,
          formatHtmlForTerminal(template_details.issue_remediation)
        ];
        table.push(row);
      });
    }
  });

  if (issueCount === 0) {
    console.log('No security issues found!');
  } else {
    console.log('SECURITY SCAN RESULTS:');
    console.log(table.toString());
    console.log(`Found ${issueCount} security ${issueCount === 1 ? 'issue' : 'issues'}.`);
  }
};

const displayScanSummary = (scan) => {
  const table = new Table();

  const issues_count =
    scan.multi_file_scan_summary.issue_severity_distribution.critical +
    scan.multi_file_scan_summary.issue_severity_distribution.high +
    scan.multi_file_scan_summary.issue_severity_distribution.medium +
    scan.multi_file_scan_summary.issue_severity_distribution.low +
    scan.multi_file_scan_summary.issue_severity_distribution.informational +
    scan.multi_file_scan_summary.issue_severity_distribution.gas;

  table.push(
    {
      Critical:
        scan.multi_file_scan_summary.issue_severity_distribution.critical,
    },
    { High: scan.multi_file_scan_summary.issue_severity_distribution.high },
    {
      Medium: scan.multi_file_scan_summary.issue_severity_distribution.medium,
    },
    { Low: scan.multi_file_scan_summary.issue_severity_distribution.low },
    {
      Informational:
        scan.multi_file_scan_summary.issue_severity_distribution.informational,
    },
    { Gas: scan.multi_file_scan_summary.issue_severity_distribution.gas },
    { "Security Score": `${scan.multi_file_scan_summary.score_v2} / 100` }
  );
  console.log(table.toString());
  console.log(
    `Scan successful! ${issues_count} issues found. To view detailed results and generate a report navigate to solidityscan.com.`
  );
};

// Function to display a spinner with dynamic status
async function showSpinnerWithStatus(statusMessage, spinnerFrames) {
  process.stdout.write(`${statusMessage}... `);

  let frameIndex = 0;

  const interval = setInterval(() => {
    process.stdout.write(spinnerFrames[frameIndex]);
    process.stdout.write("\b");
    frameIndex = (frameIndex + 1) % spinnerFrames.length;
  }, 100);

  return interval;
}

// Function to stop the spinner
function stopSpinner(interval, statusMessage) {
  clearInterval(interval);
  process.stdout.write("\r");
  console.log(`${statusMessage}... Done`);
}

// New helper to serve local directory over WebSocket
function startLocalFileServer(rootDirectory, port = 8080) {
  if (!fs.existsSync(rootDirectory)) {
    throw new Error(`Directory not found: ${rootDirectory}`);
  }

  const absoluteRoot = path.resolve(rootDirectory);
  const wss = new WebSocket.Server({ port });

  // eslint-disable-next-line no-console
  console.log(`SolidityScan local file server started on ws://localhost:${wss.options.port}\nServing directory: ${absoluteRoot}`);

  wss.on("connection", (socket) => {
    socket.on("message", async (raw) => {
      let message;
      try {
        message = JSON.parse(raw);
      } catch (err) {
        socket.send(
          JSON.stringify({ type: "error", error: "Invalid JSON message" })
        );
        return;
      }

      const { action, payload } = message;

      if (action === "listFiles") {
        // Return hierarchical folder tree with metadata
        const buildTree = (dir, relPath = "") => {
          const name = path.basename(dir);
          const stat = fs.statSync(dir);
          if (stat.isDirectory()) {
            const dirs = [];
            const files = [];
            fs.readdirSync(dir).forEach((entry) => {
              if (entry === "node_modules") return;
              const abs = path.join(dir, entry);
              const rootName = path.basename(absoluteRoot);
              
              let childRel;
              if (relPath === "") {
                childRel = path.join(rootName, entry);
              } else {
                childRel = path.join(relPath, entry);
              }
              
              if (fs.statSync(abs).isDirectory()) {
                dirs.push(buildTree(abs, childRel + path.sep));
              } else {
                const fStat = fs.statSync(abs);
                files.push({
                  path: childRel,
                  name: entry,
                  size: fStat.size,
                  mtimeMs: fStat.mtimeMs,
                  checked: entry.endsWith(".sol"),
                });
              }
            });

            // Determine checked / isChildCheck flags
            const numSol = files.filter((f) => f.checked).length;
            const numNonSol = files.length - numSol;
            let checkedDir = false;
            let isChildCheck = false;
            if (numSol === 0) {
              checkedDir = false;
              isChildCheck = false;
            } else if (numNonSol === 0) {
              checkedDir = true;
              isChildCheck = true;
            } else {
              checkedDir = false;
              isChildCheck = true;
            }

            let dirPath;
            if (dir === absoluteRoot) {
              dirPath = path.basename(absoluteRoot) + "/";
            } else {
              dirPath = relPath + (relPath && !relPath.endsWith(path.sep) ? path.sep : "");
            }
            
            return {
              name,
              path: dirPath,
              tree: dirs,
              isChildCheck,
              checked: checkedDir,
              blobs: files,
              size: 0,
              mtimeMs: stat.mtimeMs,
            };
          }
          // Should not reach here for files as we handle in parent
        };

        const rootTreeInternal = buildTree(absoluteRoot, "");
        const responseTree = {
          name: "",
          path: "",
          tree: [rootTreeInternal],
          isChildCheck: rootTreeInternal.isChildCheck,
          checked: rootTreeInternal.checked,
          blobs: [],
          size: 0,
          mtimeMs: rootTreeInternal.mtimeMs,
        };

        socket.send(
          JSON.stringify({ type: "folderStructure", tree: responseTree })
        );
      } else if (action === "zipAndSendFiles") {
        const presignedUrl = payload.presigned_url;
        const skip = new Set(payload.skip_file_paths || []);
        if (!presignedUrl) {
          socket.send(
            JSON.stringify({ type: "error", error: "presigned_url missing" })
          );
          return;
        }

        const archive = archiver("zip", { zlib: { level: 9 } });
        const chunks = [];

        archive.on("data", (chunk) => chunks.push(chunk));
        archive.on("warning", (err) => {
          if (err.code !== "ENOENT") {
            socket.send(JSON.stringify({ type: "error", error: err.message }));
          }
        });
        archive.on("error", (err) => {
          socket.send(JSON.stringify({ type: "error", error: err.message }));
        });
        archive.on("end", async () => {
          const buffer = Buffer.concat(chunks);

          let success = false;
          try {
            if (presignedUrl.startsWith("memory://")) {
              // test stub
              success = true;
            } else {
              success = await uploadToS3(buffer, presignedUrl);
            }
          } catch (e) {
            console.log("error uploading file",e)
            success = false;
          }

          socket.send(
            JSON.stringify({
              type: "uploadStatus",
              success,
            })
          );
        });

        // recursively walk and add files not skipped
        const walkAdd = (dir, rel = "") => {
          fs.readdirSync(dir).forEach((entry) => {
            if (entry === "node_modules") return;
            const abs = path.join(dir, entry);
            const relPath = path.join(rel, entry);
            const relPathPosix = relPath.split(path.sep).join("/");
            const stat = fs.statSync(abs);
            if (stat.isDirectory()) {
              walkAdd(abs, relPath);
            } else {
              if (!skip.has(relPathPosix)) {
                archive.file(abs, { name: relPath });
              }
            }
          });
        };
        walkAdd(absoluteRoot, "");
        archive.finalize();
      } else {
        socket.send(
          JSON.stringify({ type: "error", error: "Unknown action" })
        );
      }
    });
  });

  return wss;
}

module.exports = {
  initializeWebSocket,
  createProjectZip,
  getUploadPresignedUrl,
  uploadToS3,
  displayScanResults,
  displayScanSummary,
  showSpinnerWithStatus,
  stopSpinner,
  startLocalFileServer,
};
