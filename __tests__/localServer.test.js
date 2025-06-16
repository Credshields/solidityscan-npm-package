const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const os = require("os");
const { startLocalFileServer } = require("../src/utils");

describe("Local WebSocket file server", () => {
  let tempDir;
  let server;
  let port;

  beforeAll((done) => {
    // create temporary directory with sample file
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ss-test-"));
    fs.writeFileSync(path.join(tempDir, "hello.sol"), "// solidity sample\npragma solidity ^0.8.0;\n");
    // add nested directories and files
    const nestedDir = path.join(tempDir, "contracts", "libs");
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, "contracts", "MyToken.sol"), "// token\n");
    fs.writeFileSync(path.join(tempDir, "contracts", "ignore.sol"), "// skip\n");
    fs.writeFileSync(path.join(nestedDir, "Utils.sol"), "// utils\n");

    // start server on random port
    server = startLocalFileServer(tempDir);

    // wait until server listening
    server.on("listening", () => {
      port = server.options.port;
      done();
    });
  });

  afterAll(() => {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("should list files in folder structure", (done) => {
    const ws = new WebSocket(`ws://localhost:${port}`);

    ws.on("open", () => {
      ws.send(JSON.stringify({ action: "listFiles" }));
    });

    ws.on("message", (raw) => {
      const message = JSON.parse(raw);
      if (message.type !== "folderStructure") return;
      const collect = (node) => {
        let list = [];
        if (node.blobs) {
          list.push(...node.blobs.map((b) => b.path));
        }
        if (node.tree) {
          node.tree.forEach((child) => {
            list = list.concat(collect(child));
          });
        }
        return list;
      };
      console.log("Tree ", JSON.stringify(message.tree, null, 2))
      const files = collect(message.tree);
      expect(files).toEqual(expect.arrayContaining([
        "hello.sol",
        path.join("contracts", "MyToken.sol"),
        path.join("contracts", "libs", "Utils.sol"),
      ]));
      ws.close();
      done();
    });
  });

  test("should return zipped data for zipFiles action", (done) => {
    const ws = new WebSocket(`ws://localhost:${port}`);

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          action: "zipAndSendFiles",
          payload: {
            presigned_url: "memory://upload",
            skip_file_paths: ["contracts/ignore.sol"],
          },
        })
      );
    });

    ws.on("message", (raw) => {
      const message = JSON.parse(raw);
      if (message.type !== "uploadStatus") return;
      expect(message.success).toBe(true);
      ws.close();
      done();
    });
  });
}); 