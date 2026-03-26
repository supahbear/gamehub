# Nexus — Technical Brief
**The Breach Hub | March 2026**

---

## Overview

Nexus is a browser-based TTRPG campaign hub built for *The Breach*, a D&D 5e campaign world. It gives players and DMs a single consolidated interface to browse world lore, quests, maps, bestiary entries, alchemical content, and literature — all sourced live from a Google Sheets backend.

The application is a **vanilla JavaScript SPA** with no frameworks or build tooling. The frontend is fully static (HTML + CSS + JS), with all dynamic data coming from a **Google Apps Script** endpoint that exposes spreadsheet content as JSON over JSONP.

---

## Architecture

### Frontend
- Single HTML shell (`html.html`) with no server-side rendering
- Modular JS split across one orchestrator (`script.js`) and five viewer classes
- CSS split into eight layered files loaded in a defined cascade order

### Backend
- **Google Sheets** stores all world content (characters, locations, quests, maps, bestiary, etc.)
- **Google Apps Script** publishes the spreadsheet as a web app, accepting a `sheets` query param and returning JSON with JSONP callback support
- All sheet names and the endpoint URL are centralized in `config.js`

### Data Flow
```
Google Sheets
    → Google Apps Script Web App
        → JSONP request (script tag injection)
            → TTRPGHub._sheetCache
                → Viewer class renders HTML
```

---

## Core Application Logic (`script.js`)

The `TTRPGHub` class is the single orchestrator for the entire app. One instance (`hub`) is created on page load and all viewer modules hold a reference back to it.

### World Selection
On load, `loadWorldsFromAppsScript()` attempts a JSONP call to fetch available worlds. If the network request fails or times out, `useFallbackWorlds()` provides a hardcoded single-world configuration for *The Breach*. Selecting a world transitions from the landing screen to the hub, applies the world's CSS theme class, and begins prefetching all sheet data in the background.

### Panel System
The hub has six panels (Encyclopedia, Journal, Atlas, Bestiary, Alchemy, Literature), managed by `selectPanel()`. Expanding a panel triggers a **directional wipe animation** — panels slide relative to the selected one using absolute CSS positioning driven by `--panel-step` variables. Non-active panels are visually desaturated via `saturate(0.35)`. Animation timing coordinates `requestAnimationFrame` with CSS transition timing to prevent visual glitches.

### Data Caching & Prefetching
`loadSheets()` implements a **cache-first strategy** using `_sheetCache`. On hub entry, `_prefetchAllSheets()` fires all JSONP requests in the background before any panel is opened. By the time the user clicks a panel, data is typically already available. In-flight requests are tracked via `_sheetPrefetch` to avoid duplicate fetches.

### JSONP Implementation
Since Google Apps Script endpoints don't support CORS for cross-origin requests, the app uses a **custom JSONP handler** (`jsonp()`). It creates a `<script>` tag with a unique callback name, injects it into the DOM, and sets a 10-second timeout. On completion or error, the script tag and global callback are cleaned up.

---

## Viewer Modules

Each viewer is a class instantiated lazily the first time its panel is opened. All viewers share the same modal overlay (`#modalOverlay`, `#articleModal`) defined in the HTML.

### ArticleViewer (`article_viewer.js`)
The universal content viewer used by Encyclopedia, Bestiary, Alchemy, and Literature panels. It accepts an `allowedSheets` array to scope which data categories it renders.

**Filtering**: Three simultaneous filters — category dropdown (sheet name), tag dropdown (populated from data), and text search. Filters apply client-side against `currentArticles`.

**Article Modal**: Two-column layout with a 370px image pane and a flexible text pane. Images support slideshows (comma or newline-separated URLs) and a custom `L20PX`/`R20` offset syntax for `object-position` fine-tuning.

**Pagination**: Content is broken into pages using a binary search algorithm that measures actual rendered column height to find the maximum content that fits per page. Orphan protection prevents headers from appearing on the last line of a page. Arrow keys navigate pages; ESC closes with proper listener cleanup.

**Markdown**: A lightweight regex-based converter handles headings (h1–h3), bold, italic, bullet lists, and line breaks. No external library is used.

### QuestViewer (`quest_viewer.js`)
Renders a **sidebar + detail** layout inside the journal panel. Quests are grouped by their primary tag (location) into collapsible sidebar tabs. A `Set` tracks which location tabs are expanded. "Completed" quests are automatically sorted to the bottom of their location group. Searching filters across all location groups simultaneously. Detail view fades between quests via CSS opacity transition.

