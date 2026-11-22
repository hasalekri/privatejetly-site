# Private Jetly website

Static site for @privatejetly, hosted on Netlify.

- `index.html`: the whole website (pages: Home, News, Gulf Map, Stories, Rankings, About, Live Traffic). The daily news update edits the news lists and the `const GULF = ` map data in this file.
- `live/index.html`: live Gulf air-traffic map (data from adsb.lol, open data, ODbL).
- `_redirects`: Netlify proxy rules so the live map can load flight data and aircraft photos.
- `img/`: images.
