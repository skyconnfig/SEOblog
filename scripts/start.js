/**
 * LXSBest Blog - Start both Astro dev server and Admin server
 *
 * Usage: node scripts/start.js
 */

import { spawn } from "child_process";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function log(msg) {
  console.log(`  ${msg}`);
}

function getPortPids(port) {
  try {
    const cmd = process.platform === "win32"
      ? `netstat -ano | findstr :${port}`
      : `lsof -ti:${port}`;
    const out = execSync(cmd, { encoding: "utf8", timeout: 3000, stdio: "pipe" });
    if (process.platform === "win32") {
      return out.split("\n").filter((l) => l.includes("LISTENING")).map((l) => l.trim().split(/\s+/).pop()).filter(Boolean);
    }
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function killPort(port) {
  const pids = getPortPids(port);
  for (const pid of pids) {
    try {
      process.kill(parseInt(pid));
      log(`已释放端口 ${port} (PID ${pid})`);
    } catch {}
  }
}

function waitForPort(port, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://localhost:${port}/`, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) resolve(false);
        else setTimeout(check, 500);
      });
      req.setTimeout(1000, () => { req.destroy(); setTimeout(check, 500); });
    };
    check();
  });
}

function openBrowser(url) {
  try {
    if (process.platform === "win32") {
      execSync(`start ${url}`, { shell: "cmd.exe", stdio: "pipe" });
    } else if (process.platform === "darwin") {
      execSync(`open ${url}`);
    } else {
      execSync(`xdg-open ${url} 2>/dev/null || true`);
    }
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const divider = "=".repeat(44);

  console.log("");
  console.log(`  ${divider}`);
  console.log(`    LXSBest Blog - 启动中...`);
  console.log(`  ${divider}`);
  console.log("");

  // Check node version
  log(`Node.js ${process.version}`);

  // Kill existing processes
  log("清理端口...");
  killPort(3002);
  killPort(4326);
  await new Promise((r) => setTimeout(r, 1000));

  // Start Astro dev server
  log("启动 Astro 开发服务器 (http://localhost:4326)...");
  const astro = spawn("npx astro dev", [], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: { ...process.env },
  });

  // Start Admin server
  log("启动管理后台 (http://localhost:3002)...");
  const admin = spawn("node scripts/admin-server.js", [], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });

  // Wait for admin server
  const adminReady = await waitForPort(3002, 15000);
  if (adminReady) log("管理后台已就绪 ✓");
  else log("管理后台启动超时 ⚠");

  // Wait for astro dev server
  const astroReady = await waitForPort(4326, 30000);
  if (astroReady) log("Astro 开发服务器已就绪 ✓");
  else log("Astro 开发服务器启动超时 ⚠");

  console.log("");
  console.log(`  ${divider}`);
  console.log(`    所有服务已启动！`);
  console.log(`    管理后台 : http://localhost:3002`);
  console.log(`    网站预览 : http://localhost:4326`);
  console.log(`  ${divider}`);
  console.log("");
  log("按 Ctrl+C 停止所有服务");
  console.log("");

  // Open browser — open site first, then admin
  if (astroReady) openBrowser("http://localhost:4326");
  if (adminReady) openBrowser("http://localhost:3002");

  // Handle cleanup on exit
  const cleanup = (signal) => {
    console.log(`\n  正在停止服务...`);
    astro.kill();
    admin.kill();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((e) => {
  console.error("  错误:", e.message);
  process.exit(1);
});
