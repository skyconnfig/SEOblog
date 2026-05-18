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
const WORKS_JSON = path.join(ROOT, "src", "data", "works.json");
const WORKS_DIR = path.join(ROOT, "public", "assets", "works");
const HIDDEN_WORKS_JSON = path.join(ROOT, "src", "data", "works-hidden.json");

// Built-in projects (same as in src/pages/works/index.astro & index.astro)
const BUILTIN_PROJECTS = [
  { id: "redol-ai", title: "Redol AI", description: "AI Agent for Social Media Content Production", slug: "redol-ai", tags: ["AI SaaS", "PM", "PLG", "AI Agent", "Indie Project"], siteUrl: "https://redol.ai", cover: "/assets/works/redol-ai.webp", builtIn: true, createdAt: "2026-01-15" },
  { id: "realibox", title: "Realibox", description: "3D + AI Agent SaaS for intelligent 3D asset production workflow, from mockup design to 3D configurators, animations, and scene rendering", slug: "realibox", tags: ["3D SaaS", "AI Agent", "Product Manager", "Global Operations"], siteUrl: "https://realibox.com", cover: "/assets/works/realibox.jpg", builtIn: true, createdAt: "2026-02-01" },
  { id: "insmind", title: "Insmind", description: "AI-powered image editing SaaS platform, empowered 0-1 growth stage as PMF and SEM consultant", slug: "insmind", tags: ["AI Image", "AI Design", "PMF Consultant", "SEM Consultant"], siteUrl: "https://insmind.com", cover: "/assets/works/insmind.jpg", builtIn: true, createdAt: "2026-03-01" },
  { id: "melogen-ai", title: "Melogen AI", description: "AI audio SaaS for musicians and music enthusiasts, developed as an indie project by a musician", slug: "melogen-ai", tags: ["AI Audio", "Music SaaS", "Indie Project", "Musician"], siteUrl: "https://melogenai.com", cover: "/assets/works/melogenai.jpg", builtIn: true, createdAt: "2026-04-01" },
  { id: "plushthis", title: "PlushThis", description: "Alt-style plush toy brand e-commerce, empowered 0-1 growth as digital marketing consultant with full SEO and brand strategy", slug: "plushthis", tags: ["E-commerce", "Digital Marketing", "SEO Strategy", "Brand Consultant"], siteUrl: "https://plushthis.com", cover: "/assets/works/plushthis.jpg", builtIn: true, createdAt: "2026-05-01" },
];

