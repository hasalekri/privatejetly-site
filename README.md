# Private Jetly website

Static site for @privatejetly, hosted on Cloudflare Pages (no build step).

- `index.html`: the website (Home, News, Gulf Map, Stories, Rankings, About, Live Traffic).
- `data/news.html`, `data/gulf.json`: news and Gulf map data, updated automatically 4 times a day. The page loads them from GitHub.
- `live/index.html`: live Gulf air-traffic map (adsb.lol / airplanes.live open data), with Bahrain AIP waypoints, runways, stands and the OBBI chart.
- `functions/`: Cloudflare Pages Functions: `/api/traffic` (shared, cached Gulf traffic + path recording), `/api/flight` (recorded path for one aircraft), and proxies `/adsb/*`, `/alive/*`, `/photo/*`.
- Optional KV binding `TRACKS` (Pages project > Settings > Bindings) enables recorded flight paths.
