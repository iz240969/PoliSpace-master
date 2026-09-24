# PoliSpace UI design

The September 2026 redesign adapts the visual hierarchy of [Creative Tim's Material Tailwind Dashboard React](https://github.com/creativetimofficial/material-tailwind-dashboard-react) to PoliSpace's existing HTML, CSS, JavaScript and PHP application. No template code, frontend framework, package dependency or build step was introduced.

## Reference review

Reviewed the repository's dashboard layout, sidebar, navbar, statistic cards, table example, and sign-in example, along with the published dashboard image. The linked [live examples](https://demos.creative-tim.com/material-tailwind-dashboard-react/#/dashboard/home) were reachable, but their JavaScript-rendered UI could not be inspected interactively because this session had no connected browser.

Adapted these concepts:

- Separate navigation and workspace, consistent page headers, compact summary cards, and controls grouped above data.
- Quiet table headings, subtle dividers, soft status colors, and consistent action sizes.
- Collapsible navigation below 1024px, stacked controls, and horizontal table scrolling.

PoliSpace retains its logo, Malay terminology, gold accent and facility-booking workflows. Public pages retain their own layout, with shared typography, surfaces, form controls and buttons.

## Implementation

- `resources/css/base/base.css`: shared warm neutral colors, spacing, radii and elevation.
- `resources/css/components/workspace.css`: admin shell, mobile drawer, stat cards, toolbars and table refinements. Imported after existing responsive styles.
- Existing button, form, feedback and page styles provide the common visual language across authentication, booking, status, customer dashboard and Asrama pages.
- `resources/views/admin/dashboard.html`: page structure, search controls and on-demand facility creation form.
- `resources/js/features/admin.js`: local search and customer filters, stat presentation and accessible facility availability switch. Search does not mutate source records. Customer filters do not filter the staff verification queue.
- `resources/js/core/navigation.js`: drawer keyboard handling, scrollable table regions and dialog focus management.

All PHP APIs, authentication, booking statuses, payment rules, quotas, availability checks, notifications and database files remain unchanged. Stat cards use existing API definitions; total bookings exclude unpaid records, which the caption states.

## Verification

Passed:

- `powershell -ExecutionPolicy Bypass -File documentation/checks/smoke.ps1` — PHP and JavaScript syntax, local HTTP endpoints and existing access-control checks.
- `node --test documentation/checks/workspace.test.js` — customer search/filter combinations, verification queue preservation, cart-reference search, response ordering, PIC search and escaping, drawer focus and facility form disclosure.
- Static HTML structure, duplicate IDs, form/control references and CSS parsing checks.
- `git diff --check`.

Browser visual QA remains outstanding because neither a connected browser nor the in-app browser was available. Check desktop (1440px), tablet (1024px), and mobile (390px) with real admin/customer sessions: table overflow and action alignment, navigation open/close, dialogs, booking/cart flows, staff verification, facility/PIC forms, Asrama settings and report printing. No emails were sent and no booking/customer records were changed during verification.

## Screenshot fixes and motion

The follow-up fixes lower shared input selector specificity so search icon padding and readonly/error styles can win. Report controls use a consistent 42px height and a responsive grid beneath the page heading. Customer-dashboard search and sort heights follow the same rule.

`components/motion.css` provides short panel, dialog, menu and control transitions. Reduced-motion preferences disable animations; modern browsers also animate dialog closing, with an entry-animation fallback for other browsers. Grouped booking rows share a measured, interruptible cell-content animation in `core/motion.js`; the table markup and columns remain stable.

Report refreshes retain the current content, expose a busy/status indication, ignore stale requests and restore the previous period after a failed refresh. Authentication uses a neutral placeholder instead of briefly showing a guest menu. Empty stat grids reserve space; font preconnections and optional font display reduce late layout shifts. Asset versions were bumped to `20260925-smooth`.

Thirteen interaction tests and the existing smoke checks pass. These include report refresh stability, response ordering, failure recovery, direct guest navigation, startup session request sharing and rapid group-animation toggles. Browser visual verification remains outstanding.

Guest entry buttons now resolve authentication before navigating, avoiding a booking-page load followed by a login redirect. Direct visits to protected pages hide application content until the session check completes and stop initialization on denial. Supported browsers use native [cross-document view transitions](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document), with normal navigation as fallback and reduced-motion opt-out. Asset versions are `20260925-navigation`.

Checks were consolidated under `documentation/checks`; `smoke.ps1` now runs the behaviour tests as well as syntax/API checks. See [the checks guide](checks/README.md) for the single verification command.
