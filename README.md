# public-pages

My projects, published with GitHub Pages. The home page lists every project automatically.

## How it works

- Every top-level folder with an `index.html` is a project, served at `/<folder>/`.
- On every push to `main`, `.github/workflows/pages.yml` runs `scripts/build-site.mjs`, which copies the project folders into `_site/`, generates the landing page (`_site/index.html`) with one card per folder, and deploys it to GitHub Pages.
- Pushes from other repos (for example kids-games publishing its build into `kids-games/`) trigger the same deploy, so the site is always up to date.

## Adding a project

1. Add a folder with an `index.html` (the built app, with relative paths).
2. Optionally give it a title, description, emoji icon, tags and position in `projects.json`. Without an entry, the card uses the page's own `<title>` and `<meta name="description">`.
3. Push. It appears on the home page a minute later.

To keep a project online but off the list, set `"hidden": true` for it in `projects.json`.

## Preview locally

```sh
node scripts/build-site.mjs
npx serve _site   # or open _site/index.html
```

## One-time setup

**Settings → Pages → Build and deployment → Source: GitHub Actions.** (Before this change Pages served the `docs` folder.)