function readHiddenSlugs() {
  try { return JSON.parse(fs.readFileSync(HIDDEN_WORKS_JSON, "utf8")); } catch { return []; }
}
function writeHiddenSlugs(slugs) {
  fs.writeFileSync(HIDDEN_WORKS_JSON, JSON.stringify(slugs, null, 2), "utf8");
}

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
  const lines = [
    "---",
    `title: "${fm.title}"`,
    `description: "${fm.description || ""}"`,
    `date: ${date}`,
    `tags: ${tags}`,
    `draft: ${fm.draft || false}`,
  ];
  if (fm.image) lines.push(`image: "${fm.image}"`);
  else if (fm.cover) lines.push(`image: "${fm.cover}"`);
  lines.push("---", "", body, "");
  return lines.join("\n");
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

    // ── GET /preview → live preview page ──
    if (method === "GET" && p[0] === "preview") {
      html(res, 200, getPreviewHTML());
      return;
    }

    // ── GET /preview-resource → resource live preview page ──
    if (method === "GET" && p[0] === "preview-resource") {
      html(res, 200, getResourcePreviewHTML());
      return;
    }

    // ── GET /preview-work → work live preview page ──
    if (method === "GET" && p[0] === "preview-work") {
      html(res, 200, getWorkPreviewHTML());
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
        if (f === ".md") return null;
        return { ...frontmatter, slug: f.replace(".md", ""), filename: f, _raw: raw };
      }).filter(Boolean);
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

    // ──────────────── WORKS ────────────────

    // GET /works → list all works (built-in + admin-added)
    if (method === "GET" && p[0] === "works" && !p[1]) {
      const hidden = readHiddenSlugs();
      const hiddenSet = new Set(hidden);
      // Admin-added from works.json
      let jsonWorks = [];
      if (fs.existsSync(WORKS_JSON)) {
        jsonWorks = JSON.parse(fs.readFileSync(WORKS_JSON, "utf8")).filter((w) => w.published);
      }
      // Built-in projects, filtered by hidden slugs
      const visibleBuiltIn = BUILTIN_PROJECTS.filter((p) => !hiddenSet.has(p.slug));
      // Merge: builtIn + jsonWorks, exclude slugs already covered by builtIn
      const builtInSlugs = new Set(BUILTIN_PROJECTS.map((p) => p.slug));
      const extraWorks = jsonWorks.filter((w) => !builtInSlugs.has(w.slug));
      const all = [...visibleBuiltIn, ...extraWorks];
      const search = url.searchParams.get("q")?.toLowerCase() || "";
      const filtered = search ? all.filter((w) =>
        (w.title || "").toLowerCase().includes(search) || w.slug?.includes(search)
      ) : all;
      filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      json(res, 200, filtered);
      return;
    }

    // GET /works/hidden → list hidden built-in slugs
    if (method === "GET" && p[0] === "works" && p[1] === "hidden") {
      json(res, 200, readHiddenSlugs());
      return;
    }

    // PUT /works/hidden → update hidden list
    if (method === "PUT" && p[0] === "works" && p[1] === "hidden") {
      const data = await parseBody(req);
      writeHiddenSlugs(data.slugs || []);
      json(res, 200, { success: true });
      return;
    }

    // GET /works/:slug → single work (admin-added or built-in)
    if (method === "GET" && p[0] === "works" && p[1]) {
      if (fs.existsSync(WORKS_JSON)) {
        const works = JSON.parse(fs.readFileSync(WORKS_JSON, "utf8"));
        const work = works.find((w) => w.slug === p[1]);
        if (work) { json(res, 200, work); return; }
      }
      // Check built-in projects
      const builtIn = BUILTIN_PROJECTS.find((bp) => bp.slug === p[1]);
      if (builtIn) { json(res, 200, { ...builtIn, published: true }); return; }
      json(res, 404, { error: "Not found" });
      return;
    }

    // POST /works → create work
    if (method === "POST" && p[0] === "works") {
      const data = await parseBody(req);
      const slug = data.slug || slugify(data.title);

      let cover = data.cover || "";
      if (data.coverData) {
        const coverDir = path.join(WORKS_DIR, slug);
        fs.mkdirSync(coverDir, { recursive: true });
        const coverName = "cover-" + Date.now() + ".png";
        const buf = data.coverData.startsWith("data:") ? Buffer.from(data.coverData.split(",")[1], "base64") : Buffer.from(data.coverData, "base64");
        fs.writeFileSync(path.join(coverDir, coverName), buf);
        cover = "/assets/works/" + slug + "/" + coverName;
      }

      const work = {
        title: data.title,
        slug,
        cover,
        tags: data.tags || [],
        description: data.description || "",
        siteUrl: data.siteUrl || "",
        published: data.published !== undefined ? data.published : true,
        createdAt: today(),
      };

      let works = fs.existsSync(WORKS_JSON) ? JSON.parse(fs.readFileSync(WORKS_JSON, "utf8")) : [];
      if (works.find((w) => w.slug === slug)) {
        json(res, 409, { error: "Slug already exists" });
        return;
      }
      works.push(work);
      fs.writeFileSync(WORKS_JSON, JSON.stringify(works, null, 2), "utf8");
      json(res, 201, { slug, work });
      return;
    }

    // PUT /works/:slug → update work (supports both built-in and admin-added)
    if (method === "PUT" && p[0] === "works" && p[1]) {
      const data = await parseBody(req);
      const slug = p[1];
      if (!fs.existsSync(WORKS_JSON)) { json(res, 404, { error: "Not found" }); return; }
      let works = JSON.parse(fs.readFileSync(WORKS_JSON, "utf8"));
      let idx = works.findIndex((w) => w.slug === slug);

      // If not found, check if it's a built-in project → create entry
      if (idx === -1) {
        const builtIn = BUILTIN_PROJECTS.find((bp) => bp.slug === slug);
        if (!builtIn) { json(res, 404, { error: "Not found" }); return; }
        // Remove from hidden if present
        const hidden = readHiddenSlugs();
        writeHiddenSlugs(hidden.filter((s) => s !== slug));
        // Create new entry with built-in defaults
        works.push({
          slug,
          title: builtIn.title,
          cover: builtIn.cover || "",
          tags: builtIn.tags || [],
          description: builtIn.description || "",
          siteUrl: builtIn.siteUrl || "",
          published: true,
          createdAt: builtIn.createdAt || new Date().toISOString().slice(0, 10),
        });
        idx = works.length - 1;
      }

      let cover = works[idx].cover;
      if (data.coverData) {
        const coverDir = path.join(WORKS_DIR, slug);
        fs.mkdirSync(coverDir, { recursive: true });
        const coverName = "cover-" + Date.now() + ".png";
        const buf = data.coverData.startsWith("data:") ? Buffer.from(data.coverData.split(",")[1], "base64") : Buffer.from(data.coverData, "base64");
        fs.writeFileSync(path.join(coverDir, coverName), buf);
        cover = "/assets/works/" + slug + "/" + coverName;
      } else if (data.cover !== undefined) {
        cover = data.cover;
      }

      works[idx] = {
        ...works[idx],
        title: data.title !== undefined ? data.title : works[idx].title,
        cover,
        tags: data.tags !== undefined ? data.tags : works[idx].tags,
        description: data.description !== undefined ? data.description : works[idx].description,
        siteUrl: data.siteUrl !== undefined ? data.siteUrl : works[idx].siteUrl,
        published: data.published !== undefined ? data.published : works[idx].published,
      };

      fs.writeFileSync(WORKS_JSON, JSON.stringify(works, null, 2), "utf8");
      json(res, 200, { slug, work: works[idx] });
      return;
    }

    // DELETE /works/:slug
    if (method === "DELETE" && p[0] === "works" && p[1]) {
      const slug = p[1];
      // If it's a built-in project, add to hidden list instead
      const isBuiltIn = BUILTIN_PROJECTS.some((bp) => bp.slug === slug);
      if (isBuiltIn) {
        const hidden = readHiddenSlugs();
        if (!hidden.includes(slug)) {
          hidden.push(slug);
          writeHiddenSlugs(hidden);
        }
        json(res, 200, { success: true, hidden: true });
        return;
      }
      // Otherwise delete from works.json
      if (!fs.existsSync(WORKS_JSON)) { json(res, 404, { error: "Not found" }); return; }
      let works = JSON.parse(fs.readFileSync(WORKS_JSON, "utf8"));
      const idx = works.findIndex((w) => w.slug === slug);
      if (idx === -1) { json(res, 404, { error: "Not found" }); return; }
      works.splice(idx, 1);
      fs.writeFileSync(WORKS_JSON, JSON.stringify(works, null, 2), "utf8");
      json(res, 200, { success: true });
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

    // GET /resources/:slug → single resource
    if (method === "GET" && p[0] === "resources" && p[1]) {
      if (!fs.existsSync(RESOURCES_TS)) { json(res, 404, { error: "Not found" }); return; }
      const src = fs.readFileSync(RESOURCES_TS, "utf8");
      const arr = extractResourceArray(src);
      const resource = arr.find((r) => r.slug === p[1]);
      if (!resource) { json(res, 404, { error: "Not found" }); return; }
      json(res, 200, resource);
      return;
    }

    // PUT /resources/:slug → update resource
    if (method === "PUT" && p[0] === "resources" && p[1]) {
      const data = await parseBody(req);
      const slug = p[1];

      let newCover = data.cover || "";
      if (data.coverData) {
        const coverDir = path.join(COVERS_DIR, slug);
        fs.mkdirSync(coverDir, { recursive: true });
        const coverName = "cover-" + Date.now() + ".png";
        const buf = data.coverData.startsWith("data:") ? Buffer.from(data.coverData.split(",")[1], "base64") : Buffer.from(data.coverData, "base64");
        fs.writeFileSync(path.join(coverDir, coverName), buf);
        newCover = "/assets/resource-previews/" + slug + "/" + coverName;
      }

      let newDownloadPath = data.downloadPath || "";
      if (data.fileData) {
        fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
        const ext = data.fileExt || "." + (data.fileType || "zip").toLowerCase();
        const dest = path.join(DOWNLOADS_DIR, slug + ext);
        const buf = data.fileData.startsWith("data:") ? Buffer.from(data.fileData.split(",")[1], "base64") : Buffer.from(data.fileData, "base64");
        fs.writeFileSync(dest, buf);
        newDownloadPath = "/downloads/" + slug + ext;
      }

      let src = fs.readFileSync(RESOURCES_TS, "utf8");
      const arr = extractResourceArray(src);
      const idx = arr.findIndex((r) => r.slug === slug);
      if (idx === -1) { json(res, 404, { error: "Not found" }); return; }

      const existing = arr[idx];
      if (data.category !== undefined) existing.category = data.category;
      if (newCover) existing.cover = newCover;
      else if (data.cover !== undefined && data.cover !== "") existing.cover = data.cover;
      if (data.typeLabel !== undefined || data.typeColor !== undefined) {
        existing.typeTag = { label: data.typeLabel || existing.typeTag.label, color: data.typeColor || existing.typeTag.color };
      }
      if (data.isFree !== undefined) {
        existing.priceTag = data.isFree ? { label: "Free", color: "green" } : { label: "Pay What You Want", color: "amber" };
      }
      if (data.title !== undefined) existing.title = data.title;
      if (data.description !== undefined) existing.description = data.description;
      if (data.fileType !== undefined) existing.fileType = data.fileType.toUpperCase();
      if (data.fileSize !== undefined) existing.fileSize = data.fileSize;
      if (newDownloadPath) existing.downloadPath = newDownloadPath;

      const newEntriesText = arr.map(buildResourceEntry).join("\n");
      src = src.replace(/(export\s+const\s+resources:\s*Resource\[\]\s*=\s*\[)([\s\S]*?)(\];)/, "$1\n" + newEntriesText + "\n$3");
      fs.writeFileSync(RESOURCES_TS, src, "utf8");
      json(res, 200, { slug, resource: existing });
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

      const entry = buildResourceEntry({
        category: data.category || "ai-dev",
        cover: `/assets/resource-previews/${slug}/${coverName}`,
        typeTag: { label: data.typeLabel || "AI & Dev", color: data.typeColor || "purple" },
        priceTag: { label: data.isFree ? "Free" : "Pay What You Want", color: data.isFree ? "green" : "amber" },
        title: data.title,
        description: data.description || "",
        fileType: (data.fileType || "ZIP").toUpperCase(),
        fileSize: data.fileSize || "",
        url: `/resources/en-${slug}`,
        slug: `en-${slug}`,
        downloadPath: `/downloads/${slug}${downloadExt}`,
      });

      // Append to the resources array (before its closing ])
      let src = fs.readFileSync(RESOURCES_TS, "utf8");
      src = src.replace(/(export\s+const\s+resources:\s*Resource\[\]\s*=\s*\[[\s\S]*?)(\];)/, "$1" + entry + "\n$2");
      fs.writeFileSync(RESOURCES_TS, src, "utf8");

      json(res, 201, { slug: "en-" + slug, entry });
      return;
    }

    // DELETE /resources/:slug
    if (method === "DELETE" && p[0] === "resources" && p[1]) {
      let src = fs.readFileSync(RESOURCES_TS, "utf8");
      const slug = p[1];
      const arr = extractResourceArray(src);
      const filtered = arr.filter((r) => r.slug !== slug);
      if (filtered.length === arr.length) { json(res, 404, { error: "Not found" }); return; }
      const newEntriesText = filtered.map(buildResourceEntry).join("\n");
      src = src.replace(/(export\s+const\s+resources:\s*Resource\[\]\s*=\s*\[)([\s\S]*?)(\];)/, "$1\n" + newEntriesText + "\n$3");
      fs.writeFileSync(RESOURCES_TS, src, "utf8");
      json(res, 200, { success: true });
      return;
    }

    // ── Serve static files from public/ ──
    const publicPath = path.join(ROOT, "public", url.pathname);
    if (publicPath.startsWith(path.join(ROOT, "public")) && fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
      const ext = path.extname(publicPath).toLowerCase();
      const mime = {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
        ".css": "text/css", ".js": "application/javascript",
        ".json": "application/json", ".pdf": "application/pdf",
        ".zip": "application/zip", ".ico": "image/x-icon",
      };
      res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream", "Cache-Control": "no-cache" });
      fs.createReadStream(publicPath).pipe(res);
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
    const m = src.match(/export\s+const\s+resources:\s*Resource\[\]\s*=\s*\[([\s\S]*?)\];/);
    if (!m) return [];
    const arrayContent = m[1];
    const entries = [];
    let depth = 0, entryStart = -1;
    for (let i = 0; i < arrayContent.length; i++) {
      if (arrayContent[i] === "{") {
        if (depth === 0) entryStart = i;
        depth++;
      } else if (arrayContent[i] === "}") {
        depth--;
        if (depth === 0 && entryStart >= 0) {
          entries.push(parseResourceEntry(arrayContent.substring(entryStart, i + 1)));
          entryStart = -1;
        }
      }
    }
    return entries;
  } catch { return []; }
}

function parseResourceEntry(str) {
  const norm = str.replace(/\n\s+/g, " ").replace(/\s+/g, " ").trim();
  const getStr = (key) => { const m = norm.match(new RegExp(key + ':\\s*"([^"]*)"')); return m ? m[1] : ""; };
  const getObj = (key) => {
    const m = norm.match(new RegExp(key + ':\\s*\\{\\s*label:\\s*"([^"]*)"\\s*,\\s*color:\\s*"([^"]*)"\\s*\\}'));
    return m ? { label: m[1], color: m[2] } : { label: "", color: "" };
  };
  return {
    category: getStr("category"),
    cover: getStr("cover"),
    typeTag: getObj("typeTag"),
    priceTag: getObj("priceTag"),
    title: getStr("title"),
    description: getStr("description"),
    fileType: getStr("fileType"),
    fileSize: getStr("fileSize"),
    url: getStr("url"),
    slug: getStr("slug"),
    downloadPath: getStr("downloadPath"),
  };
}

