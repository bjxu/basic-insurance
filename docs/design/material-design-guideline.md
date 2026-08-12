# Material Design 3 Guideline — Basic Insurance

Color and typography reference for `mockups/main.html` and `mockups/admin.html` (and
future UI work). Every color below is algorithmically generated from the app's
existing accent color — not hand-picked — using Google's own Material Design 3
color system, so it can be regenerated or re-derived from a new seed at any time.

## 1. Color

### 1.1 Generation method

Seed color: `#2563eb` (the app's existing accent, already used as `--blue` in both
mockups). Generated via [`@material/material-color-utilities`](https://github.com/material-foundation/material-color-utilities)
(Google's official M3 color library), `themeFromSourceColor(argbFromHex('#2563eb'))`.
Two additional "custom colors" (`success`, `warning` — M3's core scheme only defines
primary/secondary/tertiary/error, so semantic colors beyond that are added via M3's
documented "custom color" technique: run the same algorithm on a different seed and
take its `primary`/`onPrimary`/`primaryContainer`/`onPrimaryContainer` roles) were
generated from the mockups' existing `--green` (`#16a34a`) and the amber already used
for the HMO tag/warning banner (`#f59e0b`). See `docs/superpowers/plans/2026-08-12-material-design-mockup-redesign.md`
Task 1 Step 1 for the exact reproducible command.

### 1.2 Tokens (light scheme — both mockups are light-themed; dark is out of scope)

| Token | Hex | Use |
|---|---|---|
| `--md-sys-color-primary` | `#0053db` | Primary actions, links, focus rings, selected states |
| `--md-sys-color-on-primary` | `#ffffff` | Text/icons on a primary-colored surface (e.g. button label) |
| `--md-sys-color-primary-container` | `#dbe1ff` | Soft background for primary-related emphasis (e.g. info banners) |
| `--md-sys-color-on-primary-container` | `#00174b` | Text on `primary-container` |
| `--md-sys-color-primary-hover` | `#003ea8` | Hover/active state for primary elements (pragmatic addition: real M3 uses state-layer opacity overlays, which need JS/interaction states these static mockups don't have — this is the primary tonal palette's tone 30, one step darker, used the same way the mockups' old `--blue-dark` was) |
| `--md-sys-color-secondary` | `#595e72` | Less prominent actions/text than primary |
| `--md-sys-color-on-secondary` | `#ffffff` | Text/icons on a secondary-colored surface |
| `--md-sys-color-secondary-container` | `#dde1f9` | Soft secondary background |
| `--md-sys-color-on-secondary-container` | `#161b2c` | Text on `secondary-container` |
| `--md-sys-color-tertiary` | `#745470` | Accent color for categorical distinction (e.g. the Telmed model tag) |
| `--md-sys-color-tertiary-container` | `#ffd6f8` | Soft tertiary background |
| `--md-sys-color-on-tertiary-container` | `#2b122b` | Text on `tertiary-container` |
| `--md-sys-color-error` | `#ba1a1a` | Errors, destructive actions, invalid input |
| `--md-sys-color-error-container` | `#ffdad6` | Soft error background (validation messages) |
| `--md-sys-color-on-error-container` | `#410002` | Text on `error-container` |
| `--md-sys-color-success` | `#006e2d` | Success/savings/cheapest-price indicators |
| `--md-sys-color-on-success` | `#ffffff` | Text/icons on a success-colored surface |
| `--md-sys-color-success-container` | `#7ffc97` | Soft success background (e.g. year-over-year "down" badge) |
| `--md-sys-color-on-success-container` | `#002109` | Text on `success-container` |
| `--md-sys-color-warning` | `#855300` | Warnings, HMO/alternative-model indicators |
| `--md-sys-color-on-warning` | `#ffffff` | Text/icons on a warning-colored surface |
| `--md-sys-color-warning-container` | `#ffddb8` | Soft warning background |
| `--md-sys-color-on-warning-container` | `#2a1700` | Text on `warning-container` |
| `--md-sys-color-surface` | `#fefbff` | Page background and elevated card backgrounds (replaces the old ad-hoc `#fff`/`--gray-50` split — both were already near-white, this consolidates them into one token) |
| `--md-sys-color-on-surface` | `#1b1b1f` | Primary text (replaces `--gray-900`) |
| `--md-sys-color-on-surface-variant` | `#45464f` | Secondary/muted text and labels (replaces `--gray-500`/`--gray-600`/`--gray-700` — deliberately consolidated: those three were all "medium-gray text" at slightly different shades with no semantic distinction between them) |
| `--md-sys-color-surface-variant` | `#e2e2ec` | Subtle fill background (replaces `--gray-100`) |
| `--md-sys-color-outline` | `#757680` | De-emphasized text, disabled/placeholder-adjacent content (replaces `--gray-400`) |
| `--md-sys-color-outline-variant` | `#c5c6d0` | Borders, dividers (replaces `--gray-200`/`--gray-300`) |

**Note on container brightness:** M3's containers (tone ~90) are more saturated than
the old ad-hoc "light tint" backgrounds (e.g. `success-container` `#7ffc97` is a
vivid mint, not the old pale `--green-light` `#f0fdf4`). This is expected, not a
mistake — M3's color language is intentionally more expressive than pastel tints.

### 1.3 Consolidation summary (old → new)

| Old variable | New token |
|---|---|
| `--blue` | `--md-sys-color-primary` |
| `--blue-light` | `--md-sys-color-primary-container` |
| `--blue-dark` | `--md-sys-color-primary-hover` |
| `--blue-mid` *(admin.html, unused)* | dropped |
| `--gray-50` | `--md-sys-color-surface` |
| `--gray-100` | `--md-sys-color-surface-variant` |
| `--gray-200` | `--md-sys-color-outline-variant` |
| `--gray-300` *(admin.html, unused)* | dropped |
| `--gray-400` | `--md-sys-color-outline` |
| `--gray-500`, `--gray-600`, `--gray-700` | `--md-sys-color-on-surface-variant` |
| `--gray-900` | `--md-sys-color-on-surface` |
| `--green` | `--md-sys-color-success` |
| `--green-light` | `--md-sys-color-success-container` |
| `--red` | `--md-sys-color-error` |
| `--red-light` | `--md-sys-color-error-container` |

## 2. Typography

Typeface: **Roboto** (Material Design's standard/default typeface), loaded via Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
```

```css
body {
  font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}
```

Official M3 type scale (full reference table — only the roles actually used by these
two mockups are applied in Tasks 2/3; the rest are documented here for future work):

| Role | Size/Line-height | Weight | Tracking |
|---|---|---|---|
| Display Large | 57px/64px | 400 | 0 |
| Display Medium | 45px/52px | 400 | 0 |
| Display Small | 36px/44px | 400 | 0 |
| Headline Large | 32px/40px | 400 | 0 |
| Headline Medium | 28px/36px | 400 | 0 |
| Headline Small | 24px/32px | 400 | 0 |
| Title Large | 22px/28px | 400 | 0 |
| Title Medium | 16px/24px | 500 | 0.15px |
| Title Small | 14px/20px | 500 | 0.1px |
| Label Large | 14px/20px | 500 | 0.1px |
| Label Medium | 12px/16px | 500 | 0.5px |
| Label Small | 11px/16px | 500 | 0.5px |
| Body Large | 16px/24px | 400 | 0.5px |
| Body Medium | 14px/20px | 400 | 0.25px |
| Body Small | 12px/16px | 400 | 0.4px |

Roles used in `mockups/main.html`/`mockups/admin.html` (Tasks 2/3 apply these as
CSS custom properties, `--md-sys-typescale-<role>-{font,size,line-height,weight,tracking}`):

- **Title Large** — page `<h1>` (e.g. "Prämienvergleich")
- **Title Medium** — card/section headers
- **Label Large** — form field labels (e.g. "Aktuelle Kasse")
- **Body Medium** — general body copy, hint text
- **Body Small** — fine print (footer notices, secondary hints)
- **Headline Small** — prominent monetary amounts (plan prices)
