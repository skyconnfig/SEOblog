/**
 * LXSBest Dev Server — Image Manager for Blog Posts
 * =================================================
 * Start:     node scripts/dev-server.js
 * Then open: http://localhost:3002
 *
 * Paste images from clipboard → auto-save to public/assets/blog/<slug>/
 * Manage images: view, delete, replace, copy markdown syntax
 * Dev server at localhost:4326 handles hot-reload for preview
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 3002;

// ─── Helpers ──────────────────────────────────────
const BLOG_IMGS = (slug) => path.join(ROOT, "public", "assets", "blog", slug);
const urlOf = (slug, name) => `/assets/blog/${slug}/${name}`;

function respond(res, code, data, ct = "application/json") {
  res.writeHead(code, {
    "Content-Type": ct,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(ct === "application/json" ? JSON.stringify(data) : data);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const ct = req.headers["content-type"] || "";
        if (ct.includes("application/json")) resolve(JSON.parse(body));
        else resolve(body);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function todaySlug() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let imageCounter = 0;
function nextImgName(ext = "png") {
  imageCounter++;
  return `image-${imageCounter}.${ext}`;
}

// ─── Routes ───────────────────────────────────────
async function handle(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;
  const parts = url.pathname.split("/").filter(Boolean);

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // ── GET / — serve admin UI ──
  if (method === "GET" && parts.length === 0) {
    const html = getAdminHTML();
    respond(res, 200, html, "text/html; charset=utf-8");
    return;
  }

  // ── GET /images/:slug — list images ──
  if (method === "GET" && parts[0] === "images" && parts[1]) {
    const slug = parts[1];
    const dir = BLOG_IMGS(slug);
    if (!fs.existsSync(dir)) {
      respond(res, 200, []);
      return;
    }
    const files = fs.readdirSync(dir).filter((f) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f));
    const list = files.map((f) => {
      const stat = fs.statSync(path.join(dir, f));
      return {
        filename: f,
        url: urlOf(slug, f),
        size: stat.size,
        modified: stat.mtime,
        markdown: `![${path.parse(f).name}](${urlOf(slug, f)})`,
      };
    });
    list.sort((a, b) => b.modified - a.modified);
    respond(res, 200, list);
    return;
  }

  // ── DELETE /images/:slug/:filename — delete image ──
  if (method === "DELETE" && parts[0] === "images" && parts[1] && parts[2]) {
    const slug = parts[1];
    const filename = parts[2];
    const filepath = path.join(BLOG_IMGS(slug), filename);

    // Safety: ensure we don't escape the blog dir
    if (!filepath.startsWith(BLOG_IMGS(""))) {
      respond(res, 400, { error: "Invalid path" });
      return;
    }

    try {
      fs.unlinkSync(filepath);
      respond(res, 200, { success: true });
    } catch (e) {
      respond(res, 404, { error: "File not found" });
    }
    return;
  }

  // ── PUT /images/:slug/:filename — replace image ──
  if (method === "PUT" && parts[0] === "images" && parts[1] && parts[2]) {
    const slug = parts[1];
    const filename = parts[2];
    const dir = BLOG_IMGS(slug);
    const filepath = path.join(dir, filename);

    if (!filepath.startsWith(BLOG_IMGS(""))) {
      respond(res, 400, { error: "Invalid path" });
      return;
    }

    try {
      const body = await parseBody(req);
      const data = body.data || body;  // base64 data URL or raw
      const buf = data.startsWith("data:")
        ? Buffer.from(data.split(",")[1], "base64")
        : Buffer.from(data, "base64");

      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filepath, buf);
      respond(res, 200, {
        filename,
        url: urlOf(slug, filename),
        markdown: `![${path.parse(filename).name}](${urlOf(slug, filename)})`,
      });
    } catch (e) {
      respond(res, 500, { error: e.message });
    }
    return;
  }

  // ── POST /upload — upload/paste image ──
  if (method === "POST" && url.pathname === "/upload") {
    try {
      const body = await parseBody(req);
      const data = body.data || body;
      const slug = body.slug || todaySlug();
      const dir = BLOG_IMGS(slug);

      // Detect format from base64 data URL
      let ext = "png";
      let rawData = data;
      if (typeof data === "string" && data.startsWith("data:")) {
        const m = data.match(/^data:image\/(\w+);base64,(.+)/);
        if (m) {
          ext = m[1] === "jpeg" ? "jpg" : m[1];
          rawData = m[2];
        }
      }

      const filename = nextImgName(ext);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), Buffer.from(rawData, "base64"));

      respond(res, 200, {
        filename,
        url: urlOf(slug, filename),
        markdown: `![${path.parse(filename).name}](${urlOf(slug, filename)})`,
      });
    } catch (e) {
      respond(res, 500, { error: e.message });
    }
    return;
  }

  // ── 404 ──
  respond(res, 404, { error: "Not found" });
}

// ─── Admin HTML UI (embedded) ─────────────────────
function getAdminHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Image Manager — LXSBest</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f4f6fa; color: #1a2332; padding: 20px;
  }
  .container { max-width: 960px; margin: 0 auto; }
  header {
    background: linear-gradient(135deg, #2d6dc3, #1a4f8a);
    color: white; border-radius: 16px; padding: 24px 32px;
    margin-bottom: 20px;
  }
  header h1 { font-size: 20px; margin-bottom: 4px; }
  header p { opacity: .85; font-size: 13px; }
  .card {
    background: #fff; border: 1px solid #e2e8f0;
    border-radius: 12px; padding: 24px; margin-bottom: 16px;
  }
  .card h2 { font-size: 15px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .paste-zone {
    border: 2px dashed #cbd5e1; border-radius: 12px;
    padding: 48px 24px; text-align: center;
    cursor: pointer; transition: all .2s;
    background: #fafbfc;
  }
  .paste-zone:hover, .paste-zone.dragover {
    border-color: #2d6dc3; background: #eef4ff;
  }
  .paste-zone svg { width: 40px; height: 40px; color: #94a3b8; margin-bottom: 8px; }
  .paste-zone p { color: #64748b; font-size: 14px; }
  .paste-zone .hint { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .slug-input { display: flex; gap: 8px; align-items: center; }
  .slug-input label { font-size: 13px; font-weight: 600; color: #475569; white-space: nowrap; }
  .slug-input input {
    padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
    font-size: 13px; width: 220px; background: #f8fafc;
  }
  .slug-input input:focus { outline: none; border-color: #2d6dc3; box-shadow: 0 0 0 3px rgba(45,109,195,.1); }
  .image-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px; margin-top: 12px;
  }
  .image-card {
    background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 10px; overflow: hidden; transition: all .15s;
  }
  .image-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.08); }
  .image-card .preview {
    width: 100%; aspect-ratio: 16/9; object-fit: cover;
    background: #eef1f7; cursor: pointer;
  }
  .image-card .info { padding: 10px 12px; }
  .image-card .name {
    font-size: 12px; font-weight: 600; color: #1e293b;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .image-card .meta { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .image-card .code {
    font-size: 11px; color: #2d6dc3; background: #eef4ff;
    padding: 4px 8px; border-radius: 4px; margin-top: 4px;
    cursor: pointer; word-break: break-all;
  }
  .image-card .code:hover { background: #dbe5ff; }
  .image-card .actions { display: flex; gap: 6px; padding: 6px 12px 10px; }
  .btn {
    padding: 5px 12px; border-radius: 6px; border: none;
    font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all .15s;
  }
  .btn-sm { padding: 3px 8px; font-size: 11px; }
  .btn-primary { background: #2d6dc3; color: white; }
  .btn-primary:hover { opacity: .9; }
  .btn-danger { background: #ef4444; color: white; }
  .btn-danger:hover { opacity: .9; }
  .btn-outline { background: transparent; color: #64748b; border: 1px solid #e2e8f0; }
  .btn-outline:hover { background: #f1f5f9; }
  .toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: #1a2332; color: white; padding: 10px 24px;
    border-radius: 8px; font-size: 13px; z-index: 100;
    opacity: 0; transition: opacity .3s;
    pointer-events: none;
  }
  .toast.show { opacity: 1; }
  .empty-state { text-align: center; padding: 32px; color: #94a3b8; font-size: 14px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; background: #eef4ff; color: #2d6dc3; }
  .loading { opacity: .6; pointer-events: none; }
  @media (max-width: 600px) {
    .image-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>Image Manager</h1>
    <p>Paste screenshots directly into your blog posts. Edits auto-sync with dev server.</p>
  </header>

  <!-- Slug input + paste zone -->
  <div class="card">
    <h2>📋 Paste Image</h2>
    <div class="row slug-input" style="margin-bottom:12px;">
      <label>Blog slug:</label>
      <input type="text" id="slug-input" placeholder="e.g. my-article-title" />
      <span class="badge">images go to /assets/blog/&lt;slug&gt;/</span>
    </div>
    <div class="paste-zone" id="paste-zone" tabindex="0">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="14" y="2" width="8" height="8" rx="2"/><path d="M6 18h8m-8-4h4"/><path d="M3 7h4a1 1 0 0 0 1-1V2"/><path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>
      <p><strong>Ctrl+V</strong> to paste from clipboard</p>
      <p class="hint">Or drag & drop an image file here</p>
    </div>
  </div>

  <!-- Image list -->
  <div class="card">
    <h2>🖼️ Images <span id="img-count" class="badge">0</span></h2>
    <div id="image-grid" class="image-grid">
      <div class="empty-state" id="empty-state">Paste an image above to get started</div>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
  const PASTE_ZONE = document.getElementById("paste-zone");
  const SLUG_INPUT = document.getElementById("slug-input");
  const GRID = document.getElementById("image-grid");
  const EMPTY = document.getElementById("empty-state");
  const COUNT = document.getElementById("img-count");
  const TOAST = document.getElementById("toast");

  // ─── Slug ───
  let currentSlug = "";
  SLUG_INPUT.addEventListener("input", () => {
    currentSlug = SLUG_INPUT.value.trim();
    loadImages();
  });

  // ─── Toast ───
  let toastTimer;
  function showToast(msg) {
    TOAST.textContent = msg;
    TOAST.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => TOAST.classList.remove("show"), 2000);
  }

  // ─── Paste handler ───
  PASTE_ZONE.addEventListener("paste", async (e) => {
    e.preventDefault();
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) await uploadFile(file);
        return;
      }
    }
    showToast("No image found in clipboard");
  });

  // ─── Drag & drop ───
  PASTE_ZONE.addEventListener("dragover", (e) => {
    e.preventDefault();
    PASTE_ZONE.classList.add("dragover");
  });
  PASTE_ZONE.addEventListener("dragleave", () => {
    PASTE_ZONE.classList.remove("dragover");
  });
  PASTE_ZONE.addEventListener("drop", (e) => {
    e.preventDefault();
    PASTE_ZONE.classList.remove("dragover");
    const files = e.dataTransfer.files;
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        uploadFile(file);
        return;
      }
    }
    showToast("Please drop an image file");
  });

  // ─── Upload ───
  async function uploadFile(file) {
    const slug = SLUG_INPUT.value.trim();
    if (!slug) {
      showToast("Please enter a blog slug first");
      SLUG_INPUT.focus();
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      try {
        const res = await fetch("/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: base64, slug }),
        });
        const result = await res.json();
        if (res.ok) {
          showToast("Copied markdown to clipboard!");
          // Copy markdown to clipboard
          try { await navigator.clipboard.writeText(result.markdown); } catch {}
          loadImages();
        } else {
          showToast("Upload failed: " + (result.error || "unknown error"));
        }
      } catch (err) {
        showToast("Upload error: " + err.message);
      }
    };
    reader.readAsDataURL(file);
  }

  // ─── Load images ───
  async function loadImages() {
    const slug = SLUG_INPUT.value.trim();
    if (!slug) {
      GRID.innerHTML = '<div class="empty-state" id="empty-state">Enter a slug above to view images</div>';
      COUNT.textContent = "0";
      return;
    }

    try {
      const res = await fetch("/images/" + encodeURIComponent(slug));
      const images = await res.json();
      renderImages(images);
    } catch (err) {
      console.error("Failed to load images:", err);
    }
  }

  function renderImages(images) {
    COUNT.textContent = images.length;
    if (images.length === 0) {
      GRID.innerHTML = '<div class="empty-state" id="empty-state">No images yet. Paste one above.</div>';
      return;
    }

    GRID.innerHTML = images.map((img) => \`
      <div class="image-card" data-filename="\${img.filename}">
        <img class="preview" src="\${img.url}" alt="\${img.filename}" onclick="window.open('\${img.url}', '_blank')" />
        <div class="info">
          <div class="name" title="\${img.filename}">\${img.filename}</div>
          <div class="meta">\${(img.size / 1024).toFixed(1)} KB</div>
          <div class="code" onclick="copyText('\${img.markdown.replace(/\\//g, '\\\\/').replace(/'/g, "\\\\'")}')" title="Click to copy">\${img.markdown}</div>
        </div>
        <div class="actions">
          <button class="btn btn-sm btn-outline" onclick="replaceImg('\${img.filename}')">Replace</button>
          <button class="btn btn-sm btn-danger" onclick="deleteImg('\${img.filename}')">Delete</button>
        </div>
      </div>
    \`).join("");
  }

  // ─── Copy ───
  window.copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied markdown to clipboard");
    } catch {
      showToast("Failed to copy");
    }
  };

  // ─── Delete ───
  window.deleteImg = async (filename) => {
    if (!confirm("Delete " + filename + "?")) return;
    const slug = SLUG_INPUT.value.trim();
    try {
      const res = await fetch("/images/" + encodeURIComponent(slug) + "/" + encodeURIComponent(filename), {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Deleted " + filename);
        loadImages();
      } else {
        showToast("Delete failed");
      }
    } catch (err) {
      showToast("Error: " + err.message);
    }
  };

  // ─── Replace ───
  window.replaceImg = (filename) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const slug = SLUG_INPUT.value.trim();
      if (!slug) { showToast("Enter slug first"); return; }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch("/images/" + encodeURIComponent(slug) + "/" + encodeURIComponent(filename), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: reader.result }),
          });
          if (res.ok) {
            showToast("Replaced " + filename);
            loadImages();
          } else {
            showToast("Replace failed");
          }
        } catch (err) {
          showToast("Error: " + err.message);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // ─── Keyboard shortcut: paste anywhere ───
  document.addEventListener("paste", (e) => {
    // If user is typing in the slug input, don't intercept
    if (document.activeElement === SLUG_INPUT) return;
    // If the paste has image data, handle it
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        PASTE_ZONE.focus();
        const file = item.getAsFile();
        if (file) uploadFile(file);
        return;
      }
    }
  });

  // Auto-load if slug was pre-filled
  loadImages();
</script>
</body>
</html>`;
}

// ─── Start server ─────────────────────────────────
const server = http.createServer(handle);
server.listen(PORT, () => {
  console.log("");
  console.log(`  \x1b[36m✦ Image Manager ready\x1b[0m`);
  console.log(`  \x1b[2m  http://localhost:${PORT}\x1b[0m`);
  console.log(`  \x1b[2m  Paste screenshots → auto-save to blog post\x1b[0m`);
  console.log(`  \x1b[2m  Dev server: http://localhost:4326\x1b[0m`);
  console.log("");
});
