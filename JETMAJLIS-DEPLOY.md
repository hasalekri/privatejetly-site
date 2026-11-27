# JetMajlis on Cloudflare Pages

The homepage is a static, bilingual campaign with a browser-local basket and
order review. It has no order submission, payments, backend or
runtime dependencies. For the **jetmajlis.com** Pages project connected to this
repository, use these settings.

| Cloudflare Pages setting | Value |
| --- | --- |
| Framework preset | None |
| Root directory | Repository root |
| Build command | `node scripts/build-jetmajlis.mjs` |
| Build output directory | `dist-jetmajlis` |

Running the command locally stages the homepage, Cloudflare response headers,
and the self-hosted campaign images, fonts, CSS and JavaScript. A project serving
the repository root directly can also resolve the campaign assets from that root.
Other projects using this repository can keep their existing build settings.

The campaign uses the UAE Falcon and Saudi Desert T-shirt images from commit
`2519baa65979de3d0a430c3af443145ba9aaf03e`. The detail images are crops of those
original mockups. The cabin and overhead jet images are generated campaign visuals.
The display and Arabic font files reuse the repository's Cormorant Garamond
and IBM Plex Sans Arabic assets.

Before releasing, verify the Cloudflare preview at phone and desktop widths.
Scroll through the cabin sequence, switch the product views and open an enlarged
image, select the six GCC destinations, and check the Arabic layout and the
reduced-motion experience.
