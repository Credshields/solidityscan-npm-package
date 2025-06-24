# SolidityScan

Secure your Solidity smart contracts straight from your terminal or JavaScript code! **SolidityScan** is a lightweight CLI and Node.js library that connects to the [CredShields SolidityScan](https://solidityscan.com) API to identify vulnerabilities, gas optimisations, and other issues in your smart-contract projects.

---

## Table of Contents

1. [Features](#features)
2. [Installation](#installation)
3. [Getting an API Key](#getting-an-api-key)
4. [CLI Usage](#cli-usage)
   * [Scan a local directory](#scan-a-local-directory)
   * [Run a local file server](#run-a-local-file-server)
5. [Programmatic Usage](#programmatic-usage)
6. [Examples](#examples)
7. [Contributing](#contributing)
8. [License](#license)

---

## Features

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

---

### Scan a Local Directory

Analyse a local folder containing `.sol` files. The tool packages the Solidity source, uploads it, waits for the scan to finish and prints the results.

If using with API key in terminal command.

```bash
solidityscan local /path/to/my/contracts [api-key] [project-name]
```

If using with API key in environment variable.

```bash
solidityscan local /path/to/my/contracts [project-name]
```

If no project name is provided, it will default to "LocalScan".

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

  // Scan a local directory (same behaviour as CLI `test`)
  await solidityscan.runTests("./contracts", apiToken);
})();
```

Available exported helpers:

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