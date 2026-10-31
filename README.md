# public-pages

My projects, published with GitHub Pages at `https://julientru.github.io/public-pages/`.

## How it works

- The root `index.html` is the landing page: one card per project.
- Each project is deployed into its own top-level folder by its own repo (for example kids-games publishes its build into `kids-games/`), and is served at `/public-pages/<folder>/`. This repo holds no project sources and copies nothing around.
- On every push to `main`, including those deploys, `.github/workflows/landing.yml` runs `scripts/build-landing.mjs`. It lists every top-level folder with an `index.html`, rewrites `index.html`, and commits it only if it changed.

## Adding a project

1. Have the project deploy its built files (with relative paths) into a new folder here.
2. Optionally give it a title, description, emoji icon, tags and position in `projects.json`. Without an entry, the card uses the page's own `<title>` and `<meta name="description">`.
3. The landing page picks it up on that push.

To keep a project online but off the list, set `"hidden": true` for it in `projects.json`.

## Preview locally

```sh
node scripts/build-landing.mjs   # then open index.html
```

## One-time setup

**Settings → Pages → Build and deployment:** Source *Deploy from a branch*, branch `main`, folder `/ (root)`. (Before this change it served the `docs` folder.)
