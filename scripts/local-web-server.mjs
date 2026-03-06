import fs from "node:fs/promises";
import { openSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";

const rootDir = process.cwd();
const buildIdPath = path.join(rootDir, ".next", "BUILD_ID");
const nextStaticPath = path.join(rootDir, ".next", "static");
const nextBinPath = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const standaloneServerPath = path.join(rootDir, ".next", "standalone", "server.js");
const standaloneStaticPath = path.join(rootDir, ".next", "standalone", ".next", "static");
const pidFilePath = path.join(rootDir, ".local-web.pid");
const stdoutLogPath = path.join(rootDir, ".local-web.log");
const stderrLogPath = path.join(rootDir, ".local-web.err.log");
const healthUrl = "http://127.0.0.1:3000/api/health";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readPidFile() {
  if (!(await pathExists(pidFilePath))) {
    return null;
  }

  const raw = await fs.readFile(pidFilePath, "utf8");
  const pid = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(pid) ? pid : null;
}

async function removePidFile() {
  if (await pathExists(pidFilePath)) {
    await fs.rm(pidFilePath, { force: true });
  }
}

async function isPidRunning(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function verifyBuildReady() {
  if (!(await pathExists(buildIdPath))) {
    throw new Error("Production build is missing. Run `npm run build` first.");
  }

  if (!(await pathExists(standaloneServerPath)) && !(await pathExists(nextBinPath))) {
    throw new Error("Next.js runtime is missing. Run `npm install` first.");
  }
}

async function syncStandaloneStaticAssets() {
  if (!(await pathExists(standaloneServerPath))) {
    return;
  }

  if (!(await pathExists(nextStaticPath))) {
    throw new Error("Standalone server detected but `.next/static` is missing. Run `npm run build` first.");
  }

  await fs.mkdir(path.dirname(standaloneStaticPath), { recursive: true });
  await fs.cp(nextStaticPath, standaloneStaticPath, { recursive: true, force: true });
}

async function waitForHealth(timeoutMs = 12000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return true;
      }
    } catch {
      // Keep polling until the timeout expires.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

async function isLocalPortListening(port = 3000) {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function stopServer() {
  const pid = await readPidFile();
  if (!pid) {
    console.log("No local web server PID file found.");
    return;
  }

  if (!(await isPidRunning(pid))) {
    await removePidFile();
    console.log(`Removed stale PID file for process ${pid}.`);
    return;
  }

  process.kill(pid);

  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    if (!(await isPidRunning(pid))) {
      await removePidFile();
      console.log(`Stopped local web server (PID ${pid}).`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Failed to stop local web server (PID ${pid}).`);
}

async function startServer() {
  const existingPid = await readPidFile();
  if (existingPid && (await isPidRunning(existingPid))) {
    console.log(`Local web server is already running on PID ${existingPid}.`);
    return;
  }

  if (existingPid) {
    await removePidFile();
  }

  if (await isLocalPortListening()) {
    throw new Error("Port 3000 is already in use. Stop the existing local server first.");
  }

  await verifyBuildReady();

  const stdoutFd = openSync(stdoutLogPath, "a");
  const stderrFd = openSync(stderrLogPath, "a");
  const useStandalone = await pathExists(standaloneServerPath);
  if (useStandalone) {
    await syncStandaloneStaticAssets();
  }
  const childArgs = useStandalone ? [standaloneServerPath] : [nextBinPath, "start"];
  const child = spawn(process.execPath, childArgs, {
    cwd: rootDir,
    detached: true,
    stdio: ["ignore", stdoutFd, stderrFd],
  });

  child.unref();

  await fs.writeFile(pidFilePath, `${child.pid}\n`, "utf8");

  const healthy = await waitForHealth();
  if (!healthy) {
    throw new Error(
      "Local web server started but did not pass the health check. Check `.local-web.err.log`."
    );
  }

  console.log(`Local web server started on PID ${child.pid}.`);
}

async function printStatus() {
  const pid = await readPidFile();
  const running = pid ? await isPidRunning(pid) : false;

  console.log(
    JSON.stringify(
      {
        running,
        pid: running ? pid : null,
        pidFile: await pathExists(pidFilePath),
        healthUrl,
      },
      null,
      2
    )
  );
}

async function main() {
  const command = process.argv[2] ?? "status";

  if (command === "start") {
    await startServer();
    return;
  }

  if (command === "stop") {
    await stopServer();
    return;
  }

  if (command === "restart") {
    await stopServer().catch((error) => {
      if (!String(error?.message ?? "").includes("PID file")) {
        throw error;
      }
    });
    await startServer();
    return;
  }

  if (command === "status") {
    await printStatus();
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
