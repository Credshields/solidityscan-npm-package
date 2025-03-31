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
  if (apiToken) {
    return axios.create({
      baseURL: "https://api-develop.solidityscan.com/",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
        "CF-Access-Client-Secret":
          "a4ca6863cf1cd0c21cc9ee7717d2588f0b520bab01e96d608e554cf2ef70f287",
        "CF-Access-Client-Id": "e00adeef9b08d16e7255231ab4e727f1.access",
      },
    });
  } else {
    return axios.create({
      baseURL: "https://api-develop.solidityscan.com/",
      headers: {
        "Content-Type": "application/json",
        "CF-Access-Client-Secret":
          "a4ca6863cf1cd0c21cc9ee7717d2588f0b520bab01e96d608e554cf2ef70f287",
        "CF-Access-Client-Id": "e00adeef9b08d16e7255231ab4e727f1.access",
      },
    });
  }
};

const initializeWebSocket = (apiToken, payload, spinner) => {
  const wsUrl = `${"wss://api-ws-stage.solidityscan.com/stage"}${
    apiToken ? `?auth_token=${apiToken}` : ""
  }`;
  const ws = new WebSocket(wsUrl);

  return new Promise((resolve, reject) => {
    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          action: "message",
          payload: payload,
        })
      );
    });

    ws.on("message", (data) => {
      const receivedMessage = JSON.parse(data);
      if (receivedMessage.type === "error") {
        ws.close();
        reject(receivedMessage.payload.payload.error_message);
      } else if (receivedMessage.type === "scan_status") {
        if (receivedMessage.payload.scan_status === "scan_done") {
          request.get(
            receivedMessage.payload.scan_details.link,
            (error, response, body) => {
              if (error) {
                resolve(error);
              } else if (response.statusCode !== 200) {
                resolve(error);
              } else {
                const scan_result = JSON.parse(body);
                resolve(scan_result.scan_report);
              }
              stopSpinner(spinner, "Scan in progress");
              ws.close();
            }
          );
        }
      }
      console.log(receivedMessage);
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
  const apiUrl = `private/api-get-presigned-url/?file_name=${fileName}`;
  const API = getApi(apiToken);
  const response = await API.get(apiUrl);
  if (response.status === 200 && response.data && response.data.result) {
    return response.data.result.url;
  } else {
    return null;
  }
};

const uploadToS3 = async (fileData, uploadUrl) => {
  try {
    const response = await axios.put(uploadUrl, fileData, {
      headers: {
        "Content-Type": "application/octet-stream",
      },
    });
    if (response.status === 200) {
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

const displayScanResults = (scan) => {
  const table = new Table({
    head: ["Issue Name", "Issue Severity", "File Path", "Line No."],
  });

  scan.multi_file_scan_details.forEach((detail) => {
    const { template_details } = detail;
    if (detail.metric_wise_aggregated_findings) {
      detail.metric_wise_aggregated_findings.forEach((bug) => {
        const filePath = bug.findings[0].file_path;
        const line = `L${bug.findings[0].line_nos_start} - L${bug.findings[0].line_nos_end}`;
        const row = [
          template_details.issue_name,
          capitalizeFirstLetter(template_details.issue_severity),
          filePath.replace("/project", ""),
          line,
        ];
        table.push(row);
      });
    }
  });

  console.log(table.toString());
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

module.exports = {
  initializeWebSocket,
  createProjectZip,
  getUploadPresignedUrl,
  uploadToS3,
  displayScanResults,
  displayScanSummary,
  showSpinnerWithStatus,
  stopSpinner,
};
