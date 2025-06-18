# SolidityScan

Secure your Solidity smart contracts straight from your terminal or JavaScript code! **SolidityScan** is a lightweight CLI and Node.js library that connects to the [CredShields SolidityScan](https://solidityscan.com) API to identify vulnerabilities, gas optimisations, and other issues in your smart-contract projects.

---

## Table of Contents

1. [Features](#features)
2. [Installation](#installation)
3. [Getting an API Key](#getting-an-api-key)
4. [CLI Usage](#cli-usage)
   * [Scan a remote project](#scan-a-remote-project)
   * [Scan a contract address](#scan-a-contract-address)
   * [Scan a local directory](#scan-a-local-directory)
   * [Run a local file server](#run-a-local-file-server)
5. [Programmatic Usage](#programmatic-usage)
6. [Examples](#examples)
7. [Contributing](#contributing)
8. [License](#license)

---

## Features

• 🔍 **Project & Contract Scanning** – Analyse entire Git repositories or individual contract addresses for known vulnerabilities.<br/>
• 📦 **Local Directory Scanning** – Zip and upload your local Solidity source code and get instant feedback in the terminal.<br/>
• ⚡ **Real-time Progress** – Live WebSocket updates with an elegant spinner so you always know the scan status.<br/>
• 📋 **Readable Reports** – Vulnerabilities and severities are displayed in coloured, column-aligned tables, followed by a concise scan summary.
• 🌐 **Local WebSocket File Server** – Spin up a file server for quick web-UI integrations and demos.

---

## Installation

```bash
# Install globally to use the `solidityscan` CLI
yarn global add solidityscan        # or npm install -g solidityscan

# Add to a project for programmatic use
npm install solidityscan --save     # or yarn add solidityscan
```

> **Requirement**: Node.js >= 14

---

## Getting an API Key

1. Sign up or log in at [solidityscan.com](https://solidityscan.com).
2. Navigate to **API Keys** and generate a new key.
3. Either export it as an environment variable:

```bash
export SOLIDITYSCAN_API_KEY="YOUR_API_KEY"
```

…or pass it as the last argument in each CLI command (see below).

---

## CLI Usage

After installing globally you will have a `solidityscan` binary in your PATH.
Run `solidityscan --help` to view the brief usage guide.

### Scan a Remote Project

```bash
solidityscan scan project <provider> <repo-url> <branch> <project-name> <api-key?> [recurScan]
# Example
solidityscan scan project github https://github.com/Credshields/solidityscan-npm-package main DemoProject $SOLIDITYSCAN_API_KEY
```

Arguments:

1. `provider`           – Currently supported: `github` (more coming soon).
2. `repo-url`           – HTTPS or SSH URL of the repository.
3. `branch`             – Branch to scan (e.g. `main`).
4. `project-name`       – Friendly name that will appear in the dashboard.
5. `api-key` *(optional)* – Falls back to `SOLIDITYSCAN_API_KEY` env var.
6. `recurScan` *(optional)* – `true` to enable recurring scans.

---

### Scan a Contract Address

```bash
solidityscan scan contract <address> <chain> <platform> <api-key?>
# Example
solidityscan scan contract 0x1234... ethereum evm $SOLIDITYSCAN_API_KEY
```

* `address`  – Deployed contract address.
* `chain`    – Network/chain identifier, e.g. `ethereum`, `polygon`.
* `platform` – Platform indicator such as `evm`.

---

### Scan a Local Directory

Analyse a local folder containing `.sol` files. The tool packages the Solidity source, uploads it, waits for the scan to finish and prints the results.

```bash
solidityscan test /path/to/my/contracts [api-key]
```

---

### Run a Local File Server

Start a WebSocket file server to expose your local directory to the SolidityScan web-UI (handy for visually picking files).

```bash
# Serve current directory on default port 8080
solidityscan -l

# Serve a custom directory on port 9090
solidityscan -l -p /my/contracts --port 9090
```

---

## Programmatic Usage

You can also integrate SolidityScan directly into your Node.js scripts or CI pipelines:

```js
const solidityscan = require("solidityscan");

(async () => {
  const apiToken = process.env.SOLIDITYSCAN_API_KEY;

  // 1. Scan a Git repository
  const projectPayload = {
    provider: "github",
    project_url: "https://github.com/Credshields/awesome-contracts",
    project_name: "AwesomeContracts",
    project_branch: "main",
    recur_scans: false,
    skip_file_paths: [],
  };
  const repoScanResult = await solidityscan.projectScan(projectPayload, apiToken);
  console.log(repoScanResult);

  // 2. Scan a contract address
  const contractPayload = {
    contract_address: "0x1234...",
    contract_chain: "ethereum",
    contract_platform: "evm",
  };
  const contractScanResult = await solidityscan.contractScan(contractPayload, apiToken);
  console.log(contractScanResult);

  // 3. Scan a local directory (same behaviour as CLI `test`)
  await solidityscan.runTests("./contracts", apiToken);
})();
```

Available exported helpers:

* `projectScan(payload, apiToken)`
* `contractScan(payload, apiToken)`
* `analyseProject(directoryPath, apiToken)`
* `runTests(directoryPath, apiToken)`
* `scan()` – executes the CLI with current `process.argv` (internally used by the binary).

---

## Examples

You can find full working examples inside the [`examples/`](https://github.com/Credshields/solidityscan-npm-package/tree/main/examples) directory (coming soon).

---

## Contributing

1. Fork the repo and create your feature branch: `git checkout -b feat/awesome-feature`.
2. Install dependencies: `npm install`.
3. Run the tests: `npm test`.
4. Commit your changes and push: `git push origin feat/awesome-feature`.
5. Open a pull request – we love to review!

Please adhere to the existing code style and add unit tests for any new logic.

---

## License

This project is licensed under the **ISC** license – see the [LICENSE](LICENSE) file for details.