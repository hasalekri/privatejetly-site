# JetMajlis on Cloudflare Pages

The bilingual campaign has a browser-local basket and uses optional Pages
Functions for accounts and no-charge preorder submissions. For the
**jetmajlis.com** Pages project, use these settings.

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

The six hoodie concepts use generated product mockups. Detail views are crops
of the corresponding images. The walkaround, boarding, and cabin are generated campaign visuals.
Hoodie backs use decorative airport-code graphics inspired by flight charts.
The display and Arabic font files reuse the repository's Cormorant Garamond
and IBM Plex Sans Arabic assets.

Before releasing, verify the Cloudflare preview at phone and desktop widths.
Scroll from the apron through the cabin into the collection, switch the product views and open an enlarged
image, select the six GCC destinations, and check the Arabic layout and the
reduced-motion experience.

## Enable accounts and no-charge preorders

1. In Cloudflare, create a D1 database for JetMajlis. Open its SQL console
   and run the statements in `db/preorders.sql`.
2. On the JetMajlis Pages project's production environment, add a D1 binding
   named `PREORDER_DB` pointing to that database. Keep the project root set to
   the repository root so Pages can deploy the `functions/` directory.
3. In Google Cloud, create a Web application OAuth client with
   `https://jetmajlis.com/api/callback` as an authorized redirect URI. Configure
   the consent screen for the intended customers and publish it when ready.
   Set `GOOGLE_CLIENT_ID` and the secret `GOOGLE_CLIENT_SECRET` on the Pages
   production environment. Enter the secret in Cloudflare, outside Git and chat.
4. Redeploy the production branch. `https://jetmajlis.com/api/account` should
   return `available: true`. Sign in and make a test preorder. Existing Google
   accounts can sign up or sign in using the same flow.

If the live endpoint returns `available: false`, check that all three names
are present under **Production** and redeploy after saving them. Test sign-in
on `jetmajlis.com` because the Google redirect URI is set for the custom domain.

Responses are available privately in Cloudflare D1 under the `preorders`
table. In the SQL console, run:

```sql
SELECT reference, created_at, email, items, total_bhd, display_currency
FROM preorders ORDER BY created_at DESC;
```

Only the verified email, item IDs and quantities, currency choice, reference,
and server-calculated BHD total are saved with a preorder. There is no public
response endpoint, payment integration or delivery promise. Publish the
brand's privacy notice for this collection before accepting customer data.

### Preorder tracking

Customers sign in through **Account** to see their own references, dates,
items, totals and tracking statuses. Rerun `db/preorders.sql` if you created
the database before tracking was added. This adds the tracking table and index
without changing preorder records.

To mark a request as under review or closed, use the private D1 console.
Replace the sample reference with the actual reference and use the status
`reviewing` or `closed`. New requests show as received.

```sql
INSERT INTO preorder_status (reference, status)
VALUES ('actual-preorder-reference', 'reviewing')
ON CONFLICT(reference) DO UPDATE SET status = excluded.status;
```

### Owner dashboard

In the JetMajlis Pages project's **Production → Variables and Secrets**, set
`OWNER_EMAIL` to the exact verified email of the owner's Google account. Then
redeploy and open [jetmajlis.com/owner](https://jetmajlis.com/owner). Sign in
with that Google account. The dashboard replaces day-to-day SQL queries for
viewing, filtering, exporting and updating preorders.

Customer sign-ins are recorded going forward. Existing preorder records and
available sessions also populate the people view. The first sign-in or owner
customer-list read creates the sign-in table automatically.
