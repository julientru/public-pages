// Builds the published site into ./_site: every project folder as it is, plus a generated
// landing page (index.html) with one card per project.
//
// A project is any top-level folder with an index.html in it. Nothing has to be registered:
// add a folder, push, and it shows up. projects.json can give a folder a nicer title,
// description, icon, tags and position, or leave it off the list (it stays online at its URL). Without an entry, the card uses the
// folder's own <title> and <meta name="description">.
//
// No dependencies. Run it locally with: node scripts/build-site.mjs  (then open _site/index.html)
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "_site");
// Top-level folders that are never projects.
const SKIP = new Set(["_site", "scripts", "node_modules"]);

const config = existsSync(join(ROOT, "projects.json"))
  ? JSON.parse(readFileSync(join(ROOT, "projects.json"), "utf8"))
  : {};
const site = { title: "Projects", intro: "", ...config.site };
const overrides = config.projects || {};

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

// "ai-financial-advisor" -> "Ai Financial Advisor"
const prettify = (name) => name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function readMeta(html) {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const description =
    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i)?.[1];
  return { title: title && decode(title), description: description && decode(description) };
}

const all = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !SKIP.has(d.name))
  .filter((d) => existsSync(join(ROOT, d.name, "index.html")))
  .map((d) => {
    const meta = readMeta(readFileSync(join(ROOT, d.name, "index.html"), "utf8"));
    const o = overrides[d.name] || {};
    return {
      folder: d.name,
      title: o.title || meta.title || prettify(d.name),
      description: o.description || meta.description || "",
      icon: o.icon || "✨",
      tags: o.tags || [],
      order: o.order ?? Infinity,
      hidden: o.hidden === true,
    };
  });
// Hidden projects are still published at their URL, just not listed.
const projects = all
  .filter((p) => !p.hidden)
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

// A stable hue per folder, so each card keeps its colour between builds.
const hue = (name) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const cards = projects
  .map(
    (p) => `
      <li>
        <a class="card" href="${escape(p.folder)}/" style="--hue:${hue(p.folder)}">
          <span class="icon" aria-hidden="true">${escape(p.icon)}</span>
          <span class="body">
            <span class="name">${escape(p.title)}</span>
            ${p.description ? `<span class="desc">${escape(p.description)}</span>` : ""}
            ${p.tags.length ? `<span class="tags">${p.tags.map((t) => `<span>${escape(t)}</span>`).join("")}</span>` : ""}
          </span>
          <span class="open" aria-hidden="true">Open →</span>
        </a>
      </li>`,
  )
  .join("");

const year = new Date().getFullYear();
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(site.title)}</title>
<meta name="description" content="${escape(site.intro)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✨</text></svg>">
<style>
  :root {
    --bg: #f6f5f1;
    --surface: #ffffff;
    --text: #17181c;
    --muted: #5d6170;
    --line: #e3e1da;
    --tag: #efede6;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #111216;
      --surface: #1a1c22;
      --text: #f1f1f3;
      --muted: #a2a6b4;
      --line: #2b2e37;
      --tag: #252831;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 960px; margin: 0 auto; padding: 72px 20px 48px; }
  header { margin-bottom: 44px; }
  h1 {
    margin: 0 0 12px;
    font-size: clamp(32px, 6vw, 48px);
    line-height: 1.1;
    letter-spacing: -0.02em;
  }
  .intro { margin: 0; max-width: 560px; color: var(--muted); font-size: 18px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
    color: inherit;
    text-decoration: none;
    overflow: hidden;
    transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
  }
  .card::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 4px;
    background: linear-gradient(90deg, hsl(var(--hue) 70% 55%), hsl(calc(var(--hue) + 40) 75% 60%));
  }
  .card:hover, .card:focus-visible {
    transform: translateY(-3px);
    border-color: hsl(var(--hue) 50% 60% / .6);
    box-shadow: 0 12px 32px -12px hsl(var(--hue) 60% 40% / .35);
    outline: none;
  }
  .icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 14px;
    font-size: 28px;
    background: hsl(var(--hue) 70% 55% / .14);
  }
  .body { display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .name { font-size: 20px; font-weight: 650; letter-spacing: -0.01em; }
  .desc { color: var(--muted); font-size: 15px; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .tags span { padding: 2px 10px; border-radius: 999px; background: var(--tag); color: var(--muted); font-size: 12.5px; }
  .open { font-weight: 600; font-size: 14px; color: hsl(var(--hue) 60% 45%); }
  @media (prefers-color-scheme: dark) { .open { color: hsl(var(--hue) 70% 70%); } }
  .empty { color: var(--muted); }
  footer { margin-top: 56px; color: var(--muted); font-size: 13px; }
  @media (prefers-reduced-motion: reduce) { .card { transition: none; } .card:hover { transform: none; } }
</style>
</head>
<body>
<main>
  <header>
    <h1>${escape(site.title)}</h1>
    ${site.intro ? `<p class="intro">${escape(site.intro)}</p>` : ""}
  </header>
  ${projects.length ? `<ul>${cards}\n  </ul>` : `<p class="empty">No projects yet.</p>`}
  <footer>${projects.length} project${projects.length === 1 ? "" : "s"} · © ${year}</footer>
</main>
</body>
</html>
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const p of all) cpSync(join(ROOT, p.folder), join(OUT, p.folder), { recursive: true });
writeFileSync(join(OUT, "index.html"), html);
writeFileSync(join(OUT, ".nojekyll"), "");
console.log(`Built _site with ${projects.length} projects: ${projects.map((p) => p.folder).join(", ")}`);
