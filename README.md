# Intern Radar

One easy-to-scan site of internships and related opportunities for MIT and college students.

**Live:** https://akuang50.github.io/intern-radar/

Public Greenhouse, Lever, and Ashby boards plus public MIT/MISTI/CAPD/REU pages refresh twice a day via GitHub Actions (`01:00` and `13:00` UTC). The dashboard is a static GitHub Pages app; listings live in `public/data/listings.json`.

## Handshake / MISTI

Those portals require login. This project will **not** sign in, store cookies, or scrape behind SSO.

- Paste JSON/CSV in the site (stored in this browser)
- Or drop an export in `data/uploads/` so the next scheduled ingest merges it

## Local

```bash
npm install
npm run ingest
npm run dev
```

Production base path is `/intern-radar/`.