function buildResourceEntry(r) {
  const desc = r.description || "";
  return [
    "  {",
    '    category: "' + r.category + '",',
    '    cover: "' + r.cover + '",',
    '    typeTag: { label: "' + r.typeTag.label + '", color: "' + r.typeTag.color + '" },',
    '    priceTag: { label: "' + r.priceTag.label + '", color: "' + r.priceTag.color + '" },',
    '    title: "' + r.title + '",',
    '    description: "' + desc + '",',
    '    fileType: "' + r.fileType + '",',
    '    fileSize: "' + r.fileSize + '",',
    '    url: "' + r.url + '",',
    '    slug: "' + r.slug + '",',
    '    downloadPath: "' + r.downloadPath + '",',
    "  },",
  ].join("\n");
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
  .tag-purple { background: #f3e8ff; color: #7c3aed; }
  .res-thumb { width: 60px; height: 40px; border-radius: 6px; object-fit: cover; background: #e2e8f0; flex-shrink: 0; }
  .res-meta-chips { display: flex; gap: 4px; margin-top: 2px; flex-wrap: wrap; }
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
    <h1>LXSBest <small>内容管理</small></h1>
    <button class="nav-item active" data-tab="articles">📝 文章 <span class="badge" id="nav-articles-count">0</span></button>
    <button class="nav-item" data-tab="works">作品 <span class="badge" id="nav-works-count">0</span></button>
    <button class="nav-item" data-tab="resources">📦 资源 <span class="badge" id="nav-resources-count">0</span></button>
    <button class="nav-item" data-tab="preview">👁️ 预览</button>
    <div class="sidebar-footer">
      <a href="http://localhost:4326" target="_blank">打开网站 →</a>
    </div>
  </nav>

  <!-- Main -->
  <div class="main">
    <!-- ====== ARTICLES TAB ====== -->
    <div id="tab-articles" class="tab-content active">
      <div class="main-header">
        <div>
          <h2>文章管理</h2>
          <div class="sub">管理博客文章</div>
        </div>
        <button class="btn btn-primary" onclick="openArticleEditor()">+ 新建文章</button>
      </div>
      <div class="main-body">
        <div class="search">
          <input type="text" id="blog-search" placeholder="搜索文章..." oninput="loadArticles()" />
        </div>
        <div class="card">
          <div class="card-header">所有文章</div>
          <ul class="list" id="article-list"><div class="empty">加载中...</div></ul>
        </div>
      </div>
    </div>

    <!-- ====== WORKS TAB ====== -->
    <div id="tab-works" class="tab-content">
      <div class="main-header">
        <div>
          <h2>作品管理</h2>
          <div class="sub">管理展示作品</div>
        </div>
        <button class="btn btn-primary" onclick="openWorkForm()">+ 添加作品</button>
      </div>
      <div class="main-body">
        <div class="search">
          <input type="text" id="works-search" placeholder="搜索作品..." oninput="loadWorks()" />
        </div>
        <div class="card">
          <div class="card-header">所有作品</div>
          <ul class="list" id="works-list"><div class="empty">加载中...</div></ul>
        </div>
      </div>
    </div>

    <!-- ====== RESOURCES TAB ====== -->
    <div id="tab-resources" class="tab-content">
      <div class="main-header">
        <div>
          <h2>资源管理</h2>
          <div class="sub">管理可下载文件</div>
        </div>
        <button class="btn btn-primary" onclick="openResourceForm()">+ 添加资源</button>
      </div>
      <div class="main-body">
        <div class="search">
          <input type="text" id="res-search" placeholder="搜索资源..." oninput="loadResources()" />
        </div>
        <div class="card">
          <div class="card-header">所有资源</div>
          <ul class="list" id="resource-list"><div class="empty">加载中...</div></ul>
        </div>
      </div>
    </div>

    <!-- ====== PREVIEW TAB ====== -->
    <div id="tab-preview" class="tab-content">
      <div class="main-header">
        <div>
          <h2>预览</h2>
          <div class="sub">实时网站预览 (Astro 开发服务器)</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="refreshPreview()">刷新</button>
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
      <h3 id="article-modal-title">新建文章</h3>
      <button class="modal-close" onclick="closeModal('article-modal')">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>标题</label>
        <input class="form-control" id="art-title" placeholder="文章标题" />
      </div>
      <div class="form-group">
        <label>链接 (Slug)</label>
        <input class="form-control" id="art-slug" placeholder="自动生成" style="color:#94a3b8;" />
      </div>
      <div class="form-group">
        <label>描述 (SEO)</label>
        <input class="form-control" id="art-desc" placeholder="简要描述文章内容" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>日期</label>
          <input class="form-control" id="art-date" type="date" />
        </div>
        <div class="form-group">
          <label>标签 (逗号分隔)</label>
          <input class="form-control" id="art-tags" placeholder="PLG, SaaS, AI" />
        </div>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="art-draft" />
        <label for="art-draft" style="margin:0;">草稿 (不在列表显示)</label>
      </div>
      <div class="form-group">
        <label>封面图片</label>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <input type="file" id="art-cover-input" accept="image/*" style="font-size:13px;" onchange="uploadCover(this)" />
          <span id="art-cover-name" style="font-size:12px;color:#94a3b8;"></span>
          <button class="btn btn-sm btn-danger" id="art-cover-remove" style="display:none;" onclick="removeCover()" type="button">移除封面</button>
        </div>
        <div id="art-cover-preview" style="margin-top:8px;display:none;max-width:300px;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
          <img id="art-cover-img" src="" alt="封面预览" style="width:100%;display:block;" />
        </div>
        <input type="hidden" id="art-cover" value="" />
      </div>
      <div class="form-group">
        <label>正文 (Markdown)
          <button class="btn btn-sm btn-outline" onclick="openLivePreview()" style="margin-left:10px;font-weight:400;" type="button">🖥️ 实时预览</button>
        </label>
        <textarea class="form-control code" id="art-body" rows="12" placeholder="使用 Markdown 编写文章...（可直接粘贴图片）" oninput="savePreviewState()"></textarea>
      </div>
      <div style="font-size:12px;color:#94a3b8;">
        💡 提示：可直接粘贴图片到本编辑器，自动上传。点击「实时预览」在新窗口查看渲染效果，修改实时同步。
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('article-modal')">取消</button>
      <button class="btn btn-danger btn-sm" id="art-delete-btn" style="display:none;" onclick="deleteArticle()">删除</button>
      <button class="btn btn-primary" id="art-save-btn" onclick="saveArticle()">保存</button>
    </div>
  </div>
</div>

<!-- ===== Resource Form Modal ===== -->
<div class="modal-overlay" id="resource-modal">
  <div class="modal">
    <div class="modal-header">
      <h3 id="resource-modal-title">添加资源</h3>
      <button class="modal-close" onclick="closeModal('resource-modal')">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>标题</label>
        <input class="form-control" id="res-title" placeholder="资源标题" oninput="autoSlugRes()" />
      </div>
      <div class="form-group">
        <label>Slug</label>
        <input class="form-control" id="res-slug" placeholder="自动生成" readonly style="color:#94a3b8;" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>文件类型</label>
          <select class="form-control" id="res-filetype"><option>ZIP</option><option>PDF</option></select>
        </div>
        <div class="form-group">
          <label>文件大小</label>
          <input class="form-control" id="res-filesize" placeholder="例如：10MB" />
        </div>
      </div>
      <div class="form-group">
        <label>描述</label>
        <textarea class="form-control" id="res-desc" rows="3" placeholder="资源描述"></textarea>
      </div>
      <div class="form-group" style="text-align:right;">
        <button class="btn btn-sm btn-outline" onclick="openResourceLivePreview()" type="button" style="font-weight:400;">🖥️ 实时预览</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>价格</label>
          <select class="form-control" id="res-price">
            <option value="pay">随心打赏</option>
            <option value="free">免费</option>
          </select>
        </div>
        <div class="form-group">
          <label>分类</label>
          <select class="form-control" id="res-category">
            <option value="ai-dev">AI 与开发</option>
            <option value="seo">SEO</option>
            <option value="advertising">广告</option>
            <option value="market-insights">市场洞察</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>封面图片 <span style="font-weight:400;color:#94a3b8;">(点击上传)</span></label>
        <input type="file" id="res-cover" accept="image/*" style="font-size:13px;" onchange="previewResourceCover(this)" />
        <div id="res-cover-preview" style="margin-top:8px;display:none;max-width:300px;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
          <img id="res-cover-preview-img" src="" alt="封面预览" style="width:100%;display:block;" />
        </div>
        <span id="res-cover-name" style="font-size:12px;color:#94a3b8;margin-top:4px;display:inline-block;"></span>
      </div>
      <div class="form-group">
        <label>下载文件 <span style="font-weight:400;color:#94a3b8;">(ZIP 或 PDF)</span></label>
        <input type="file" id="res-file" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('resource-modal')">取消</button>
      <button class="btn btn-danger btn-sm" id="res-delete-btn" style="display:none;" onclick="deleteResource(editingRes)">删除</button>
      <button class="btn btn-primary" id="res-save-btn" onclick="saveResource()">添加资源</button>
    </div>
  </div>
</div>

<!-- ===== Work Form Modal ===== -->
<div class="modal-overlay" id="work-modal">
  <div class="modal">
    <div class="modal-header">
      <h3 id="work-modal-title">添加作品</h3>
      <button class="modal-close" onclick="closeModal('work-modal')">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>标题</label>
        <input class="form-control" id="work-title" placeholder="作品标题" oninput="autoSlugWork()" />
      </div>
      <div class="form-group">
        <label>Slug</label>
        <input class="form-control" id="work-slug" placeholder="自动生成" readonly style="color:#94a3b8;" />
      </div>
      <div class="form-group">
        <label>标签 (逗号分隔)</label>
        <input class="form-control" id="work-tags" placeholder="React, Node.js, 设计" />
      </div>
      <div class="form-group">
        <label>简介</label>
        <textarea class="form-control" id="work-desc" rows="3" placeholder="作品简介"></textarea>
      </div>
      <div class="form-group">
        <label>站点链接</label>
        <input class="form-control" id="work-siteurl" placeholder="https://example.com" />
      </div>
      <div class="form-group">
        <label>封面图片 <span style="font-weight:400;color:#94a3b8;">(点击上传)</span></label>
        <input type="file" id="work-cover-input" accept="image/*" style="font-size:13px;" onchange="previewWorkCover(this)" />
        <div id="work-cover-preview" style="margin-top:8px;display:none;max-width:300px;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
          <img id="work-cover-preview-img" src="" alt="封面预览" style="width:100%;display:block;" />
        </div>
        <span id="work-cover-name" style="font-size:12px;color:#94a3b8;margin-top:4px;display:inline-block;"></span>
      </div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="work-published" checked />
        <label for="work-published" style="margin:0;">已发布</label>
      </div>
      <div style="text-align:right;">
        <button class="btn btn-sm btn-outline" onclick="openWorkLivePreview()" type="button" style="font-weight:400;">🖥️ 实时预览</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('work-modal')">取消</button>
      <button class="btn btn-danger btn-sm" id="work-delete-btn" style="display:none;" onclick="deleteWork(editingWork)">删除</button>
      <button class="btn btn-primary" id="work-save-btn" onclick="saveWork()">添加作品</button>
    </div>
  </div>
</div>

<script>
  // ─── State ───
  let editingSlug = null;
  let editingRes = null;
  let editingWork = null;

  // Built-in project data (mirrors server-side BUILTIN_PROJECTS)
  const BUILTIN_PROJECTS = [
    { slug: "redol-ai", title: "Redol AI" },
    { slug: "realibox", title: "Realibox" },
    { slug: "insmind", title: "Insmind" },
    { slug: "melogen-ai", title: "Melogen AI" },
    { slug: "plushthis", title: "PlushThis" },
  ];

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
        list.innerHTML = '<div class="empty">暂无文章，新建一篇吧！</div>';
        return;
      }
      list.innerHTML = posts.map((p) => \`
        <li class="list-item" onclick="editArticle('\${p.slug}')">
          <div class="info">
            <div class="title">\${p.draft ? '<span style="color:#f59e0b;">[草稿]</span> ' : ''}\${p.title || p.slug}</div>
            <div class="meta">
              \${p.date ? new Date(p.date).toLocaleDateString("zh-CN") : ""}
              \${p.tags && p.tags.length ? p.tags.map((t) => '<span class="tag">' + t + "</span>").join("") : ""}
            </div>
          </div>
          <div class="actions">
            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();editArticle('\${p.slug}')">编辑</button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();confirmDelete('\${p.slug}')">删除</button>
          </div>
        </li>
      \`).join("");
    } catch (e) {
      showToast("加载文章失败：" + e.message, true);
    }
  }

  function openArticleEditor(slug) {
    editingSlug = slug || null;
    document.getElementById("article-modal-title").textContent = slug ? "编辑文章" : "新建文章";
    document.getElementById("art-delete-btn").style.display = slug ? "" : "none";
    document.getElementById("art-save-btn").textContent = slug ? "更新" : "创建";

    if (!slug) {
      // Reset form
      document.getElementById("art-title").value = "";
      document.getElementById("art-slug").value = "";
      document.getElementById("art-desc").value = "";
      document.getElementById("art-date").value = new Date().toISOString().split("T")[0];
      document.getElementById("art-tags").value = "";
      document.getElementById("art-draft").checked = false;
      document.getElementById("art-body").value = "";
      document.getElementById("art-cover").value = "";
      document.getElementById("art-cover-preview").style.display = "none";
      document.getElementById("art-cover-img").src = "";
      document.getElementById("art-cover-name").textContent = "";
      document.getElementById("art-cover-remove").style.display = "none";
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
        const coverUrl = p.image || p.cover;
        if (coverUrl) {
          document.getElementById("art-cover").value = coverUrl;
          document.getElementById("art-cover-img").src = coverUrl;
          document.getElementById("art-cover-preview").style.display = "block";
          document.getElementById("art-cover-name").textContent = coverUrl.split("/").pop();
          document.getElementById("art-cover-remove").style.display = "";
        } else {
          document.getElementById("art-cover").value = "";
          document.getElementById("art-cover-preview").style.display = "none";
          document.getElementById("art-cover-remove").style.display = "none";
        }
        openModal("article-modal");
      })
      .catch((e) => showToast("加载失败：" + e.message, true));
  }
  window.openArticleEditor = openArticleEditor;

  function editArticle(slug) { openArticleEditor(slug); }

  async function saveArticle() {
    const slug = editingSlug || document.getElementById("art-slug").value.trim();

    const cover = document.getElementById("art-cover").value.trim();
    const data = {
      title: document.getElementById("art-title").value.trim(),
      description: document.getElementById("art-desc").value.trim(),
      date: document.getElementById("art-date").value || new Date().toISOString().split("T")[0],
      tags: document.getElementById("art-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
      draft: document.getElementById("art-draft").checked,
      image: cover || undefined,
      body: document.getElementById("art-body").value,
    };

    if (!data.title) { showToast("请填写标题", true); return; }

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
        showToast(err.error || "保存失败", true);
        return;
      }

      showToast(editingSlug ? "文章已更新" : "文章已创建");
      closeModal("article-modal");
      loadArticles();

      // Refresh slug display
      if (!editingSlug) {
        const result = await res.json();
        document.getElementById("art-slug").value = result.slug;
      }
    } catch (e) {
      showToast("错误：" + e.message, true);
    }
  }

  function confirmDelete(slug) {
    if (!slug) { showToast("错误：文章标识为空", true); return; }
    if (confirm("确定删除此文章？此操作不可恢复。")) {
      fetch("/blog/" + encodeURIComponent(slug), { method: "DELETE" })
        .then((r) => r.json())
        .then(() => { showToast("已删除"); loadArticles(); })
        .catch((e) => showToast("错误：" + e.message, true));
    }
  }
  window.confirmDelete = confirmDelete;

  async function deleteArticle() {
    if (!editingSlug) return;
    if (confirm("确定删除「" + editingSlug + "」？")) {
      try {
        await fetch("/blog/" + encodeURIComponent(editingSlug), { method: "DELETE" });
        showToast("已删除");
        closeModal("article-modal");
        loadArticles();
      } catch (e) { showToast("错误：" + e.message, true); }
    }
  }

  // ─── Live preview in separate window ───
  window.savePreviewState = function () {
    const md = document.getElementById("art-body").value;
    const title = document.getElementById("art-title").value;
    const cover = document.getElementById("art-cover").value || "";
    localStorage.setItem("admin-preview-md", md);
    localStorage.setItem("admin-preview-title", title);
    localStorage.setItem("admin-preview-cover", cover);
  };

  window.openLivePreview = function () {
    savePreviewState();
    window.open("/preview", "lxsbest-preview", "width=900,height=700");
  };

  // ─── Cover image upload ───
  window.uploadCover = function (input) {
    const file = input.files[0];
    if (!file) return;
    const slug = document.getElementById("art-slug").value.trim() || "post";
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
          document.getElementById("art-cover").value = result.url;
          document.getElementById("art-cover-img").src = result.url;
          document.getElementById("art-cover-preview").style.display = "block";
          document.getElementById("art-cover-name").textContent = result.filename;
          document.getElementById("art-cover-remove").style.display = "";
          showToast("封面上传成功");
          savePreviewState();
        } else {
          showToast(result.error || "封面上传失败", true);
        }
      } catch (e) { showToast("错误：" + e.message, true); }
    };
    reader.readAsDataURL(file);
  };

  window.removeCover = function () {
    document.getElementById("art-cover").value = "";
    document.getElementById("art-cover-preview").style.display = "none";
    document.getElementById("art-cover-img").src = "";
    document.getElementById("art-cover-name").textContent = "";
    document.getElementById("art-cover-remove").style.display = "none";
    savePreviewState();
  };

  // Save preview state when modal opens (for editing existing articles)
  const origOpenArticle = openArticleEditor;
  window.openArticleEditor = function (slug) {
    origOpenArticle(slug);
    // Wait for form to populate, then save initial state
    setTimeout(savePreviewState, 300);
  };

  // Also save on title input (for preview page title)
  document.getElementById("art-title").addEventListener("input", savePreviewState);

  // Auto-slug from title
  document.getElementById("art-title").addEventListener("input", function() {
    if (!editingSlug) {
      document.getElementById("art-slug").value = this.value.toLowerCase().replace(/[^\\w\\s-]/g, "").replace(/[\\s_]+/g, "-").replace(/^-+|-+$/g, "");
    }
  });

  // ─── Image paste in article editor ───
  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
  }

  document.getElementById("art-body").addEventListener("paste", async function (e) {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const slug = document.getElementById("art-slug").value.trim();
        if (!slug) { showToast("请先填写标题再粘贴图片", true); return; }
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
              insertAtCursor(this, "\\n" + result.markdown.trim() + "\\n");
              showToast("图片已上传：" + result.filename);
              savePreviewState();
            } else {
              showToast(result.error || "上传失败", true);
            }
          } catch (e) { showToast("错误：" + e.message, true); }
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  });

  // ═══════════════════════════════════════════
  //  WORKS
  // ═══════════════════════════════════════════
  async function loadWorks() {
    const [q, hiddenSlugs] = await Promise.all([
      Promise.resolve(document.getElementById("works-search").value.trim()),
      fetch("/works/hidden").then(r => r.json()).catch(() => []),
    ]);
    const hiddenSet = new Set(hiddenSlugs);
    const url = "/works" + (q ? "?q=" + encodeURIComponent(q) : "");
    try {
      const res = await fetch(url);
      const works = await res.json();
      document.getElementById("nav-works-count").textContent = works.length;
      const list = document.getElementById("works-list");
      if (works.length === 0 && hiddenSlugs.length === 0) {
        list.innerHTML = '<div class="empty">暂无作品</div>';
        return;
      }
      // Visible works
      let html = works.map((w) => \`
        <li class="list-item" onclick="editWork('\${w.slug}')">
          <img class="res-thumb" src="\${w.cover || ''}" alt="" onerror="this.style.display='none'" />
          <div class="info">
            <div class="title">\${w.published === false ? '<span style="color:#f59e0b;">[草稿]</span> ' : ''}\${w.title || w.slug}</div>
            <div class="res-meta-chips">
              \${(w.tags || []).map(t => '<span class="tag">' + t + '</span>').join('')}
            </div>
            <div class="meta">\${w.siteUrl || ''}</div>
          </div>
          <div class="actions">
            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();editWork('\${w.slug}')">编辑</button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();confirmDeleteWork('\${w.slug}')">删除</button>
          </div>
        </li>
      \`).join("");
      // Hidden built-in works section
      if (hiddenSlugs.length > 0 && !q) {
        const hiddenWorks = hiddenSlugs.map(slug => {
          const bp = BUILTIN_PROJECTS.find(p => p.slug === slug);
          return bp || { slug, title: slug };
        });
        html += '<div style="margin-top:16px;padding:12px 16px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;">';
        html += '<div style="font-size:13px;font-weight:600;color:#dc2626;margin-bottom:8px;">已隐藏的作品（在网站上不会显示）</div>';
        html += hiddenWorks.map(w => \`
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #fee2e2;">
            <span style="font-size:13px;color:#6b7280;flex:1;">\${w.title || w.slug}</span>
            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();restoreWork('\${w.slug}')">恢复显示</button>
          </div>
        \`).join("");
        html += '</div>';
      }
      list.innerHTML = html;
    } catch (e) { showToast("加载作品失败", true); }
  }

  async function restoreWork(slug) {
    const hidden = await fetch("/works/hidden").then(r => r.json()).catch(() => []);
    const updated = hidden.filter(s => s !== slug);
    const res = await fetch("/works/hidden", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs: updated }),
    });
    if (res.ok) { showToast("已恢复显示"); loadWorks(); }
    else { showToast("操作失败", true); }
  }
  window.restoreWork = restoreWork;

  function editWork(slug) {
    editingWork = slug;
    document.getElementById("work-modal-title").textContent = "编辑作品";
    document.getElementById("work-save-btn").textContent = "更新";
    document.getElementById("work-delete-btn").style.display = "";
    fetch("/works/" + encodeURIComponent(slug))
      .then((r) => r.json())
      .then((w) => {
        document.getElementById("work-title").value = w.title || "";
        document.getElementById("work-slug").value = w.slug || "";
        document.getElementById("work-tags").value = (w.tags || []).join(", ");
        document.getElementById("work-desc").value = w.description || "";
        document.getElementById("work-siteurl").value = w.siteUrl || "";
        document.getElementById("work-published").checked = w.published !== false;
        if (w.cover) {
          document.getElementById("work-cover-preview-img").src = w.cover;
          document.getElementById("work-cover-preview").style.display = "block";
          document.getElementById("work-cover-name").textContent = w.cover.split("/").pop();
        } else {
          document.getElementById("work-cover-preview").style.display = "none";
          document.getElementById("work-cover-name").textContent = "";
        }
        document.getElementById("work-cover-input").value = "";
        openModal("work-modal");
        saveWorkPreviewState();
      })
      .catch((e) => showToast("加载失败：" + e.message, true));
  }
  window.editWork = editWork;

  function openWorkForm(slug) {
    if (slug) { editWork(slug); return; }
    editingWork = null;
    document.getElementById("work-modal-title").textContent = "添加作品";
    document.getElementById("work-slug").value = "";
    document.getElementById("work-title").value = "";
    document.getElementById("work-tags").value = "";
    document.getElementById("work-desc").value = "";
    document.getElementById("work-siteurl").value = "";
    document.getElementById("work-published").checked = true;
    document.getElementById("work-cover-preview").style.display = "none";
    document.getElementById("work-cover-name").textContent = "";
    document.getElementById("work-cover-input").value = "";
    document.getElementById("work-save-btn").textContent = "添加作品";
    document.getElementById("work-delete-btn").style.display = "none";
    openModal("work-modal");
  }
  window.openWorkForm = openWorkForm;

  async function saveWork() {
    const title = document.getElementById("work-title").value.trim();
    if (!title) { showToast("请填写标题", true); return; }

    const data = {
      title,
      slug: document.getElementById("work-slug").value.trim(),
      tags: document.getElementById("work-tags").value.split(",").map(t => t.trim()).filter(Boolean),
      description: document.getElementById("work-desc").value.trim(),
      siteUrl: document.getElementById("work-siteurl").value.trim(),
      published: document.getElementById("work-published").checked,
    };

    const coverFile = document.getElementById("work-cover-input").files[0];
    if (coverFile) {
      data.coverData = await fileToBase64(coverFile);
    }

    try {
      let res;
      if (editingWork) {
        res = await fetch("/works/" + encodeURIComponent(editingWork), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        res = await fetch("/works", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      if (res.ok) {
        showToast(editingWork ? "作品已更新" : "作品已添加");
        closeModal("work-modal");
        loadWorks();
      } else {
        const err = await res.json();
        showToast(err.error || "操作失败", true);
      }
    } catch (e) { showToast("错误：" + e.message, true); }
  }

  function confirmDeleteWork(slug) {
    if (!slug) return;
    if (!confirm("确定删除作品「" + slug + "」？此操作不可恢复。")) return;
    deleteWork(slug);
  }
  window.confirmDeleteWork = confirmDeleteWork;

  async function deleteWork(slug) {
    if (!slug) return;
    try {
      await fetch("/works/" + encodeURIComponent(slug), { method: "DELETE" });
      showToast("已删除");
      closeModal("work-modal");
      editingWork = null;
      loadWorks();
    } catch (e) { showToast("错误：" + e.message, true); }
  }

  function autoSlugWork() {
    if (editingWork) return;
    const title = document.getElementById("work-title").value.trim();
    const slug = title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");
    document.getElementById("work-slug").value = slug;
  }

  window.previewWorkCover = function (input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById("work-cover-preview-img").src = reader.result;
      document.getElementById("work-cover-preview").style.display = "block";
      document.getElementById("work-cover-name").textContent = file.name;
      saveWorkPreviewState();
    };
    reader.readAsDataURL(file);
  };

  // ─── Work preview state ───
  window.saveWorkPreviewState = function () {
    const data = {
      title: document.getElementById("work-title").value.trim(),
      description: document.getElementById("work-desc").value.trim(),
      tags: document.getElementById("work-tags").value.split(",").map(t => t.trim()).filter(Boolean),
      siteUrl: document.getElementById("work-siteurl").value.trim(),
      published: document.getElementById("work-published").checked,
      cover: "",
    };
    const coverImg = document.getElementById("work-cover-preview-img");
    if (coverImg.src && coverImg.src !== window.location.href) {
      data.cover = coverImg.src;
    }
    localStorage.setItem("admin-preview-work", JSON.stringify(data));
  };

  window.openWorkLivePreview = function () {
    saveWorkPreviewState();
    window.open("/preview-work", "lxsbest-work-preview", "width=900,height=700");
  };

  // Work form input listeners
  document.getElementById("work-title").addEventListener("input", function() {
    autoSlugWork();
    saveWorkPreviewState();
  });
  document.getElementById("work-desc").addEventListener("input", saveWorkPreviewState);
  document.getElementById("work-tags").addEventListener("input", saveWorkPreviewState);
  document.getElementById("work-siteurl").addEventListener("input", saveWorkPreviewState);
  document.getElementById("work-published").addEventListener("change", saveWorkPreviewState);

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
        list.innerHTML = '<div class="empty">暂无资源</div>';
        return;
      }
      list.innerHTML = resources.map((r) => \`
        <li class="list-item" onclick="editResource('\${r.slug}')">
          <img class="res-thumb" src="\${r.cover || ''}" alt="" onerror="this.style.display='none'" />
          <div class="info">
            <div class="title">\${r.title || r.slug}</div>
            <div class="res-meta-chips">
              <span class="tag tag-\${r.typeTag?.color || 'purple'}">\${r.typeTag?.label || ''}</span>
              <span class="tag tag-\${r.priceTag?.color || 'amber'}">\${r.priceTag?.label || ''}</span>
            </div>
            <div class="meta">\${r.fileType || ''} \${r.fileSize ? '· ' + r.fileSize : ''}</div>
          </div>
          <div class="actions">
            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();editResource('\${r.slug}')">编辑</button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();confirmDeleteRes('\${r.slug}')">删除</button>
          </div>
        </li>
      \`).join("");
    } catch (e) { showToast("加载资源失败", true); }
  }

  function editResource(slug) {
    editingRes = slug;
    document.getElementById("resource-modal-title").textContent = "编辑资源";
    document.getElementById("res-save-btn").textContent = "更新";
    document.getElementById("res-delete-btn").style.display = "";
    fetch("/resources/" + encodeURIComponent(slug))
      .then((r) => r.json())
      .then((r) => {
        document.getElementById("res-title").value = r.title || "";
        document.getElementById("res-slug").value = r.slug || "";
        document.getElementById("res-desc").value = r.description || "";
        document.getElementById("res-filetype").value = r.fileType || "ZIP";
        document.getElementById("res-filesize").value = r.fileSize || "";
        document.getElementById("res-price").value = (r.priceTag?.label === "Free") ? "free" : "pay";
        document.getElementById("res-category").value = r.category || "ai-dev";
        document.getElementById("res-cover").value = "";
        document.getElementById("res-file").value = "";
        // Show existing cover in preview
        const resPrevDiv = document.getElementById("res-cover-preview");
        const resPrevImg = document.getElementById("res-cover-preview-img");
        if (r.cover) {
          resPrevImg.src = r.cover;
          resPrevDiv.style.display = "";
        } else {
          resPrevDiv.style.display = "none";
          resPrevImg.src = "";
        }
        openModal("resource-modal");
        saveResourcePreviewState();
      })
      .catch((e) => showToast("加载失败：" + e.message, true));
  }
  window.editResource = editResource;

  function openResourceForm(slug) {
    if (slug) { editResource(slug); return; }
    editingRes = null;
    document.getElementById("resource-modal-title").textContent = "添加资源";
    document.getElementById("res-slug").value = "";
    document.getElementById("res-title").value = "";
    document.getElementById("res-desc").value = "";
    document.getElementById("res-filesize").value = "";
    document.getElementById("res-filetype").value = "ZIP";
    document.getElementById("res-price").value = "pay";
    document.getElementById("res-category").value = "ai-dev";
    document.getElementById("res-cover").value = "";
    document.getElementById("res-file").value = "";
    document.getElementById("res-cover-preview").style.display = "none";
    document.getElementById("res-cover-preview-img").src = "";
    document.getElementById("res-cover-name").textContent = "";
    document.getElementById("res-save-btn").textContent = "添加资源";
    document.getElementById("res-delete-btn").style.display = "none";
    openModal("resource-modal");
  }
  window.openResourceForm = openResourceForm;

  async function saveResource() {
    const title = document.getElementById("res-title").value.trim();
    if (!title) { showToast("请填写标题", true); return; }

    const data = {
      title,
      description: document.getElementById("res-desc").value.trim(),
      fileType: document.getElementById("res-filetype").value,
      fileSize: document.getElementById("res-filesize").value.trim(),
      isFree: document.getElementById("res-price").value === "free",
      category: document.getElementById("res-category").value,
    };

    const coverFile = document.getElementById("res-cover").files[0];
    if (coverFile) {
      data.coverData = await fileToBase64(coverFile);
    }

    const dlFile = document.getElementById("res-file").files[0];
    if (dlFile) {
      data.fileData = await fileToBase64(dlFile);
      data.fileExt = pathExt(dlFile.name);
    }

    try {
      let res;
      if (editingRes) {
        res = await fetch("/resources/" + encodeURIComponent(editingRes), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        res = await fetch("/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      if (res.ok) {
        showToast(editingRes ? "资源已更新" : "资源已添加");
        closeModal("resource-modal");
        loadResources();
      } else {
        const err = await res.json();
        showToast(err.error || "操作失败", true);
      }
    } catch (e) { showToast("错误：" + e.message, true); }
  }

  function confirmDeleteRes(slug) {
    if (!slug) return;
    if (!confirm("确定删除资源「" + slug + "」？此操作不可恢复。")) return;
    deleteResource(slug);
  }
  window.confirmDeleteRes = confirmDeleteRes;

  function deleteResource(slug) {
    if (!slug) return;
    if (!confirm("确定删除资源「" + slug + "」？")) return;
    fetch("/resources/" + encodeURIComponent(slug), { method: "DELETE" })
      .then((r) => r.json())
      .then(() => {
        showToast("已删除");
        closeModal("resource-modal");
        editingRes = null;
        loadResources();
      })
      .catch((e) => showToast("错误：" + e.message, true));
  }

  function autoSlugRes() {
    if (editingRes) return;
    const title = document.getElementById("res-title").value.trim();
    const slug = "en-" + title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");
    document.getElementById("res-slug").value = slug;
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

  // ─── Resource cover preview ───
  window.previewResourceCover = function (input) {
    const file = input.files && input.files[0];
    const previewDiv = document.getElementById("res-cover-preview");
    const previewImg = document.getElementById("res-cover-preview-img");
    const nameSpan = document.getElementById("res-cover-name");
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        previewImg.src = e.target.result;
        previewDiv.style.display = "";
        nameSpan.textContent = file.name;
        saveResourcePreviewState();
      };
      reader.readAsDataURL(file);
    } else {
      previewDiv.style.display = "none";
      previewImg.src = "";
      nameSpan.textContent = "";
    }
  };

  // ─── Resource preview state ───
  window.saveResourcePreviewState = function () {
    const data = {
      title: document.getElementById("res-title").value.trim(),
      description: document.getElementById("res-desc").value.trim(),
      fileType: document.getElementById("res-filetype").value,
      fileSize: document.getElementById("res-filesize").value.trim(),
      isFree: document.getElementById("res-price").value === "free",
      category: document.getElementById("res-category").value,
      cover: "",
    };
    const coverImg = document.getElementById("res-cover-preview-img");
    if (coverImg.src && coverImg.src !== window.location.href) {
      data.cover = coverImg.src;
    }
    localStorage.setItem("admin-preview-resource", JSON.stringify(data));
  };

  window.openResourceLivePreview = function () {
    saveResourcePreviewState();
    window.open("/preview-resource", "lxsbest-resource-preview", "width=900,height=700");
  };

  // Resource preview input listeners
  document.getElementById("res-title").addEventListener("input", saveResourcePreviewState);
  document.getElementById("res-desc").addEventListener("input", saveResourcePreviewState);
  document.getElementById("res-filesize").addEventListener("input", saveResourcePreviewState);
  document.getElementById("res-filetype").addEventListener("change", saveResourcePreviewState);
  document.getElementById("res-price").addEventListener("change", saveResourcePreviewState);
  document.getElementById("res-category").addEventListener("change", saveResourcePreviewState);

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
  loadWorks();
  loadResources();
</script>
</body>
</html>`;
}

// ══════════════════════════════════════════════════
//  Live Preview Page
// ══════════════════════════════════════════════════
function getPreviewHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>实时预览 - LXSBest</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", Roboto, sans-serif;
    background: #fff; color: #1a2332; padding: 40px 20px;
    display: flex; justify-content: center;
  }
  .container { max-width: 720px; width: 100%; }
  .header { margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .header h1 { font-size: 15px; color: #64748b; font-weight: 400; }
  .header .badge { background: #22c55e; color: #fff; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .header .badge.paused { background: #f59e0b; }
  .header button { margin-left: auto; padding: 4px 12px; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; font-size: 12px; color: #64748b; }
  .header button:hover { background: #f1f5f9; }
  #cover { width: 100%; border-radius: 12px; margin-bottom: 24px; display: none; box-shadow: 0 2px 12px rgba(0,0,0,.08); aspect-ratio: 1200/630; object-fit: cover; background: #f1f5f9; }
  #title { font-size: 28px; font-weight: 700; line-height: 1.3; margin-bottom: 8px; color: #1a2332; }
  #meta { font-size: 13px; color: #94a3b8; margin-bottom: 28px; }
  #content { font-size: 15px; line-height: 1.8; color: #334155; }
  #content h1, #content h2, #content h3 { margin-top: 1.5em; margin-bottom: .6em; color: #1a2332; font-weight: 700; }
  #content h1 { font-size: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
  #content h2 { font-size: 20px; }
  #content h3 { font-size: 16px; }
  #content p { margin-bottom: 1em; }
  #content ul, #content ol { padding-left: 1.5em; margin-bottom: 1em; }
  #content li { margin-bottom: .3em; }
  #content a { color: #2d6dc3; text-decoration: none; }
  #content a:hover { text-decoration: underline; }
  #content code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
  #content pre { background: #1a2332; color: #e2e8f0; padding: 20px; border-radius: 10px; overflow-x: auto; margin-bottom: 1.2em; font-size: 13px; line-height: 1.6; }
  #content pre code { background: none; padding: 0; color: inherit; }
  #content blockquote { border-left: 4px solid #2d6dc3; padding: 4px 16px; color: #64748b; margin-bottom: 1em; background: #f8fafc; border-radius: 0 6px 6px 0; }
  #content img { max-width: 100%; border-radius: 10px; margin: 1.2em 0; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
  #content hr { border: none; border-top: 1px solid #e2e8f0; margin: 2em 0; }
  #content table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }
  #content th, #content td { border: 1px solid #e2e8f0; padding: 10px 14px; text-align: left; font-size: 14px; }
  #content th { background: #f8fafc; font-weight: 600; }
  #empty-state { text-align: center; padding: 80px 20px; color: #94a3b8; }
  #empty-state p { font-size: 16px; }
  #empty-state .hint { font-size: 13px; margin-top: 8px; }
  #status-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1a2332; color: #94a3b8; padding: 8px 20px; font-size: 12px; display: flex; gap: 16px; align-items: center; }
  #status-bar .dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; display: inline-block; }
  #status-bar .key { color: #e2e8f0; }
  @media (prefers-color-scheme: dark) {
    body { background: #0f172a; color: #e2e8f0; }
    #title { color: #f1f5f9; }
    #content { color: #cbd5e1; }
    #content h1, #content h2, #content h3 { color: #f1f5f9; }
    #content h1 { border-bottom-color: #1e293b; }
    #content a { color: #60a5fa; }
    #content code { background: #1e293b; }
    #content pre { background: #020617; }
    #content blockquote { background: #1e293b; border-left-color: #60a5fa; color: #94a3b8; }
    #cover { box-shadow: 0 2px 12px rgba(0,0,0,.3); background: #1e293b; }
    #content img { box-shadow: 0 2px 12px rgba(0,0,0,.3); }
    #content th, #content td { border-color: #1e293b; }
    #content th { background: #1e293b; }
    .header { border-bottom-color: #1e293b; }
    .header h1 { color: #64748b; }
    #status-bar { background: #020617; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>LXSBest 实时预览</h1>
    <span class="badge" id="live-badge">● 实时</span>
    <button onclick="togglePause()" id="pause-btn">暂停</button>
  </div>
  <img id="cover" alt="封面图" />
  <div id="title"></div>
  <div id="meta"></div>
  <div id="content"></div>
  <div id="empty-state">
    <p>等待编辑内容...</p>
    <div class="hint">在管理后台编辑器中输入内容，将实时显示在此页面</div>
  </div>
</div>
<div id="status-bar">
  <span class="dot"></span>
  <span>实时同步中</span>
  <span style="margin-left:auto;">快捷键: <span class="key">Ctrl+S</span> 刷新预览</span>
</div>

<script>
  let paused = false;

  function renderPreview() {
    const md = localStorage.getItem("admin-preview-md") || "";
    const title = localStorage.getItem("admin-preview-title") || "";
    const cover = localStorage.getItem("admin-preview-cover") || "";
    const emptyEl = document.getElementById("empty-state");
    const coverEl = document.getElementById("cover");
    const titleEl = document.getElementById("title");
    const metaEl = document.getElementById("meta");
    const contentEl = document.getElementById("content");

    if (!md.trim() && !title.trim()) {
      emptyEl.style.display = "block";
      coverEl.style.display = "none";
      titleEl.style.display = "none";
      metaEl.style.display = "none";
      contentEl.style.display = "none";
      return;
    }

    emptyEl.style.display = "none";
    if (cover) {
      coverEl.src = cover;
      coverEl.style.display = "block";
    } else {
      coverEl.style.display = "none";
    }
    titleEl.style.display = "block";
    metaEl.style.display = "block";
    contentEl.style.display = "block";

    titleEl.textContent = title;
    metaEl.textContent = new Date().toLocaleDateString("zh-CN", {
      year: "numeric", month: "long", day: "numeric"
    });

    try {
      contentEl.innerHTML = marked.parse(md);
    } catch {
      contentEl.innerHTML = marked(md);
    }

    // Update page title
    document.title = (title || "实时预览") + " - LXSBest";
  }

  function togglePause() {
    paused = !paused;
    document.getElementById("live-badge").className = "badge" + (paused ? " paused" : "");
    document.getElementById("live-badge").textContent = paused ? "⏸ 已暂停" : "● 实时";
    document.getElementById("pause-btn").textContent = paused ? "恢复" : "暂停";
    if (!paused) renderPreview();
  }

  // Listen for storage changes from other tabs
  window.addEventListener("storage", (e) => {
    if ((e.key === "admin-preview-md" || e.key === "admin-preview-title") && !paused) {
      renderPreview();
    }
  });

  // Also poll every 500ms as fallback
  let lastMd = "";
  let lastTitle = "";
  let lastCover = "";
  setInterval(() => {
    if (paused) return;
    const md = localStorage.getItem("admin-preview-md") || "";
    const title = localStorage.getItem("admin-preview-title") || "";
    const cover = localStorage.getItem("admin-preview-cover") || "";
    if (md !== lastMd || title !== lastTitle || cover !== lastCover) {
      lastMd = md;
      lastTitle = title;
      lastCover = cover;
      renderPreview();
    }
  }, 500);

  // Initial render
  renderPreview();

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      renderPreview();
    }
    if (e.key === "Escape" && paused) togglePause();
  });
<\/script>
</body>
</html>`;
}

function getResourcePreviewHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>资源预览 - LXSBest</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0f2f5; color: #1a2332; padding: 40px 16px; }
  .container { max-width: 800px; margin: 0 auto; }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
  .header h1 { font-size: 15px; color: #64748b; font-weight: 400; }
  .badge { background: #22c55e; color: #fff; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .badge.paused { background: #f59e0b; }
  .header button { margin-left: auto; padding: 4px 12px; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; font-size: 12px; color: #64748b; }
  .header button:hover { background: #f1f5f9; }
  .card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 8px rgba(0,0,0,.06); }
  .cover-wrapper { aspect-ratio: 21/9; overflow: hidden; background: #f1f5f9; }
  .cover-wrapper img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .body { padding: 32px; }
  .tags { display: flex; gap: 8px; margin-bottom: 16px; }
  .tag { display: inline-flex; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; }
  .tag-purple { background: #f3e8ff; color: #7c3aed; }
  .tag-amber { background: #fef3c7; color: #92400e; }
  .tag-green { background: #dcfce7; color: #166534; }
  h1.title { font-size: 24px; font-weight: 700; color: #1a2332; margin-bottom: 16px; line-height: 1.3; }
  .desc { color: #64748b; line-height: 1.7; margin-bottom: 24px; font-size: 15px; }
  .file-info { display: flex; gap: 12px; margin-bottom: 32px; flex-wrap: wrap; }
  .file-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 8px; background: #f1f5f9; font-size: 13px; color: #475569; }
  .divider { border-top: 1px dashed #e2e8f0; margin-bottom: 24px; }
  .dl-section { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
  .dl-section p { font-size: 14px; }
  .dl-section .sub { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  .dl-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; border-radius: 10px; background: #1a2332; color: #fff; font-size: 14px; border: none; cursor: default; }
  .empty { text-align: center; padding: 60px 20px; color: #94a3b8; }
  .empty .icon { font-size: 48px; margin-bottom: 12px; opacity: .4; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>LXSBest 资源预览</h1>
    <span class="badge" id="live-badge">● 实时</span>
    <button onclick="togglePause()" id="pause-btn">暂停</button>
  </div>
  <div class="card">
    <div class="cover-wrapper"><img id="cover" alt="封面" /></div>
    <div class="body">
      <div class="tags" id="tags"></div>
      <h1 class="title" id="title"></h1>
      <p class="desc" id="description"></p>
      <div class="file-info" id="file-info"></div>
      <div class="divider"></div>
      <div class="dl-section" id="dl-section"></div>
    </div>
  </div>
</div>
<script>
  let paused = false;
  function renderPreview() {
    try {
      const raw = localStorage.getItem("admin-preview-resource") || "{}";
      const d = JSON.parse(raw);
      const coverEl = document.getElementById("cover");
      const titleEl = document.getElementById("title");
      const descEl = document.getElementById("description");
      const tagsEl = document.getElementById("tags");
      const fileInfoEl = document.getElementById("file-info");
      const dlEl = document.getElementById("dl-section");

      if (!d.title) {
        coverEl.style.display = "none";
        document.querySelector(".body").innerHTML = '<div class="empty"><div class="icon">📦</div>在管理后台编辑资源，点击实时预览查看效果</div>';
        return;
      }
      coverEl.style.display = "";
      coverEl.src = d.cover || "";
      if (!d.cover) coverEl.style.display = "none";
      titleEl.textContent = d.title;
      descEl.textContent = d.description || "";
      const typeColor = d.fileType === "PDF" ? "green" : "purple";
      const priceColor = d.isFree ? "green" : "amber";
      const priceLabel = d.isFree ? "Free" : "Pay What You Want";
      tagsEl.innerHTML = '<span class="tag tag-' + typeColor + '">' + (d.category || "AI & Dev") + '</span><span class="tag tag-' + priceColor + '">' + priceLabel + '</span>';
      fileInfoEl.innerHTML = '<span class="file-badge">📄 ' + (d.fileType || "ZIP") + '</span><span class="file-badge">📦 ' + (d.fileSize || "-") + '</span>';
      dlEl.innerHTML = '<div><p>准备下载？</p><p class="sub">预览模式下不提供实际下载</p></div><div class="dl-btn">⬇ 下载 ' + (d.isFree ? "免费" : "") + '</div>';
      document.title = d.title + " - LXSBest 资源预览";
    } catch (e) { /* ignore parse errors */ }
  }
  function togglePause() {
    paused = !paused;
    document.getElementById("live-badge").className = "badge" + (paused ? " paused" : "");
    document.getElementById("live-badge").textContent = paused ? "⏸ 已暂停" : "● 实时";
    document.getElementById("pause-btn").textContent = paused ? "恢复" : "暂停";
    if (!paused) renderPreview();
  }
  window.addEventListener("storage", (e) => {
    if (e.key === "admin-preview-resource" && !paused) renderPreview();
  });
  let lastData = "";
  setInterval(() => {
    if (paused) return;
    const cur = localStorage.getItem("admin-preview-resource") || "";
    if (cur !== lastData) { lastData = cur; renderPreview(); }
  }, 500);
  renderPreview();
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); renderPreview(); }
    if (e.key === "Escape" && paused) togglePause();
  });
<\/script>
</body>
</html>`;
}

function getWorkPreviewHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>作品预览 - LXSBest</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0f2f5; color: #1a2332; padding: 40px 16px; }
  .container { max-width: 800px; margin: 0 auto; }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
  .header h1 { font-size: 15px; color: #64748b; font-weight: 400; }
  .badge { background: #22c55e; color: #fff; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .badge.paused { background: #f59e0b; }
  .header button { margin-left: auto; padding: 4px 12px; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; font-size: 12px; color: #64748b; }
  .header button:hover { background: #f1f5f9; }
  .card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 8px rgba(0,0,0,.06); }
  .cover-wrapper { aspect-ratio: 21/9; overflow: hidden; background: #f1f5f9; cursor: pointer; position: relative; }
  .cover-wrapper img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cover-wrapper .visit-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .2s; color: #fff; font-size: 15px; font-weight: 600; }
  .cover-wrapper:hover .visit-overlay { opacity: 1; }
  .body { padding: 32px; }
  .tags { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .tag { display: inline-flex; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; background: #eef4ff; color: #2d6dc3; }
  h1.title { font-size: 24px; font-weight: 700; color: #1a2332; margin-bottom: 16px; line-height: 1.3; }
  .desc { color: #64748b; line-height: 1.7; margin-bottom: 24px; font-size: 15px; }
  .status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; margin-bottom: 20px; }
  .status-published { background: #dcfce7; color: #166534; }
  .status-draft { background: #fef3c7; color: #92400e; }
  .divider { border-top: 1px dashed #e2e8f0; margin-bottom: 24px; }
  .site-section { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
  .site-section p { font-size: 14px; color: #475569; }
  .site-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; border-radius: 10px; background: #1a2332; color: #fff; font-size: 14px; border: none; cursor: pointer; text-decoration: none; }
  .site-btn:hover { background: #2a3545; }
  .empty { text-align: center; padding: 60px 20px; color: #94a3b8; }
  .empty .icon { font-size: 48px; margin-bottom: 12px; opacity: .4; }
  @media (prefers-color-scheme: dark) {
    body { background: #0f172a; color: #e2e8f0; }
    .card { background: #1e293b; }
    h1.title { color: #f1f5f9; }
    .desc { color: #94a3b8; }
    .header { border-bottom-color: #1e293b; }
    .divider { border-top-color: #334155; }
    .cover-wrapper { background: #1e293b; }
    .header h1 { color: #64748b; }
    .site-btn { background: #334155; }
    .site-section p { color: #94a3b8; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>LXSBest 作品预览</h1>
    <span class="badge" id="live-badge">● 实时</span>
    <button onclick="togglePause()" id="pause-btn">暂停</button>
  </div>
  <div class="card">
    <div class="cover-wrapper" id="cover-wrapper" onclick="visitSite()">
      <img id="cover" alt="封面" />
      <div class="visit-overlay" id="visit-overlay">🌐 访问站点</div>
    </div>
    <div class="body">
      <div class="tags" id="tags"></div>
      <div class="status-badge" id="status-badge"></div>
      <h1 class="title" id="title"></h1>
      <p class="desc" id="description"></p>
      <div class="divider"></div>
      <div class="site-section" id="site-section"></div>
    </div>
  </div>
</div>
<script>
  let paused = false;
  let siteUrl = "";

  function renderPreview() {
    try {
      const raw = localStorage.getItem("admin-preview-work") || "{}";
      const d = JSON.parse(raw);
      const coverEl = document.getElementById("cover");
      const titleEl = document.getElementById("title");
      const descEl = document.getElementById("description");
      const tagsEl = document.getElementById("tags");
      const siteSection = document.getElementById("site-section");
      const statusBadge = document.getElementById("status-badge");
      const coverWrapper = document.getElementById("cover-wrapper");

      if (!d.title) {
        coverEl.style.display = "none";
        document.querySelector(".body").innerHTML = '<div class="empty"><div class="icon">🖼️</div>在管理后台编辑作品，点击实时预览查看效果</div>';
        coverWrapper.style.cursor = "default";
        return;
      }
      coverEl.style.display = "";
      coverWrapper.style.cursor = "pointer";
      coverEl.src = d.cover || "";
      if (!d.cover) { coverEl.style.display = "none"; }
      titleEl.textContent = d.title;
      descEl.textContent = d.description || "";
      tagsEl.innerHTML = (d.tags || []).map(t => '<span class="tag">' + t + '</span>').join("");
      siteUrl = d.siteUrl || "";
      statusBadge.textContent = d.published ? "✅ 已发布" : "⏸ 草稿";
      statusBadge.className = "status-badge " + (d.published ? "status-published" : "status-draft");

      if (siteUrl) {
        siteSection.innerHTML = '<p>🔗 <a href="' + siteUrl + '" target="_blank" style="color:#2d6dc3;">' + siteUrl + '</a></p><a class="site-btn" href="' + siteUrl + '" target="_blank">🌐 访问站点</a>';
      } else {
        siteSection.innerHTML = '<p style="color:#94a3b8;">未设置站点链接</p>';
      }
      document.title = d.title + " - LXSBest 作品预览";
    } catch (e) { /* ignore */ }
  }

  window.visitSite = function () {
    if (siteUrl) window.open(siteUrl, "_blank");
  };

  function togglePause() {
    paused = !paused;
    document.getElementById("live-badge").className = "badge" + (paused ? " paused" : "");
    document.getElementById("live-badge").textContent = paused ? "⏸ 已暂停" : "● 实时";
    document.getElementById("pause-btn").textContent = paused ? "恢复" : "暂停";
    if (!paused) renderPreview();
  }

  window.addEventListener("storage", (e) => {
    if (e.key === "admin-preview-work" && !paused) renderPreview();
  });

  let lastData = "";
  setInterval(() => {
    if (paused) return;
    const cur = localStorage.getItem("admin-preview-work") || "";
    if (cur !== lastData) { lastData = cur; renderPreview(); }
  }, 500);

  renderPreview();
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); renderPreview(); }
    if (e.key === "Escape" && paused) togglePause();
  });
<\/script>
</body>
</html>`;
}

// ─── Start ────────────────────────────────────────
if (!fs.existsSync(WORKS_JSON)) {
  fs.mkdirSync(path.dirname(WORKS_JSON), { recursive: true });
  fs.writeFileSync(WORKS_JSON, "[]", "utf8");
}
const server = http.createServer(router);
server.listen(PORT, () => {
  console.log(`\n  ✦ LXSBest Admin Server`);
  console.log(`  ─────────────────────`);
  console.log(`  Admin UI : http://localhost:${PORT}`);
  console.log(`  Site     : http://localhost:4326`);
  console.log(`\n  Articles, Images, Resources — all in one place.\n`);
});
