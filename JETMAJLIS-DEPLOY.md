# JetMajlis on Cloudflare Pages

The storefront is a static bilingual catalog. The product images are generated
concept mockups. The site has no order, checkout, or payment integration.

For the **jetmajlis.com** Pages project connected to this repository, use:

| Cloudflare Pages setting | Value |
| --- | --- |
| Framework preset | None |
| Root directory | Repository root |
| Build command | `node scripts/build-jetmajlis.mjs` |
| Build output directory | `dist-jetmajlis` |

The build publishes the JetMajlis homepage, its local assets and the existing
Cloudflare response headers. This configuration is scoped to the JetMajlis
project. Other projects linked to the repository retain their own build settings.

Enable preview builds for the review branch and check the Pages preview URL at
phone and desktop widths. Verify the UAE and Saudi front and back views first,
then scroll through Essentials and try the product filters. The production
domain can continue to use its existing Pages production branch.