### AtlasViewer (`atlas_viewer.js`)
Renders a **tile gallery** of maps and locations grouped by primary tag. Tiles lazy-load images and open a full-screen **lightbox modal** on click. The lightbox supports prev/next navigation via on-screen buttons, arrow keys, and tracks `currentIndex` over the full dataset.

### TourViewer (`tour_viewer.js`)
A guided slideshow system for narrative experiences. Tours load a sequence of slides (media + overlay text) into a full-screen modal with dot-based navigation. Currently partially implemented — the data fetch layer (`loadTourSlides`) is stubbed and the system is scaffolded for future content.

---

## CSS Architecture

Styles are loaded in a fixed cascade order, each layer building on the previous:

| File | Role |
|---|---|
| `base.css` | CSS custom properties, font imports, resets, body state logic |
| `cards.css` | World cards, article cards, background video layers |
| `components.css` | Hub panel layout system, collapsed header pills, nav |
| `features.css` | Content browsing UI — filters, grids, quest sidebar, atlas tiles |
| `modals.css` | Modal overlay, article modal layout, pagination, tour modal |
| `responsive.css` | Mobile breakpoints (≤768px) — vertical stacking, single-column grids |
| `utilities.css` | Helper classes for empty states, loading, and error messaging |
| `breach-theme.css` | World-specific overrides scoped to `body.world-breach` |

### Theme System
`applyWorldTheme()` in `script.js` adds a class like `world-breach` to the `<body>`. `breach-theme.css` then applies a purple color scheme (`#1a0f1e` → `#4a3f5c` gradient range), Cinzel serif typography, and adjusted glow/shadow values throughout the UI — without touching any base styles.

### Panel Layout
The six-panel system is driven by CSS custom properties:
- `--panel-count: 6`
- `--panel-w: calc((100% - gaps) / 6)`
- `--panel-step`: Per-panel offset for directional wipe

`container-type: inline-size` enables container queries for panel-responsive font sizing. `:has()` selectors handle conditional styling (e.g., hiding the landing screen when the hub is active) without JavaScript class toggling.

---

## Configuration (`config.js`)

All hardcoded values are isolated here:
- `APPS_SCRIPT_URL` — the single Google Apps Script endpoint
- `SHEETS` — enum of all spreadsheet tab names
- `PANEL_SHEETS` — maps each hub panel to the sheets it requires
- `getSheetUrl(sheets)` — constructs the full JSONP request URL
- `log / warn / error` — debug utilities gated behind a `DEBUG_MODE` flag

---

## Key Design Decisions

**No framework dependency.** The app deliberately uses no React, Vue, or build pipeline. This keeps deployment simple (any static host), removes update maintenance, and keeps the codebase portable and readable without tooling.

**Google Sheets as CMS.** Campaign content changes frequently. Using Sheets gives non-technical contributors (players, DMs) direct write access to content without any code changes or deployments. The Apps Script layer handles access control and serves as a lightweight API.

**JSONP over fetch.** Google Apps Script web apps don't return CORS headers compatible with `fetch()` from a different origin. JSONP is the practical workaround: inject a `<script>` tag with a callback, collect the response, and clean up the DOM. The timeout and cleanup logic in `jsonp()` guards against hanging requests.

**Prefetch on hub entry.** Loading all sheets upfront when the user enters the hub means no per-panel loading delays. The cost (bandwidth) is justified because users are expected to browse multiple panels per session and the datasets are small (spreadsheet rows).

**Lazy viewer instantiation.** Viewer classes are only constructed when their panel is first opened, keeping the initial page load lightweight and decoupling panel initialization from hub initialization.

**World-scoped theming via CSS classes.** Adding a class to `<body>` and writing all theme overrides in a single scoped stylesheet (`breach-theme.css`) ensures the default styles remain clean and adding future worlds requires only a new theme file and a matching class name.

---

## Assets

Background video (`assets/videos/Breach-vid.mp4`) is preloaded in the HTML `<head>` via a `<link rel="preload">` tag to minimize transition delay when the world hub activates. Two `<video>` elements are maintained in the DOM simultaneously (landing + world), with opacity crossfade managed by `activateWorldBackground()` in the hub class.

---

*Nexus is a static frontend application. No server infrastructure is required beyond the Google Apps Script deployment and a static file host.*
