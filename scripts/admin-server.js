/**
 * LXSBest Admin Server
 * ====================
 * Unified backend for blog CRUD, image management, and resources.
 *
 * Start:   node scripts/admin-server.js
 * Open:    http://localhost:3002
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 3002;
const BLOG_DIR = path.join(ROOT, "src", "content", "blog");
const RESOURCES_TS = path.join(ROOT, "src", "data", "resources.ts");
const DOWNLOADS_DIR = path.join(ROOT, "public", "downloads");
const COVERS_DIR = path.join(ROOT, "public", "assets", "resource-previews");
const IMG_DIR = (slug) => path.join(ROOT, "public", "assets", "blog", slug);

// ─── Helpers ──────────────────────────────────────
function json(res, code, data) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function html(res, code, str) {
  res.writeHead(code, {
    "Content-Type": "text/html; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(str);
}

function text(res, code, str) {
  res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(str);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const ct = req.headers["content-type"] || "";
        resolve(ct.includes("json") ? JSON.parse(body) : body);
      } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function safePath(base, name) {
  const resolved = path.resolve(base, name);
  if (!resolved.startsWith(base)) throw new Error("Invalid path");
  return resolved;
}

function slugify(t) {
  return t.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");
}

function today() {
  return new Date().toISOString().split("T")[0];
}

let imgCounter = Date.now();

// ─── Blog Frontmatter Parser ──────────────────────
function parseMD(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: raw };
  const fm = {};
  m[1].split("\n").forEach((line) => {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) {
      let val = kv[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val === "true" || val === "false") val = val === "true";
      if (kv[1] === "tags") {
        try { val = JSON.parse(val.replace(/'/g, '"')); } catch { val = val.replace(/[\[\]]/g, "").split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean); }
      }
      if (kv[1] === "date") val = new Date(val);
      fm[kv[1]] = val;
    }
  });
  return { frontmatter: fm, body: m[2].trim() };
}

function buildMD(fm, body) {
  const tags = Array.isArray(fm.tags) ? `[${fm.tags.map((t) => `"${t}"`).join(", ")}]` : JSON.stringify(fm.tags || []);
  const date = fm.date instanceof Date ? fm.date.toISOString().split("T")[0] : fm.date || today();
  return [
    "---",
    `title: "${fm.title}"`,
    `description: "${fm.description || ""}"`,
    `date: ${date}`,
    `tags: ${tags}`,
    `draft: ${fm.draft || false}`,
    "---",
    "",
    body,
    "",
  ].join("\n");
}

// ══════════════════════════════════════════════════
//  ROUTER
// ══════════════════════════════════════════════════
async function router(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;
  const p = url.pathname.split("/").filter(Boolean);

  // CORS
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  try {
    // ── GET / → admin HTML ──
    if (method === "GET" && p.length === 0) {
      html(res, 200, getAdminHTML());
      return;
    }

    // ──────────────── BLOG ────────────────

    // GET /blog → list all posts
    if (method === "GET" && p[0] === "blog" && !p[1]) {
      const search = url.searchParams.get("q")?.toLowerCase() || "";
      if (!fs.existsSync(BLOG_DIR)) { json(res, 200, []); return; }
      let files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));
      let posts = files.map((f) => {
        const raw = fs.readFileSync(path.join(BLOG_DIR, f), "utf8");
        const { frontmatter } = parseMD(raw);
        return { slug: f.replace(".md", ""), filename: f, ...frontmatter, _raw: raw };
      });
      if (search) {
        posts = posts.filter((p) =>
          (p.title || "").toLowerCase().includes(search) ||
          (p.description || "").toLowerCase().includes(search) ||
          p.slug.includes(search)
        );
      }
      posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      json(res, 200, posts.map(({ _raw, ...rest }) => rest));
      return;
    }

    // GET /blog/:slug → single post
    if (method === "GET" && p[0] === "blog" && p[1]) {
      const fp = safePath(BLOG_DIR, p[1] + ".md");
      if (!fs.existsSync(fp)) { json(res, 404, { error: "Not found" }); return; }
      const raw = fs.readFileSync(fp, "utf8");
      const { frontmatter, body } = parseMD(raw);
      json(res, 200, { slug: p[1], ...frontmatter, body, _raw: raw });
      return;
    }

    // POST /blog → create post
    if (method === "POST" && p[0] === "blog") {
      const data = await parseBody(req);
      const slug = data.slug || slugify(data.title);
      const fp = path.join(BLOG_DIR, slug + ".md");
      if (fs.existsSync(fp)) { json(res, 409, { error: "Post already exists" }); return; }
      const md = buildMD(data, data.body || "");
      fs.writeFileSync(fp, md, "utf8");
      json(res, 201, { slug, file: slug + ".md" });
      return;
    }

    // PUT /blog/:slug → update post
    if (method === "PUT" && p[0] === "blog" && p[1]) {
      const data = await parseBody(req);
      const fp = safePath(BLOG_DIR, p[1] + ".md");
      if (!fs.existsSync(fp)) { json(res, 404, { error: "Not found" }); return; }
      const existing = fs.readFileSync(fp, "utf8");
      const parsed = parseMD(existing);
      const fm = { ...parsed.frontmatter, ...data };
      // Don't let _raw or body leak into frontmatter
      delete fm._raw;
      const body = data.body !== undefined ? data.body : parsed.body;
      const md = buildMD(fm, body);
      fs.writeFileSync(fp, md, "utf8");
      json(res, 200, { slug: p[1] });
      return;
    }

    // DELETE /blog/:slug → delete post
    if (method === "DELETE" && p[0] === "blog" && p[1]) {
      const fp = safePath(BLOG_DIR, p[1] + ".md");
      if (!fs.existsSync(fp)) { json(res, 404, { error: "Not found" }); return; }
      fs.unlinkSync(fp);
      json(res, 200, { success: true });
      return;
    }

    // ──────────────── IMAGES ────────────────

    // GET /images/:slug
    if (method === "GET" && p[0] === "images" && p[1]) {
      const dir = IMG_DIR(p[1]);
      if (!fs.existsSync(dir)) { json(res, 200, []); return; }
      const files = fs.readdirSync(dir).filter((f) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f));
      const list = files.map((f) => {
        const stat = fs.statSync(path.join(dir, f));
        return {
          filename: f, url: `/assets/blog/${p[1]}/${f}`,
          size: stat.size, modified: stat.mtime,
          markdown: `![${path.parse(f).name}](/assets/blog/${p[1]}/${f})`,
        };
      }).sort((a, b) => b.modified - a.modified);
      json(res, 200, list);
      return;
    }

    // POST /upload → paste image
    if (method === "POST" && p[0] === "upload") {
      const data = await parseBody(req);
      const slug = data.slug || today();
      const dir = IMG_DIR(slug);
      let ext = "png", rawData = data.data || data;
      if (typeof rawData === "string" && rawData.startsWith("data:")) {
        const m = rawData.match(/^data:image\/(\w+);base64,(.+)/);
        if (m) { ext = m[1] === "jpeg" ? "jpg" : m[1]; rawData = m[2]; }
      }
      const filename = `image-${++imgCounter}.${ext}`;
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), Buffer.from(rawData, "base64"));
      json(res, 200, { filename, url: `/assets/blog/${slug}/${filename}`, markdown: `![${path.parse(filename).name}](/assets/blog/${slug}/${filename})` });
      return;
    }

    // DELETE /images/:slug/:filename
    if (method === "DELETE" && p[0] === "images" && p[1] && p[2]) {
      const dir = IMG_DIR(p[1]);
      const fp = safePath(dir, p[2]);
      if (!fs.existsSync(fp)) { json(res, 404, { error: "Not found" }); return; }
      fs.unlinkSync(fp);
      json(res, 200, { success: true });
      return;
    }

    // PUT /images/:slug/:filename → replace
    if (method === "PUT" && p[0] === "images" && p[1] && p[2]) {
      const data = await parseBody(req);
      const dir = IMG_DIR(p[1]);
      const fp = safePath(dir, p[2]);
      const raw = data.data || data;
      const buf = raw.startsWith("data:") ? Buffer.from(raw.split(",")[1], "base64") : Buffer.from(raw, "base64");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fp, buf);
      json(res, 200, { filename: p[2], url: `/assets/blog/${p[1]}/${p[2]}`, markdown: `![${path.parse(p[2]).name}](/assets/blog/${p[1]}/${p[2]})` });
      return;
    }

    // ──────────────── RESOURCES ────────────────

    // GET /resources → list from resources.ts
    if (method === "GET" && p[0] === "resources") {
      const search = url.searchParams.get("q")?.toLowerCase() || "";
      if (!fs.existsSync(RESOURCES_TS)) { json(res, 200, []); return; }
      const src = fs.readFileSync(RESOURCES_TS, "utf8");
      const arr = extractResourceArray(src);
      const filtered = search ? arr.filter((r) =>
        (r.title || "").toLowerCase().includes(search) ||
        (r.slug || "").includes(search)
      ) : arr;
      json(res, 200, filtered);
      return;
    }

    // POST /resources → add resource (appends to resources.ts)
    if (method === "POST" && p[0] === "resources") {
      const data = await parseBody(req);
      const slug = slugify(data.title);
      const ext = (data.fileType || "ZIP").toLowerCase();

      // Handle file uploads
      let downloadExt = "." + ext;
      if (data.fileData) {
        fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
        downloadExt = data.fileExt || "." + ext;
        const dest = path.join(DOWNLOADS_DIR, `${slug}${downloadExt}`);
        const buf = data.fileData.startsWith("data:") ? Buffer.from(data.fileData.split(",")[1], "base64") : Buffer.from(data.fileData, "base64");
        fs.writeFileSync(dest, buf);
      }

      // Handle cover
      let coverName = "cover.png";
      if (data.coverData) {
        const coverDir = path.join(COVERS_DIR, slug);
        fs.mkdirSync(coverDir, { recursive: true });
        coverName = `cover-${Date.now()}.png`;
        const buf = data.coverData.startsWith("data:") ? Buffer.from(data.coverData.split(",")[1], "base64") : Buffer.from(data.coverData, "base64");
        fs.writeFileSync(path.join(coverDir, coverName), buf);
      }

      const entry = [
        "  {",
        `    category: "${data.category || "ai-dev"}",`,
        `    cover: "/assets/resource-previews/${slug}/${coverName}",`,
        `    typeTag: { label: "${data.typeLabel || "AI & Dev"}", color: "${data.typeColor || "purple"}" },`,
        `    priceTag: { label: ${data.isFree ? '"Free"' : '"Pay What You Want"'}, color: ${data.isFree ? '"green"' : '"amber"'} },`,
        `    title: "${data.title}",`,
        `    description: "${data.description || ""}",`,
        `    fileType: "${(data.fileType || "ZIP").toUpperCase()}",`,
        `    fileSize: "${data.fileSize || ""}",`,
        `    url: "/resources/en-${slug}",`,
        `    slug: "en-${slug}",`,
        `    downloadPath: "/downloads/${slug}${downloadExt}",`,
        "  },",
      ].join("\n");

      // Append to resources.ts before the closing ];
      let src = fs.readFileSync(RESOURCES_TS, "utf8");
      src = src.replace(/];\s*$/, entry + "\n];");
      fs.writeFileSync(RESOURCES_TS, src, "utf8");

      json(res, 201, { slug: "en-" + slug, entry });
      return;
    }

    // DELETE /resources/:slug
    if (method === "DELETE" && p[0] === "resources" && p[1]) {
      let src = fs.readFileSync(RESOURCES_TS, "utf8");
      const slug = p[1];
      // Remove the resource entry matching this slug
      const regex = new RegExp(`[\\s]*\\{[^}]*slug:\\s*"${slug}"[^}]*\\},?\\s*`, "g");
      const newSrc = src.replace(regex, "\n");
      if (newSrc === src) { json(res, 404, { error: "Not found" }); return; }
      fs.writeFileSync(RESOURCES_TS, newSrc, "utf8");
      json(res, 200, { success: true });
      return;
    }

    // ── 404 ──
    json(res, 404, { error: "Not found" });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}

function extractResourceArray(src) {
  try {
    const m = src.match(/export\s+const\s+resources:\s*Resource\[\]\s*=\s*(\[[\s\S]*?\]);/);
    if (!m) return [];
    // Quick and dirty eval-like parse (safer than actual eval)
    const items = [];
    const entryRe = /\{\s*slug:\s*"([^"]+)"/g;
    let match;
    while ((match = entryRe.exec(m[1])) !== null) {
      items.push({ slug: match[1] });
    }
    // Extract more fields using regex
    const titleRe = /\{\s*([\s\S]*?)\},/g;
    while ((match = titleRe.exec(m[1])) !== null) {
      const block = match[1];
      const item = {};
      const fieldRe = /(\w+):\s*(?:"([^"]*)"|(\w+)|(\{[^}]*\}))/g;
      let fm;
      while ((fm = fieldRe.exec(block)) !== null) {
        item[fm[1]] = fm[2] !== undefined ? fm[2] : fm[3] || fm[4];
      }
      if (item.slug) items.push(item);
    }
    return items;
  } catch { return []; }
}

// ══════════════════════════════════════════════════
//  Admin HTML
// ══════════════════════════════════════════════════
function getAdminHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>LXSBest Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0f2f5; color: #1a2332; }
  .app { display: flex; height: 100vh; }

  /* ── Sidebar ── */
  .sidebar { width: 220px; background: #1a2332; color: #fff; padding: 20px 0; flex-shrink: 0; display: flex; flex-direction: column; }
  .sidebar h1 { font-size: 15px; padding: 0 20px 16px; border-bottom: 1px solid #2a3545; margin-bottom: 8px; }
  .sidebar h1 small { display: block; font-size: 11px; font-weight: 400; color: #7a8ba5; margin-top: 2px; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 20px; cursor: pointer; font-size: 13px; color: #a0b0c5; transition: all .15s; border: none; background: none; width: 100%; text-align: left; }
  .nav-item:hover { background: #253040; color: #e0e8f0; }
  .nav-item.active { background: #2d6dc3; color: #fff; }
  .nav-item .badge { margin-left: auto; background: rgba(255,255,255,.15); padding: 1px 8px; border-radius: 8px; font-size: 11px; }
  .nav-item.active .badge { background: rgba(255,255,255,.25); }
  .sidebar-footer { margin-top: auto; padding: 12px 20px; font-size: 11px; color: #5a6a85; border-top: 1px solid #2a3545; }
  .sidebar-footer a { color: #7a8ba5; text-decoration: none; }
  .sidebar-footer a:hover { color: #a0b0c5; }

  /* ── Main ── */
  .main { flex: 1; overflow-y: auto; padding: 0; }
  .main-header { padding: 20px 28px 16px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .main-header h2 { font-size: 18px; }
  .main-header .sub { font-size: 13px; color: #7a8ba5; }
  .main-body { padding: 24px 28px; }

  /* ── Cards ── */
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px; }
  .card-header { padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px; }
  .card-body { padding: 20px; }

  /* ── Buttons ── */
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; text-decoration: none; }
  .btn-primary { background: #2d6dc3; color: #fff; }
  .btn-primary:hover { background: #1a5aad; }
  .btn-success { background: #22c55e; color: #fff; }
  .btn-success:hover { background: #16a34a; }
  .btn-danger { background: #ef4444; color: #fff; }
  .btn-danger:hover { background: #dc2626; }
  .btn-outline { background: transparent; color: #64748b; border: 1px solid #e2e8f0; }
  .btn-outline:hover { background: #f1f5f9; }
  .btn-sm { padding: 5px 10px; font-size: 12px; }

  /* ── Form ── */
  .form-group { margin-bottom: 14px; }
  .form-group label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 4px; }
  .form-control { width: 100%; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; background: #fff; }
  .form-control:focus { outline: none; border-color: #2d6dc3; box-shadow: 0 0 0 3px rgba(45,109,195,.1); }
  textarea.form-control { font-family: inherit; resize: vertical; min-height: 100px; }
  textarea.code { font-family: "SF Mono", "Fira Code", monospace; font-size: 12px; }
  select.form-control { appearance: auto; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  /* ── Table/list ── */
  .list { list-style: none; }
  .list-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #f0f2f5; cursor: pointer; transition: background .1s; }
  .list-item:hover { background: #f8fafc; }
  .list-item:last-child { border-bottom: none; }
  .list-item .info { flex: 1; }
  .list-item .title { font-size: 14px; font-weight: 600; }
  .list-item .meta { font-size: 12px; color: #94a3b8; margin-top: 2px; }
  .list-item .actions { display: flex; gap: 6px; flex-shrink: 0; }
  .tag { display: inline-block; padding: 1px 8px; border-radius: 6px; font-size: 11px; background: #eef4ff; color: #2d6dc3; margin-right: 4px; }
  .tag-amber { background: #fef3c7; color: #92400e; }
  .tag-green { background: #dcfce7; color: #166534; }
  .tag-red { background: #fee2e2; color: #991b1b; }
  .empty { text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 14px; }
  .search { display: flex; gap: 8px; margin-bottom: 16px; }
  .search input { flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; }
  .search input:focus { outline: none; border-color: #2d6dc3; }

  /* ── Tabs ── */
  .tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
  .tab { padding: 10px 16px; border: none; background: none; cursor: pointer; font-size: 13px; font-weight: 600; color: #94a3b8; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all .15s; }
  .tab:hover { color: #64748b; }
  .tab.active { color: #2d6dc3; border-bottom-color: #2d6dc3; }
  .tab-content { display: none; }
  .tab-content.active { display: block; }

  /* ── Paste zone ── */
  .paste-zone { border: 2px dashed #cbd5e1; border-radius: 12px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all .2s; background: #fafbfc; margin-bottom: 16px; }
  .paste-zone:hover, .paste-zone.dragover { border-color: #2d6dc3; background: #eef4ff; }
  .paste-zone p { color: #64748b; font-size: 13px; }
  .paste-zone .hint { font-size: 12px; color: #94a3b8; margin-top: 4px; }

  /* ── Image grid ── */
  .img-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .img-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
  .img-card img { width: 100%; aspect-ratio: 16/9; object-fit: cover; background: #eef1f7; cursor: pointer; }
  .img-card .info { padding: 8px 10px; }
  .img-card .name { font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .img-card .code { font-size: 10px; color: #2d6dc3; background: #eef4ff; padding: 3px 6px; border-radius: 4px; margin-top: 4px; cursor: pointer; word-break: break-all; }
  .img-card .actions { display: flex; gap: 4px; padding: 4px 10px 8px; }

  /* ── Modal ── */
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 100; align-items: center; justify-content: center; }
  .modal-overlay.active { display: flex; }
  .modal { background: #fff; border-radius: 16px; width: 90%; max-width: 640px; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.15); }
  .modal-header { padding: 20px 24px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .modal-header h3 { font-size: 16px; }
  .modal-close { width: 28px; height: 28px; border-radius: 50%; border: none; background: #f0f2f5; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; color: #64748b; }
  .modal-body { padding: 20px 24px; }
  .modal-footer { padding: 12px 24px 20px; display: flex; gap: 8px; justify-content: flex-end; }

  /* ── Toast ── */
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #1a2332; color: #fff; padding: 10px 24px; border-radius: 8px; font-size: 13px; z-index: 200; opacity: 0; transition: opacity .25s; pointer-events: none; }
  .toast.show { opacity: 1; }

  /* ── Preview ── */
  .preview-frame { border: 1px solid #e2e8f0; border-radius: 8px; width: 100%; height: 400px; }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .app { flex-direction: column; }
    .sidebar { width: 100%; padding: 12px 0; flex-direction: row; overflow-x: auto; }
    .sidebar h1 { display: none; }
    .nav-item { white-space: nowrap; padding: 8px 14px; font-size: 12px; }
    .sidebar-footer { display: none; }
    .form-row { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<div class="app">
  <!-- Sidebar -->
  <nav class="sidebar">
    <h1>LXSBest <small>Content Admin</small></h1>
    <button class="nav-item active" data-tab="articles">📝 Articles <span class="badge" id="nav-articles-count">0</span></button>
    <button class="nav-item" data-tab="images">🖼️ Images <span class="badge" id="nav-images-count">0</span></button>
    <button class="nav-item" data-tab="resources">📦 Resources <span class="badge" id="nav-resources-count">0</span></button>
    <button class="nav-item" data-tab="preview">👁️ Preview</button>
    <div class="sidebar-footer">
      <a href="http://localhost:4326" target="_blank">Open Site →</a>
    </div>
  </nav>

  <!-- Main -->
  <div class="main">
    <!-- ====== ARTICLES TAB ====== -->
    <div id="tab-articles" class="tab-content active">
      <div class="main-header">
        <div>
          <h2>Articles</h2>
          <div class="sub">Manage blog posts</div>
        </div>
        <button class="btn btn-primary" onclick="openArticleEditor()">+ New Article</button>
      </div>
      <div class="main-body">
        <div class="search">
          <input type="text" id="blog-search" placeholder="Search articles..." oninput="loadArticles()" />
        </div>
        <div class="card">
          <div class="card-header">All Posts</div>
          <ul class="list" id="article-list"><div class="empty">Loading...</div></ul>
        </div>
      </div>
    </div>

    <!-- ====== IMAGES TAB ====== -->
    <div id="tab-images" class="tab-content">
      <div class="main-header">
        <div>
          <h2>Images</h2>
          <div class="sub">Paste screenshots or upload to blog posts</div>
        </div>
      </div>
      <div class="main-body">
        <div class="card">
          <div class="card-header">📋 Paste or Drop</div>
          <div class="card-body">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
              <label style="font-size:13px;font-weight:600;">Blog slug:</label>
              <input class="form-control" id="img-slug" placeholder="e.g. my-article-title" style="max-width:300px;" />
              <span style="font-size:11px;color:#94a3b8;">→ /assets/blog/&lt;slug&gt;/</span>
            </div>
            <div class="paste-zone" id="paste-zone" tabindex="0">
              <p><strong>Ctrl+V</strong> to paste from clipboard, or drag & drop</p>
              <div class="hint">Images are auto-saved and markdown is copied to clipboard</div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">Images <span id="img-count" class="badge">0</span></div>
          <div class="card-body">
            <div id="img-grid" class="img-grid"><div class="empty">Paste an image above</div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ====== RESOURCES TAB ====== -->
    <div id="tab-resources" class="tab-content">
      <div class="main-header">
        <div>
          <h2>Resources</h2>
          <div class="sub">Manage downloadable files</div>
        </div>
        <button class="btn btn-primary" onclick="openResourceForm()">+ Add Resource</button>
      </div>
      <div class="main-body">
        <div class="search">
          <input type="text" id="res-search" placeholder="Search resources..." oninput="loadResources()" />
        </div>
        <div class="card">
          <div class="card-header">All Resources</div>
          <ul class="list" id="resource-list"><div class="empty">Loading...</div></ul>
        </div>
      </div>
    </div>

    <!-- ====== PREVIEW TAB ====== -->
    <div id="tab-preview" class="tab-content">
      <div class="main-header">
        <div>
          <h2>Preview</h2>
          <div class="sub">Live site preview (Astro dev server)</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="refreshPreview()">Refresh</button>
      </div>
      <div class="main-body">
        <iframe class="preview-frame" id="preview-frame" src="http://localhost:4326"></iframe>
      </div>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<!-- ===== Article Editor Modal ===== -->
<div class="modal-overlay" id="article-modal">
  <div class="modal">
    <div class="modal-header">
      <h3 id="article-modal-title">New Article</h3>
      <button class="modal-close" onclick="closeModal('article-modal')">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Title</label>
        <input class="form-control" id="art-title" placeholder="Article title" />
      </div>
      <div class="form-group">
        <label>Slug (URL)</label>
        <input class="form-control" id="art-slug" placeholder="auto-generated" style="color:#94a3b8;" />
      </div>
      <div class="form-group">
        <label>Description (SEO)</label>
        <input class="form-control" id="art-desc" placeholder="Brief description" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date</label>
          <input class="form-control" id="art-date" type="date" />
        </div>
        <div class="form-group">
          <label>Tags (comma-separated)</label>
          <input class="form-control" id="art-tags" placeholder="PLG, SaaS, AI" />
        </div>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="art-draft" />
        <label for="art-draft" style="margin:0;">Draft (hidden from list)</label>
      </div>
      <div class="form-group">
        <label>Body (Markdown)</label>
        <textarea class="form-control code" id="art-body" rows="12" placeholder="Write your article in Markdown..."></textarea>
      </div>
      <div style="font-size:12px;color:#94a3b8;">
        💡 Tip: Switch to Images tab, paste screenshots, then paste the markdown here.
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('article-modal')">Cancel</button>
      <button class="btn btn-danger btn-sm" id="art-delete-btn" style="display:none;" onclick="deleteArticle()">Delete</button>
      <button class="btn btn-primary" id="art-save-btn" onclick="saveArticle()">Save</button>
    </div>
  </div>
</div>

<!-- ===== Resource Form Modal ===== -->
<div class="modal-overlay" id="resource-modal">
  <div class="modal">
    <div class="modal-header">
      <h3>Add Resource</h3>
      <button class="modal-close" onclick="closeModal('resource-modal')">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Title</label>
        <input class="form-control" id="res-title" placeholder="Resource title" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>File Type</label>
          <select class="form-control" id="res-filetype"><option>ZIP</option><option>PDF</option></select>
        </div>
        <div class="form-group">
          <label>File Size</label>
          <input class="form-control" id="res-filesize" placeholder="e.g. 10MB" />
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="form-control" id="res-desc" rows="3" placeholder="Resource description"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Price</label>
          <select class="form-control" id="res-price">
            <option value="pay">Pay What You Want</option>
            <option value="free">Free</option>
          </select>
        </div>
        <div class="form-group">
          <label>Category</label>
          <select class="form-control" id="res-category">
            <option value="ai-dev">AI & Dev</option>
            <option value="seo">SEO</option>
            <option value="advertising">Advertising</option>
            <option value="market-insights">Market Insights</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Cover Image <span style="font-weight:400;color:#94a3b8;">(click to upload)</span></label>
        <input type="file" id="res-cover" accept="image/*" style="font-size:13px;" />
      </div>
      <div class="form-group">
        <label>Download File <span style="font-weight:400;color:#94a3b8;">(ZIP or PDF)</span></label>
        <input type="file" id="res-file" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('resource-modal')">Cancel</button>
      <button class="btn btn-danger btn-sm" id="res-delete-btn" style="display:none;" onclick="deleteResource()">Delete</button>
      <button class="btn btn-primary" id="res-save-btn" onclick="saveResource()">Add Resource</button>
    </div>
  </div>
</div>

<script>
  // ─── State ───
  let editingSlug = null;
  let editingRes = null;

  // ─── Toast ───
  let toastTimer;
  function showToast(msg, isError) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.style.background = isError ? "#dc2626" : "#1a2332";
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
  }

  // ─── Tabs ───
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
      const tab = document.getElementById("tab-" + btn.dataset.tab);
      if (tab) tab.classList.add("active");
    });
  });

  // ─── Modal ───
  function openModal(id) { document.getElementById(id).classList.add("active"); }
  function closeModal(id) { document.getElementById(id).classList.remove("active"); }
  window.closeModal = closeModal;

  // ═══════════════════════════════════════════
  //  ARTICLES
  // ═══════════════════════════════════════════
  async function loadArticles() {
    const q = document.getElementById("blog-search").value.trim();
    const url = "/blog" + (q ? "?q=" + encodeURIComponent(q) : "");
    try {
      const res = await fetch(url);
      const posts = await res.json();
      document.getElementById("nav-articles-count").textContent = posts.length;
      const list = document.getElementById("article-list");
      if (posts.length === 0) {
        list.innerHTML = '<div class="empty">No articles found. Create one!</div>';
        return;
      }
      list.innerHTML = posts.map((p) => \`
        <li class="list-item" onclick="editArticle('\${p.slug}')">
          <div class="info">
            <div class="title">\${p.draft ? '<span style="color:#f59e0b;">[Draft]</span> ' : ''}\${p.title || p.slug}</div>
            <div class="meta">
              \${p.date ? new Date(p.date).toLocaleDateString("zh-CN") : ""}
              \${p.tags && p.tags.length ? p.tags.map((t) => '<span class="tag">' + t + "</span>").join("") : ""}
            </div>
          </div>
          <div class="actions">
            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();editArticle('\${p.slug}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();confirmDelete('\${p.slug}')">Del</button>
          </div>
        </li>
      \`).join("");
    } catch (e) {
      showToast("Failed to load articles: " + e.message, true);
    }
  }

  function openArticleEditor(slug) {
    editingSlug = slug || null;
    document.getElementById("article-modal-title").textContent = slug ? "Edit Article" : "New Article";
    document.getElementById("art-delete-btn").style.display = slug ? "" : "none";
    document.getElementById("art-save-btn").textContent = slug ? "Update" : "Create";

    if (!slug) {
      // Reset form
      document.getElementById("art-title").value = "";
      document.getElementById("art-slug").value = "";
      document.getElementById("art-desc").value = "";
      document.getElementById("art-date").value = new Date().toISOString().split("T")[0];
      document.getElementById("art-tags").value = "";
      document.getElementById("art-draft").checked = false;
      document.getElementById("art-body").value = "";
      openModal("article-modal");
      return;
    }

    fetch("/blog/" + encodeURIComponent(slug))
      .then((r) => r.json())
      .then((p) => {
        document.getElementById("art-title").value = p.title || "";
        document.getElementById("art-slug").value = p.slug;
        document.getElementById("art-desc").value = p.description || "";
        document.getElementById("art-date").value = p.date ? new Date(p.date).toISOString().split("T")[0] : "";
        document.getElementById("art-tags").value = Array.isArray(p.tags) ? p.tags.join(", ") : "";
        document.getElementById("art-draft").checked = !!p.draft;
        document.getElementById("art-body").value = p.body || "";
        openModal("article-modal");
      })
      .catch((e) => showToast("Error loading: " + e.message, true));
  }
  window.openArticleEditor = openArticleEditor;

  function editArticle(slug) { openArticleEditor(slug); }

  async function saveArticle() {
    const slug = editingSlug || document.getElementById("art-slug").value.trim();

    const data = {
      title: document.getElementById("art-title").value.trim(),
      description: document.getElementById("art-desc").value.trim(),
      date: document.getElementById("art-date").value || new Date().toISOString().split("T")[0],
      tags: document.getElementById("art-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
      draft: document.getElementById("art-draft").checked,
      body: document.getElementById("art-body").value,
    };

    if (!data.title) { showToast("Title is required", true); return; }

    try {
      let res;
      if (editingSlug) {
        res = await fetch("/blog/" + encodeURIComponent(editingSlug), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        res = await fetch("/blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || "Save failed", true);
        return;
      }

      showToast(editingSlug ? "Article updated" : "Article created");
      closeModal("article-modal");
      loadArticles();

      // Refresh slug display
      if (!editingSlug) {
        const result = await res.json();
        document.getElementById("art-slug").value = result.slug;
      }
    } catch (e) {
      showToast("Error: " + e.message, true);
    }
  }

  function confirmDelete(slug) {
    if (confirm("Delete this article? This cannot be undone.")) {
      fetch("/blog/" + encodeURIComponent(slug), { method: "DELETE" })
        .then((r) => r.json())
        .then(() => { showToast("Deleted"); loadArticles(); })
        .catch((e) => showToast("Error: " + e.message, true));
    }
  }
  window.confirmDelete = confirmDelete;

  async function deleteArticle() {
    if (!editingSlug) return;
    if (confirm("Delete '" + editingSlug + "'?")) {
      try {
        await fetch("/blog/" + encodeURIComponent(editingSlug), { method: "DELETE" });
        showToast("Deleted");
        closeModal("article-modal");
        loadArticles();
      } catch (e) { showToast("Error: " + e.message, true); }
    }
  }

  // Auto-slug from title
  document.getElementById("art-title").addEventListener("input", function() {
    if (!editingSlug) {
      document.getElementById("art-slug").value = this.value.toLowerCase().replace(/[^\\w\\s-]/g, "").replace(/[\\s_]+/g, "-").replace(/^-+|-+$/g, "");
    }
  });

  // ═══════════════════════════════════════════
  //  IMAGES
  // ═══════════════════════════════════════════
  const pasteZone = document.getElementById("paste-zone");
  const imgSlugInput = document.getElementById("img-slug");

  // Load images on slug change
  imgSlugInput.addEventListener("input", loadImages);

  // Paste
  pasteZone.addEventListener("paste", (e) => {
    e.preventDefault();
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) uploadImage(file);
        return;
      }
    }
    showToast("No image in clipboard");
  });

  // Drag & drop
  pasteZone.addEventListener("dragover", (e) => { e.preventDefault(); pasteZone.classList.add("dragover"); });
  pasteZone.addEventListener("dragleave", () => pasteZone.classList.remove("dragover"));
  pasteZone.addEventListener("drop", (e) => {
    e.preventDefault();
    pasteZone.classList.remove("dragover");
    for (const f of e.dataTransfer.files) {
      if (f.type.startsWith("image/")) { uploadImage(f); return; }
    }
    showToast("Please drop an image");
  });

  // Global paste: skip if typing in input
  document.addEventListener("paste", (e) => {
    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadImage(file);
        return;
      }
    }
  });

  async function uploadImage(file) {
    const slug = imgSlugInput.value.trim();
    if (!slug) { showToast("Enter a blog slug first", true); imgSlugInput.focus(); return; }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: reader.result, slug }),
        });
        const result = await res.json();
        if (res.ok) {
          try { await navigator.clipboard.writeText(result.markdown); } catch {}
          showToast("Copied markdown to clipboard!");
          loadImages();
        } else {
          showToast(result.error || "Upload failed", true);
        }
      } catch (e) { showToast("Error: " + e.message, true); }
    };
    reader.readAsDataURL(file);
  }

  async function loadImages() {
    const slug = imgSlugInput.value.trim();
    const grid = document.getElementById("img-grid");
    const countEl = document.getElementById("img-count");
    if (!slug) { grid.innerHTML = '<div class="empty">Enter a slug above</div>'; countEl.textContent = "0"; return; }

    try {
      const res = await fetch("/images/" + encodeURIComponent(slug));
      const images = await res.json();
      countEl.textContent = images.length;
      document.getElementById("nav-images-count").textContent = images.length;

      if (images.length === 0) {
        grid.innerHTML = '<div class="empty">No images yet. Paste one above.</div>';
        return;
      }

      grid.innerHTML = images.map((img) => \`
        <div class="img-card">
          <img src="\${img.url}" alt="\${img.filename}" onclick="window.open('\${img.url}','_blank')" />
          <div class="info">
            <div class="name" title="\${img.filename}">\${img.filename}</div>
            <div class="code" onclick="copyText('\${img.markdown.replace(/\\//g, "\\\\/").replace(/'/g, "\\\\'")}')" title="Copy markdown">\${img.markdown}</div>
          </div>
          <div class="actions">
            <button class="btn btn-sm btn-outline" onclick="replaceImage('\${img.filename}')">Replace</button>
            <button class="btn btn-sm btn-danger" onclick="deleteImage('\${img.filename}')">Delete</button>
          </div>
        </div>
      \`).join("");
    } catch (e) { showToast("Error loading images", true); }
  }

  window.copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); showToast("Copied!"); }
    catch { showToast("Copy failed"); }
  };

  window.deleteImage = async (filename) => {
    if (!confirm("Delete " + filename + "?")) return;
    const slug = imgSlugInput.value.trim();
    try {
      await fetch("/images/" + encodeURIComponent(slug) + "/" + encodeURIComponent(filename), { method: "DELETE" });
      showToast("Deleted");
      loadImages();
    } catch (e) { showToast("Error: " + e.message, true); }
  };

  window.replaceImage = (filename) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const slug = imgSlugInput.value.trim();
      if (!slug) { showToast("Enter slug first", true); return; }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch("/images/" + encodeURIComponent(slug) + "/" + encodeURIComponent(filename), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: reader.result }),
          });
          if (res.ok) { showToast("Replaced"); loadImages(); }
          else { showToast("Replace failed", true); }
        } catch (e) { showToast("Error: " + e.message, true); }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // ═══════════════════════════════════════════
  //  RESOURCES
  // ═══════════════════════════════════════════
  async function loadResources() {
    const q = document.getElementById("res-search").value.trim();
    const url = "/resources" + (q ? "?q=" + encodeURIComponent(q) : "");
    try {
      const res = await fetch(url);
      const resources = await res.json();
      document.getElementById("nav-resources-count").textContent = resources.length;
      const list = document.getElementById("resource-list");
      if (resources.length === 0) {
        list.innerHTML = '<div class="empty">No resources found</div>';
        return;
      }
      list.innerHTML = resources.map((r) => \`
        <li class="list-item">
          <div class="info">
            <div class="title">\${r.title || r.slug}</div>
            <div class="meta">\${r.fileType || ""} \${r.fileSize ? "· " + r.fileSize : ""} · \${r.priceTag?.label || ""}</div>
          </div>
          <div class="actions">
            <button class="btn btn-sm btn-danger" onclick="deleteResource('\${r.slug}')">Delete</button>
          </div>
        </li>
      \`).join("");
    } catch (e) { showToast("Error loading resources", true); }
  }

  function openResourceForm() {
    editingRes = null;
    document.getElementById("res-title").value = "";
    document.getElementById("res-desc").value = "";
    document.getElementById("res-filesize").value = "";
    document.getElementById("res-filetype").value = "ZIP";
    document.getElementById("res-price").value = "pay";
    document.getElementById("res-category").value = "ai-dev";
    document.getElementById("res-cover").value = "";
    document.getElementById("res-file").value = "";
    document.getElementById("res-save-btn").textContent = "Add Resource";
    document.getElementById("res-delete-btn").style.display = "none";
    openModal("resource-modal");
  }
  window.openResourceForm = openResourceForm;

  async function saveResource() {
    const title = document.getElementById("res-title").value.trim();
    if (!title) { showToast("Title required", true); return; }

    // For simplicity, we just send the metadata. Large file uploads via
    // the form would need multipart - we'll use the simpler approach:
    // save files to disk and append entry to resources.ts

    const data = {
      title,
      description: document.getElementById("res-desc").value.trim(),
      fileType: document.getElementById("res-filetype").value,
      fileSize: document.getElementById("res-filesize").value.trim(),
      isFree: document.getElementById("res-price").value === "free",
      category: document.getElementById("res-category").value,
    };

    // Handle cover as base64
    const coverFile = document.getElementById("res-cover").files[0];
    if (coverFile) {
      data.coverData = await fileToBase64(coverFile);
    }

    // Handle download file as base64
    const dlFile = document.getElementById("res-file").files[0];
    if (dlFile) {
      data.fileData = await fileToBase64(dlFile);
      data.fileExt = pathExt(dlFile.name);
    }

    try {
      const res = await fetch("/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        showToast("Resource added!");
        closeModal("resource-modal");
        loadResources();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed", true);
      }
    } catch (e) { showToast("Error: " + e.message, true); }
  }

  function deleteResource(slug) {
    if (!slug) return;
    if (!confirm("Delete resource " + slug + "?")) return;
    fetch("/resources/" + encodeURIComponent(slug), { method: "DELETE" })
      .then((r) => r.json())
      .then(() => { showToast("Deleted"); loadResources(); })
      .catch((e) => showToast("Error: " + e.message, true));
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function pathExt(name) {
    const i = name.lastIndexOf(".");
    return i >= 0 ? name.slice(i) : "";
  }

  // ═══════════════════════════════════════════
  //  PREVIEW
  // ═══════════════════════════════════════════
  function refreshPreview() {
    document.getElementById("preview-frame").src = "http://localhost:4326";
  }

  // ═══════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════
  loadArticles();
</script>
</body>
</html>`;
}

// ─── Start ────────────────────────────────────────
const server = http.createServer(router);
server.listen(PORT, () => {
  console.log(`\n  ✦ LXSBest Admin Server`);
  console.log(`  ─────────────────────`);
  console.log(`  Admin UI : http://localhost:${PORT}`);
  console.log(`  Site     : http://localhost:4326`);
  console.log(`\n  Articles, Images, Resources — all in one place.\n`);
});
