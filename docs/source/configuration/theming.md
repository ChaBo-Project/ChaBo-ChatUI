# Theming

Chat UI's appearance is driven by environment variables. The single most important thing to know
is **when** each one applies:

- **Runtime** variables are read on every request. Change them in `.env.local` (or in a Space's
  `DOTENV_LOCAL` secret), restart the app, and the change takes effect.
- **Build time** variables are baked into the compiled CSS/JS. Setting them in `.env.local` or
  `DOTENV_LOCAL` does **nothing** — the app has to be rebuilt with the variable present in the
  build environment (for Docker, passed as a build `ARG`).

| Variable                                                 | Applies                               | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_APP_NAME`                                        | runtime                               | Page title, `og:title`, logo alt text, web app manifest name.                                                                                                                                                                                                                                                                                                                                                                                       |
| `PUBLIC_APP_DESCRIPTION`                                 | runtime                               | `og:description`, the `description` meta tag, the intro screen and the modals.                                                                                                                                                                                                                                                                                                                                                                      |
| `PUBLIC_APP_ASSETS`                                      | runtime lookup, assets are build time | Logos & favicons are read from `static/$PUBLIC_APP_ASSETS/`. The path is resolved at runtime, but the files themselves must already be baked into the image. Bundled options are `chatui` and `huggingchat`.                                                                                                                                                                                                                                        |
| `PUBLIC_APP_COLOR`                                       | **build time only**                   | The accent colour. Consumed by `tailwind.config.cjs`, so it is compiled into the stylesheet; `Dockerfile` passes it as a build `ARG`. **Setting it in `DOTENV_LOCAL` has no effect.** It only affects five class sites: `Logo.svelte`, `LoginModal.svelte`, `DisclaimerModal.svelte`, `AnnouncementBanner.svelte`, `ChatWindow.svelte`. Can be any of the [tailwind colors](https://tailwindcss.com/docs/customizing-colors#default-color-palette). |
| `PUBLIC_APP_BACKGROUND`                                  | runtime                               | Light-mode page background. Accepts `#rrggbb`, `#rgb`, `rgb(r, g, b)` or a bare `r g b` triplet. **Quote hex values** — see the note below. Defaults to white.                                                                                                                                                                                                                                                                                      |
| `PUBLIC_APP_SURFACE`                                     | runtime                               | Light-mode secondary surface — sidebar gradient, mobile nav bar. Defaults to `gray-50`.                                                                                                                                                                                                                                                                                                                                                             |
| `PUBLIC_APP_BACKGROUND_DARK`                             | runtime                               | Dark-mode page background. Defaults to `gray-900`.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `PUBLIC_APP_SURFACE_DARK`                                | runtime                               | Dark-mode secondary surface. Defaults to `gray-800`.                                                                                                                                                                                                                                                                                                                                                                                                |
| `PUBLIC_ANNOUNCEMENT_BANNERS`                            | runtime                               | JSON5 array of `{ title, linkTitle, linkHref }`; renders the pill above the chat intro.                                                                                                                                                                                                                                                                                                                                                             |
| `PUBLIC_APP_DISCLAIMER`                                  | runtime                               | Set to `1` to show the disclaimer modal on load. **Also arms a server-side gate**: with it on, every non-GET request outside `/settings`, `/login` and `/admin` is rejected with `405 You need to accept the welcome modal first` until the current session has accepted the modal. That makes it a hard dependency on a working session cookie — see [Embedding in an iframe](#embedding-in-an-iframe).                                            |
| `PUBLIC_APP_DISCLAIMER_MESSAGE`                          | runtime                               | Body text of that modal.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `PUBLIC_APP_ISSUE_URL`                                   | runtime                               | URL for reporting issues / privacy-rights requests, shown on the `/privacy` page.                                                                                                                                                                                                                                                                                                                                                                   |
| `PUBLIC_APP_PRIVACY_EMAIL`                               | runtime                               | Contact email for privacy-rights requests, shown on the `/privacy` page. Optional — the line is omitted entirely if both this and `PUBLIC_APP_ISSUE_URL` are unset.                                                                                                                                                                                                                                                                                |
| `PUBLIC_APP_DATA_SHARING`                                | runtime                               | Set to `1` to add a settings toggle letting users opt in to data sharing with the model creator.                                                                                                                                                                                                                                                                                                                                                    |
| `PUBLIC_APP_GUEST_MESSAGE`                               | runtime                               | Shown in the login modal when guest mode is enabled.                                                                                                                                                                                                                                                                                                                                                                                                |
| `PUBLIC_SMOOTH_UPDATES`                                  | runtime                               | Set to `true` to stream tokens with smoothing.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `PUBLIC_ORIGIN`                                          | runtime                               | The app's canonical public URL. Used for absolute `og:`/icon URLs, as an allowed POST origin, and as the "open in a new tab" target when cookies are blocked. **Leaving it empty renders a broken `undefined/` link in the sidebar** — set it.                                                                                                                                                                                                      |
| `PUBLIC_SHARE_PREFIX`                                    | runtime                               | URL prefix used when sharing a conversation.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `APP_BASE`                                               | **build time**                        | Base path the app is served under (`svelte.config.js`).                                                                                                                                                                                                                                                                                                                                                                                             |
| `ALLOW_IFRAME`                                           | runtime                               | Anything other than `"true"` makes the server append `Content-Security-Policy: frame-ancestors 'none'`, which blocks embedding outright.                                                                                                                                                                                                                                                                                                            |
| `COOKIE_SAMESITE`, `COOKIE_SECURE`, `COOKIE_PARTITIONED` | runtime                               | Session cookie attributes — see below.                                                                                                                                                                                                                                                                                                                                                                                                              |

### Theme selection

The app follows the visitor's OS `prefers-color-scheme` by default. Two things override it:

- The **Theme** button in the sidebar, which stores the choice in `localStorage`.
- A **`?__theme=light`** or **`?__theme=dark`** URL parameter, which wins over both and is then
  remembered. This is the practical way for an embedder to pin the theme:

  ```html
  <iframe src="https://your-space.hf.space/?__theme=light"></iframe>
  ```

  Without it, an embedded chat renders dark for any visitor whose OS is set to dark, regardless of
  the host page — the usual cause of a colour clash in an embed.

### Matching a host page's colours

`PUBLIC_APP_BACKGROUND` / `PUBLIC_APP_SURFACE` (and their `_DARK` counterparts) are injected at
runtime as the CSS custom properties `--app-bg` and `--app-surface`, which every app-level
background is defined in terms of. A third token, `--app-surface-muted`, backs hover states. To
recolour a deployment, set the variables and restart — no rebuild:

```env
PUBLIC_APP_BACKGROUND="#f4faf8"
PUBLIC_APP_SURFACE="#e6f2ee"
```

> [!IMPORTANT]
> Quote any value starting with `#`. Unquoted, dotenv treats the `#` as the start of a comment and the variable comes through empty — the app silently keeps its default colours. `rgb(244, 250, 248)` and a bare `244 250 248` need no quoting.

An unparseable value is ignored and the defaults stay in place. Note that `PUBLIC_APP_COLOR` — the
accent colour — is _not_ runtime-configurable; changing it requires a rebuild.

### Embedding in an iframe

When the app is framed by another site, its session cookie is a third-party cookie. Safari, Brave,
and Chrome-with-third-party-cookies-blocked drop it, and without it the app cannot keep a session:
the disclaimer gate rejects every message with a 405, and conversations created under one request
are unreadable on the next.

Mitigations, most to least effective:

1. **Serve the app from a subdomain of the host site** via a reverse proxy. The cookie becomes
   first-party and works in every browser. This is the only fix that covers Safari.
2. **Link visitors to the direct app URL** rather than to a page that frames it. On Hugging Face,
   `https://<owner>-<space>.hf.space` is a top-level, first-party context;
   `https://huggingface.co/spaces/<owner>/<space>` is always an iframe.
3. **Partitioned cookies (CHIPS)** are on by default whenever the cookie is `SameSite=None; Secure`,
   which keeps Chrome and Firefox working inside the frame. Set `COOKIE_PARTITIONED=false` to opt
   out. Safari does not implement CHIPS.

When the session cookie does not survive, the app detects it on load and shows a persistent banner
offering to open itself in a new tab, rather than failing silently later.
