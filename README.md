# LUX Waukee: website

The website for **LUX**, a modern Asian fusion restaurant and craft cocktail bar at
3150 Grand Prairie Pkwy, Suite 150, in Waukee, Iowa.

It's a plain static site: one HTML page, one stylesheet, two small scripts and the images. There are
no frameworks, no build step and no external scripts (only Google Fonts), and every URL is relative, so it
runs on any static host, including in a sub-folder.

**Before launch, read [CONTENT-TODO.md](CONTENT-TODO.md):** it lists every placeholder and every fact
from local press the owner should confirm, with the exact file and line to edit.

## What's on the page

Header with a live open/closed status (Central time) · hero with the halo-lit sign and the hours strip ·
press strip · menu highlights on printed-style cards (Lunch / Dinner / Drinks, opening on the service
being served) · Reserve and Order panels · About · private events inquiry form · gallery with a
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
CONTENT-TODO.md     what to confirm or supply, and where
```

## Common updates

### Hours
Edit the `services` list in **`js/config.js`**. It drives the live status ("Open now · Lunch until
2:30 PM", "Last call…", "Back at 4:30 PM for dinner"…), the hours table, the footer, the hero strip and
the menu tabs. To close a day, leave that day out of every service. Then update the two hand-kept copies:
the JSON-LD hours in `index.html` (for Google) and the static fallback text. CONTENT-TODO.md section 3
lists the lines.

### Reservation, ordering and events-form links
Fill in `reserveUrl`, `orderUrl` and `eventsFormEndpoint` in **`js/config.js`**. Until then, Reserve and
Order fall back to calling the restaurant, and the events form hands guests a pre-filled email
("Almost there…") instead of claiming it was sent. CONTENT-TODO.md has a 3-step Formspree setup.

### Menu
The menu cards live in `index.html` (search for `MENU`). Each dish is one `<li class="dish">` block;
copy one to add a dish. Use the "priced" form (with the dotted leader) only when you have a price.

### Photos
Each photo slot is one file in `assets/photos/`. Save the real photo as JPG/WebP with the same name, change
the extension in `index.html` on the line(s) CONTENT-TODO.md section 5 lists, and update the `alt` text.
Frames are fixed and photos are cropped to fit (never stretched), so any reasonable shape works; keep the
subject near the center. Recommended pixel sizes are in the same table.

## Deploy

Any static host works. Upload or point it at this folder's contents (the folder that holds
`index.html`); there is no build command.

- **Netlify:** drag the folder onto <https://app.netlify.com/drop> for an instant site, or
  *Add new site → Import an existing project*, connect this GitHub repo, leave the build command empty and
  set the publish directory to the repo root. Pushes to the main branch then redeploy automatically.
- **Cloudflare Pages:** *Workers & Pages → Create → Pages → Connect to Git*, pick this repo, framework
  preset **None**, build command empty, output directory `/`. (Or use *Upload assets* to drag the folder.)
- **GitHub Pages:** *Settings → Pages → Deploy from a branch → main / (root)*. Note that **this repo is
  private**, and GitHub Pages for private repos needs a paid plan (Pro, Team or Enterprise); otherwise make
  the repo public first. The site works under the `https://<user>.github.io/<repo>/` sub-path as is.

After pointing the domain (likely luxwaukee.com) at the host, finish the launch items in
CONTENT-TODO.md section 7: absolute social-card image URLs and a canonical link.

## Notes for developers

- Without JavaScript the page is complete: the nav stays visible, all three menu cards show in turn and
  nothing is hidden behind animations.
- Motion respects `prefers-reduced-motion`; the sign's flicker plays once per browser session.
- Light effects run on IntersectionObserver, never on scroll events.
