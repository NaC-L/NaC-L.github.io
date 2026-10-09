# Naci's blog

A Jekyll blog published at https://nac-l.github.io/.

## Theme

Local `_layouts/` and `_includes/` override Minima. `assets/css/site.css` supplies shared article styling; `assets/css/themes.css` supplies **Plaintext** (default, narrow personal blog with system light/dark), **Disassembler** (dark notebook with numbered entries and a technical metadata strip), and **Brainrot** (kawaii anime shrine, heart wallpaper, ribbons, sticker clutter, retro badges, and clashing candy-colored shadows). `assets/css/notebooks.css` supplies **Workbench** (forest-green research log, amber dates, inset text column) and **Margin** (warm paper, blue ink, italic serif headings, small figure clippings). Article-specific styles and image zoom scripts remain in their posts.

Post `description` front matter supplies the home-page summaries. Optional `preview_image` and `preview_label` supply Margin's small decorative figure clippings on desktop; images are existing assets from the corresponding posts. Article bodies and dated URLs are preserved.

Five native swatch buttons switch themes directly on every page; there is no dropdown or popover. Each has an accessible name and a hover tooltip. The current theme's name stays visible, exactly one button has `aria-pressed="true"`, and a dot beneath it marks the selection without relying on color. Tab moves between buttons; Enter or Space activates them, with visible keyboard focus. `assets/js/theme.js` restores the validated `nacl-theme` localStorage preference before styles load and saves changes immediately. All saved keys remain stable: `simple`, `tech`, `schizo`, `hexdump` (Workbench), and `monograph` (Margin). If storage is blocked, switching works for the current page. With JavaScript disabled, the controls are hidden and Plaintext remains readable. No animations, flashing, or autoplay are added.

Brainrot's homepage mascots are original, self-contained vector illustrations in `assets/img/mascot-pink.svg` and `assets/img/mascot-blue.svg`, not hotlinked character art. `assets/img/kawaii-tile.svg` supplies the repeating heart-and-sparkle wallpaper. Decorations are hidden from assistive technology and from the other themes; article content stays legible. On mobile the two mascots sit side by side below the warning panel. The kawaii refinement was checked on all seven pages at 1280, 768, 390, and 320px; desktop Plaintext and Disassembler screenshots remained pixel-identical.

Workbench and Margin use the blog's own name and a chronological reading list rather than reference-site hero layouts. There is no byte-viewer panel, giant topic headline, red punctuation, or monochrome illustration grid. Workbench aligns its heading and summaries with an amber date rail. Margin uses a continuous paper margin and small, full-color clippings; these decorative previews are hidden on mobile to leave room for the text. Both use fixed color schemes independent of the system preference.

## Local preview

The production site uses GitHub Pages' Jekyll 3.10, while the repository's original Gemfile targets Jekyll 4. For Pages parity, create a separate Gemfile outside the repository containing:

```ruby
source "https://rubygems.org"
gem "github-pages", group: :jekyll_plugins
gem "webrick"
```

Set `BUNDLE_GEMFILE` to that file, run `bundle install`, then `bundle exec jekyll serve` from this repository. Set `JEKYLL_ENV=production` to include the existing analytics integration. This makeover was built with the Pages Gemfile in Ruby 3.3.

Check home, About, 404, and all posts at desktop and mobile widths in every theme. Article images and code blocks must not cause page-wide horizontal overflow.

Verified locally after replacing the selector: production Pages build; all seven pages at 1280px and 390px in all five themes, plus each theme's homepage at 768px and 320px (80 page/viewport/theme checks); pointer selection; Tab, Enter, and Space activation; focus retention; navigation and reload persistence; invalid saved values; blocked storage; and the no-JavaScript fallback. All swatches remain inside the viewport, with no page-script errors. Desktop and mobile surfaces were visually inspected. Control text contrast is at least 5.04:1 across both system preferences, including the Brainrot wallpaper palette.
