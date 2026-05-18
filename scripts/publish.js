/**
 * LXSBest Content Publisher
 * =========================
 * node scripts/publish.js
 *
 * One-click tool to:
 *   1. Create blog posts (markdown files)
 *   2. Add downloadable resources (copy files + update data)
 *   3. Build site & push to GitHub
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BLOG_DIR = path.join(ROOT, "src", "content", "blog");
const RESOURCES_TS = path.join(ROOT, "src", "data", "resources.ts");
const DOWNLOADS_DIR = path.join(ROOT, "public", "downloads");
const COVERS_DIR = path.join(ROOT, "public", "assets", "resource-previews");

let rl;

function initReadline() {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
}
function closeReadline() {
  if (rl) rl.close();
}
function ask(q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

function clr(tag, msg, color) {
  console.log(`\n  \x1b[${color}m[${tag}]\x1b[0m ${msg}`);
}
function info(msg) { clr("i", msg, "36"); }
function ok(msg) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function warn(msg) { console.log(`  \x1b[33m⚠\x1b[0m ${msg}`); }
function fail(msg) { console.log(`  \x1b[31m✗\x1b[0m ${msg}`); }

function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");
}
function today() {
  return new Date().toISOString().split("T")[0];
}
function run(cmd) {
  console.log(`    $ ${cmd}`);
  return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: "pipe" }).trim();
}

// ═══════════════════════════════════════════
//  1. CREATE BLOG POST
// ═══════════════════════════════════════════
async function createBlogPost() {
  info("Creating a new blog post");

  const title = await ask("  Title: ");
  const description = await ask("  Description (SEO): ");
  const slug = slugify(title);
  const tagsRaw = await ask("  Tags (comma-separated, e.g. PLG,SaaS,AI): ");
  const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
  const date = (await ask(`  Date (Enter for ${today()}): `)) || today();
  const isDraft = (await ask("  Draft? (y/N): ")).toLowerCase() === "y";

  console.log("\n  ── Paste Markdown body, then type END on a new line ──");
  const lines = [];
  while (true) {
    const line = await ask("  ");
    if (line.trim() === "END") break;
    lines.push(line);
  }
  const body = lines.join("\n");

  const md = [
    "---",
    `title: "${title}"`,
    `description: "${description}"`,
    `date: ${date}`,
    `tags: [${tags.map((t) => `"${t}"`).join(", ")}]`,
    `draft: ${isDraft}`,
    "---",
    "",
    body,
    "",
  ].join("\n");

  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  fs.writeFileSync(filePath, md, "utf8");
  ok(`Created ${path.relative(ROOT, filePath)}`);

  const preview = body.length > 120 ? body.slice(0, 120) + "..." : body;
  console.log(`\n  Preview:\n  ${preview}\n`);

  if ((await ask("  Open in editor? (y/N): ")).toLowerCase() === "y") {
    try { run(`start "" "${filePath}"`); }
    catch { warn(`Open manually: ${filePath}`); }
  }
}

// ═══════════════════════════════════════════
//  2. ADD RESOURCE
// ═══════════════════════════════════════════
async function addResource() {
  info("Adding a downloadable resource");

  const title = await ask("  Resource title: ");
  const slug = slugify(title);
  const description = await ask("  Description: ");
  const fileType = (await ask("  File type (ZIP/PDF): ")).toUpperCase();
  const fileSize = await ask("  File size (e.g. 10MB): ");
  const isFree = (await ask("  Price type (pay/free) [pay]: ")).toLowerCase() === "free";

  // Cover image
  const coverSrc = await ask(`  Cover image path (or Enter to skip): `);
  let coverName = "cover.png";
  if (coverSrc && fs.existsSync(coverSrc)) {
    const coverDir = path.join(COVERS_DIR, slug);
    fs.mkdirSync(coverDir, { recursive: true });
    coverName = path.basename(coverSrc);
    fs.copyFileSync(coverSrc, path.join(coverDir, coverName));
    ok(`Cover → public/assets/resource-previews/${slug}/${coverName}`);
  }

  // Download file
  const fileSrc = await ask("  File to upload (drag file here, or Enter to skip): ");
  let downloadExt = "." + fileType.toLowerCase();
  if (fileSrc && fs.existsSync(fileSrc)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    downloadExt = path.extname(fileSrc);
    const dest = path.join(DOWNLOADS_DIR, `${slug}${downloadExt}`);
    fs.copyFileSync(fileSrc, dest);
    ok(`File → public/downloads/${slug}${downloadExt}`);
  }

  // Generate entry code
  const entry = [
    "  {",
    `    category: "ai-dev",`,
    `    cover: "/assets/resource-previews/${slug}/${coverName}",`,
    `    typeTag: { label: "AI & Dev", color: "purple" },`,
    `    priceTag: { label: ${isFree ? '"Free"' : '"Pay What You Want"'}, color: ${isFree ? '"green"' : '"amber"'} },`,
    `    title: "${title}",`,
    `    description: "${description}",`,
    `    fileType: "${fileType}",`,
    `    fileSize: "${fileSize}",`,
    `    url: "/resources/en-${slug}",`,
    `    slug: "en-${slug}",`,
    `    downloadPath: "/downloads/${slug}${downloadExt}",`,
    "  },",
  ].join("\n");

  console.log("\n" + "─".repeat(48));
  console.log("  Add this entry to src/data/resources.ts:\n");
  console.log(entry);
  console.log("─".repeat(48));
  console.log("  Open the file, find the resources array, and paste before the closing `];`\n");

  if ((await ask("  Open resources.ts now? (y/N): ")).toLowerCase() === "y") {
    try { run(`start "" "${RESOURCES_TS}"`); }
    catch { warn(`Open manually: ${RESOURCES_TS}`); }
  }
}

// ═══════════════════════════════════════════
//  3. BUILD & DEPLOY
// ═══════════════════════════════════════════
async function deploy() {
  info("Building & deploying to GitHub");

  // Build
  try {
    info("astro build ...");
    const out = run("npx astro build 2>&1");
    const m = out.match(/(\d+) page\(s\) built/);
    ok(m ? `${m[1]} pages built` : "Build complete");
  } catch (e) {
    fail("Build failed — aborting deploy");
    console.error(e.stderr ? e.stderr.slice(0, 500) : e.message);
    return;
  }

  // Check for changes
  const status = run("git status --short");
  if (!status) {
    warn("No changes to commit");
    if ((await ask("  Push anyway? (y/N): ")).toLowerCase() !== "y") return;
  }

  const msg = await ask("  Commit message: ") || "update: content update";

  try {
    info("Staging files...");
    run('git add src/ public/downloads/ public/assets/resource-previews/');

    const staged = run("git status --short");
    if (staged) {
      info(`Committing...`);
      run(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
      ok("Committed");
    } else {
      warn("Nothing staged");
      if ((await ask("  Empty commit? (y/N): ")).toLowerCase() !== "y") return;
      run(`git commit --allow-empty -m "${msg.replace(/"/g, '\\"')}"`);
    }

    info("Pushing to GitHub...");
    const pushOut = run("git push");
    ok("Pushed!");
    console.log(`\n  ${pushOut}`);
  } catch (e) {
    fail("Git operation failed");
    console.error(e.stderr ? e.stderr.slice(0, 500) : e.message);
  }
}

// ═══════════════════════════════════════════
//  MENU
// ═══════════════════════════════════════════
async function menu() {
  console.log("\n" + "=".repeat(44));
  console.log("  LXSBest Content Publisher");
  console.log("=".repeat(44));
  console.log("  1. Create blog post");
  console.log("  2. Add resource");
  console.log("  3. Build & deploy to GitHub");
  console.log("  0. Exit");
  console.log("=".repeat(44));

  const choice = (await ask("  Choose: ")).trim();
  if (choice === "1") await createBlogPost();
  else if (choice === "2") await addResource();
  else if (choice === "3") await deploy();
  else if (choice === "0") { closeReadline(); console.log("\n  Bye!\n"); return; }
  else warn("Invalid option");

  if (rl) await menu();
}

// ═══════════════════════════════════════════
//  START
// ═══════════════════════════════════════════
console.log("\n\x1b[35m✦ LXSBest Content Publisher ✦\x1b[0m");
initReadline();
menu().catch((e) => { console.error(e); closeReadline(); });
