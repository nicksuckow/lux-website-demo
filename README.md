# LUX Waukee: website

The website for **LUX**, a modern Asian fusion restaurant and craft cocktail bar at
3150 Grand Prairie Pkwy, Suite 150, in Waukee, Iowa.

It's a plain static site: one HTML page, one stylesheet, two small scripts and the images. There are
no frameworks, no build step and no external scripts (only Google Fonts), and every URL is relative, so it
runs on any static host, including in a sub-folder.

## What's on the page

Header with a live open/closed status (Central time) · hero with the halo-lit sign and the hours strip ·
press strip · the menu on printed-style cards (Lunch / Dinner / Drinks): the Dinner card is the owner's full
printed food menu, two columns on desktop, one column with sticky section buttons on phones · Reserve and
Order panels · About · private events inquiry form · gallery with a
keyboard-accessible lightbox · Visit (address, directions, hours table, map on request) · footer.
On phones a quick-action dock (Call · Reserve · Order · Directions) appears once you scroll past the hero.

## Preview it locally

From this folder, start any static server and open the address it prints:

```sh
python3 -m http.server 8000      # then open http://localhost:8000
# or
npx http-server -p 8000
```

(Opening `index.html` straight from the file system mostly works too, but a local server is closer to the
real thing.)

## Files

```
index.html          the whole page, plus the JSON-LD structured data in <head>
css/styles.css      all styling (colors and sizes are CSS variables at the top)
js/config.js        THE place for links and hours (booking, ordering, form endpoint, services)
js/main.js          behavior: live hours/status, menu tabs, mobile menu, dock, lightbox, form, map
assets/             logo files, favicon, social-share image (og-image.jpg), the real sign photo
assets/photos/      one placeholder SVG per photo slot, to be replaced by real photos
.github/workflows/  the GitHub Pages deploy
```

## Common updates

### Hours
Edit the `services` list in **`js/config.js`**. It drives the live status ("Open now · Lunch until
2:30 PM", "Closing soon…" in a service's last 30 minutes, "Back at 4:30 PM for dinner"…), the hours table,
the footer, the hero strip and the menu tabs. To close a day, leave that day out of every service. Then
update the two hand-kept copies in `index.html`: the JSON-LD `openingHoursSpecification` in the `<head>`
(for Google) and the static fallback hours text shown before the script runs (search for the times, e.g.
`4:30`).

### Reservation, ordering and events-form links
Fill in `reserveUrl`, `orderUrl` and `eventsFormEndpoint` in **`js/config.js`**. Until then, Reserve and
Order fall back to calling the restaurant (the Reserve/Order panel text switches to booking/ordering online
once a link is set), and the events form hands guests a pre-filled email ("Almost there…") instead of
claiming it was sent.

To have event inquiries delivered by email (Formspree, about 5 minutes): create a free form at
**formspree.io** with **lux@luxwaukee.com** as the notification address, paste its endpoint (it looks like
`https://formspree.io/f/abcdwxyz`) into `eventsFormEndpoint`, then send a test inquiry from the live site
and confirm the address when Formspree asks.

### Menu
The menu cards live in `index.html` (search for `MENU`); the full food menu is the **Dinner** card
(search for `DINNER:`). Each dish is one `<li class="dish">` block, inside its course
(`<section class="course">`, e.g. `id="course-bites"` for Small Bites). A typical dish:

```html
<li class="dish">
  <p class="dish__line dish__line--priced"><span class="dish__name">Furikake Fries<span class="dish__dots" aria-hidden="true"></span></span><span class="dish__price"><span class="visually-hidden">$</span>8</span></p>
  <p class="dish__note">golden fries, furikake, yuzu kewpie</p>
</li>
```

- **Change a price:** edit the number right after `<span class="visually-hidden">$</span>` (here `8`).
  Leave that hidden `$` in place: it isn't shown, but screen readers read it.
- **Rename a dish or change its description:** edit the text before `<span class="dish__dots"` (the name)
  or inside `<p class="dish__note">` (the description, lowercase as on the printed card).
- **Add a dish:** copy a whole `<li class="dish">…</li>` block and edit it. Keep the `dish__line--priced`
  class and the `dish__dots` span when it has a price (they draw the dotted leader); without a price, drop
  both and the `dish__price` span (see the Wood Fire Steak). **Remove a dish:** delete its block.
- **Options and add-ons** (Satay Beef/Pork, the steak cuts, "Add Chicken"…) are the `<li class="dish__opt">`
  rows inside `<ul class="dish__opts">`; each has its own price, edited the same way.
- **Contains peanuts:** wrap the end of the name with the mark, as on the House Salad, so the mark never
  wraps alone (on a longer name wrap its last two words, as on the Combo Vermicelli `Noodle Bowl`):
  `House <span class="nowrap">Salad<svg class="pn" aria-hidden="true" focusable="false"><use href="#i-peanut"/></svg></span><span class="visually-hidden">, contains peanuts</span>`.
- **Name in gold** (as printed on the card): add `dish--featured` to the `<li>`, e.g. `<li class="dish dish--featured">`.
- Sides are a compact list (name and price only), shown in two columns where there's room.

The section buttons on phones (`<nav class="menu-index">`, just above the Dinner card) link to the course
headings by id; if you add or rename a course, update its button too. Which tab opens first is set by
`menuTabFollowsService` in `js/config.js`: it's `false` (always open on Dinner, the full menu); set it to
`true` once the Lunch card has a full menu, so the tab follows the service being served.

### Photos
Each photo slot is one file in `assets/photos/`. Save the real photo as JPG/WebP with the same base name,
then in `index.html` search for the file name and change the extension (gallery photos appear twice: the
link `href` and the image `src`), update the `alt` text (it starts "Placeholder for…"), and in the gallery
remove "(photo to come)" from `data-caption`. Delete the old `.svg` once nothing references it.
Frames are fixed and photos are cropped to fit from the center (never stretched), so any reasonable shape
works; keep the subject near the middle and aim for 150–350 KB per photo.

| File | Where it shows | Recommended size |
|---|---|---|
| `room-wide` | About, wide letterbox (cropped to 4:3 on phones) | 2400 × 1000 (12:5) |
| `menu-dinner` | Menu, beside the headline (desktop) | 1000 × 1250 (4:5) |
| `menu-lunch`, `menu-drinks` | Menu, beside the Lunch / Drinks cards (desktop) | 1000 × 1250 (4:5) |
| `events` | Private events, beside the intro (tablet and desktop) | 1000 × 1250 (4:5) |
| `gallery-*` (7 files) | Gallery tiles and lightbox | 1200 × 1500 (4:5) |

## Deploy

Any static host works. Upload or point it at this folder's contents (the folder that holds
`index.html`); there is no build command.

