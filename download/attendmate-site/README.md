# AttendMate Pro — Website

A fully static, serverless website for **AttendMate Pro**, the unofficial attendance
tracker built for NSMCH Bihta · Phase-III (Part-2) · Batch 2023 · Session 2026–27.
No build step, no backend, no network calls — every page works straight off the disk.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Homepage — hero, highlights, screenshots, CTA |
| `features.html` | Every feature in depth + portal comparison |
| `how-it-works.html` | Step-by-step daily-usage guide |
| `roster.html` | Interactive roll-number lookup + all official posting roster tables |
| `faq.html` | Frequently asked questions |
| `about.html` | Project background, principles, disclaimer |
| `app.html` | The dashboard itself (self-contained, inline CSS/JS) |
| `404.html` | Not-found page for static hosts |

## Assets

- `css/style.css` — shared design system (light + dark tokens)
- `js/site.js` — theme, mobile nav, reveal animations, roster data + resolver
- `assets/favicon.svg`, `manifest.webmanifest`, `robots.txt`
- `assets/screenshots/*.png` — dashboard screenshots captured with demo data

## Run locally

Open `index.html` in a browser, or serve the folder:

```
cd attendmate-site
python -m http.server 8080
# → http://localhost:8080
```

## Deploy

Any static host works (GitHub Pages, Netlify, Cloudflare Pages, Vercel static):
upload the folder as-is. For GitHub Pages, keep `404.html` at the root.
After you have a real domain, add a `sitemap.xml` and reference it in `robots.txt`.

## Notes

- Theme is shared between the site and the dashboard via `localStorage`.
- The posting rosters embedded in `js/site.js` and `app.html` are the official
  Phase-III (Part-2) schedule; verify changed dates with the college.
- Screenshots contain **demo data**, not any real student's record.