- **Netlify:** drag the folder onto <https://app.netlify.com/drop> for an instant site, or
  *Add new site → Import an existing project*, connect this GitHub repo, leave the build command empty and
  set the publish directory to the repo root. Pushes to the main branch then redeploy automatically.
- **Cloudflare Pages:** *Workers & Pages → Create → Pages → Connect to Git*, pick this repo, framework
  preset **None**, build command empty, output directory `/`. (Or use *Upload assets* to drag the folder.)
- **GitHub Pages (set up in this repo):** `.github/workflows/pages.yml` publishes the site on every push
  to `main`. It ships only `index.html`, `css/`, `js/` and `assets/`, and fills in the absolute URLs that
  link previews need (og:image, og:url, canonical, JSON-LD). One-time setup: *Settings → Pages → Build and
  deployment → Source: **GitHub Actions***, then re-run the latest "Deploy site to GitHub Pages" run under
  *Actions* (or push again). The site will be at <https://nicksuckow.github.io/lux-website-demo/>. Note that
  **this repo is private**, and GitHub Pages for private repos needs a paid plan (Pro, Team or Enterprise);
  on the free plan, make the repo public first. A custom domain (e.g. luxwaukee.com) can be added under
  *Settings → Pages*, and the workflow then uses it automatically.

**On hosts other than GitHub Pages,** make the social-card URLs absolute for that address before sharing a
link. Every URL in the source is relative so it runs on any host, but link previews need an absolute image
URL. In `index.html`: make `og:image` and `twitter:image` absolute (e.g.
`https://luxwaukee.com/assets/og-image.jpg`), add `<meta property="og:url">` and `<link rel="canonical">`
with the site address, and make the JSON-LD `image`, `logo` and `hasMenu` absolute and add its `url`.

## Notes for developers

- Without JavaScript the page is complete: the nav stays visible, all three menu cards show in turn (the
  tab roles are added by JS; the Dinner card's section buttons are plain links), the events form uses the browser's own validation and posts to a mailto:
  address, and nothing is hidden behind animations.
- Motion respects `prefers-reduced-motion`; the sign's flicker plays once per browser session.
- Light effects, the sticky section buttons' solid background and their "current course" highlight run on
  IntersectionObserver, never on scroll events.
- Header breakpoints are in `em` (60em = 960px at the default text size), so visitors who set a larger
  default font get the compact menu-button header instead of buttons pushed off-screen. `js/main.js` uses
  the same `60em` query for the mobile menu.
- The logo has a 600px WebP (`assets/lux-logo-gold-600.webp`) for phones; its `sizes` attribute (on both
  `<source>`s and the preload in `<head>`) mirrors the `.sign` width in the CSS, so update both together.
- Google Fonts load without blocking the first paint (`rel="preload"` + `onload`, with a `<noscript>`
  copy).
