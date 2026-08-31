# Chat UI - ChaBo Integration

**This is a modified version of [HuggingFace Chat UI](https://github.com/huggingface/chat-ui) integrated with the ChaBo RAG framework.**

A chat interface designed to work with **ChaBo**, a RAG (Retrieval-Augmented Generation) orchestrator built with FastAPI, LangChain, and LangGraph. ChaBo orchestrates embedding, vector search (Qdrant), reranking, and LLM generation to answer queries using retrieved context.

This modified version includes:

- **File Upload Support**: GeoJSON and other multimodal file types with auto-submission
- **RAG Integration**: Direct connection to ChaBo's LangServe streaming endpoints
- **Model Instructions**: Display custom instructions per model configuration
- **Source Citations**: Render and display sources from RAG responses as hyperlinks
- **Streamlined UI**: Simplified interface focused on RAG workflow
- **File Lifecycle Management**: Automatic cleanup of uploaded files after processing

For the original Chat UI documentation, see [hf.co/docs/chat-ui](https://huggingface.co/docs/chat-ui/index).

## Table of Contents

0. [ChaBo Integration Setup](#chabo-integration-setup) ⭐ **Start Here for ChaBo**
1. [Setup](#setup)
2. [Extra parameters](#extra-parameters)
3. [Common issues](#common-issues)
4. [Deploying to a HF Space](#deploying-to-a-hf-space)
5. [Building](#building)

---

## ChaBo Integration Setup

This section explains how to configure Chat UI to work with ChaBo, a RAG (Retrieval-Augmented Generation) orchestrator.

### What is ChaBo?

ChaBo is a FastAPI-based RAG orchestrator that handles:

- **Embedding**: Convert queries and documents into vectors using HuggingFace endpoints
- **Vector Search**: Retrieve relevant documents from Qdrant vector database
- **Reranking**: Improve relevance of retrieved documents using HuggingFace rerankers
- **Generation**: Generate responses using multiple LLM providers (HuggingFace, OpenAI, Anthropic, Cohere)

**Pipeline Flow:** Query → Embed → Search → Rerank → Generate (with citations)

### Prerequisites

1. **ChaBo Backend**: A running ChaBo instance (see [ChaBo README](https://github.com/ChaBo-Project/chabo) for setup)
2. **MongoDB**: For storing chat history
3. **HF Token** (optional): Required if your ChaBo instance is a private Hugging Face Space

### Configuration for ChaBo

Create a `.env.local` file with the following configuration:

```bash
# Required: MongoDB for chat history
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=chabo-chatui

# Recommended: unique per co-hosted instance — see COOKIE_NAME under Theming
COOKIE_NAME=chabo-chatui

# Required: ChaBo model configuration
MODELS=`[
  {
    "name": "chabo-rag-assistant",
    "displayName": "ChaBo RAG Assistant",
    "description": "Retrieval-augmented generation powered by ChaBo.",
    "instructions": {
      "title": "How to Use",
      "content": "Upload files or ask questions. The system will search relevant documents and provide cited answers.\n\n**Tip:** Upload GeoJSON files for spatial analysis or text files for document-based queries."
    },
    "modelUrl": "https://github.com/your-org/chabo",
    "datasetUrl": "https://github.com/your-org/chabo",
    "websiteUrl": "https://github.com/your-org",
    "chaboUrl": "https://github.com/ChaBo-Project",
    "multimodal": false,
    "multimodalAcceptedMimetypes": [
      "application/geojson",
      "text/plain"
    ],
    "chatPromptTemplate": "{{#each messages}}{{#ifUser}}{{content}}{{/ifUser}}{{#ifAssistant}}{{content}}{{/ifAssistant}}{{/each}}",
    "parameters": {
      "temperature": 0.0,
      "max_new_tokens": 2048
    },
    "endpoints": [{
      "type": "langserve-streaming",
      "url": "http://chabo:7860/chatfed-ui-stream",
      "streamingFileUploadUrl": "http://chabo:7860/chatfed-with-file-stream",
      "inputKey": "text",
      "fileInputKey": "files"
    }]
  }
]`

# Optional: HF token for private ChaBo spaces
HF_TOKEN=hf_your_token_here

# Optional: Disable LLM-based title generation (recommended for ChaBo)
LLM_SUMMARIZATION=false

# Optional: Disable assistants feature
ENABLE_ASSISTANTS=false
ENABLE_ASSISTANTS_RAG=false
COMMUNITY_TOOLS=false

# Optional: Customize app appearance
PUBLIC_APP_NAME="ChaBo Assistant"
PUBLIC_APP_DESCRIPTION="RAG-powered question answering with cited sources"
PUBLIC_APP_DISCLAIMER=1
PUBLIC_APP_DISCLAIMER_MESSAGE="Disclaimer: AI is an area of active research with known problems such as hallucination and misinformation. Use this application with caution."

# Optional: Add announcement banner
PUBLIC_ANNOUNCEMENT_BANNERS=`[
  {
    "title": "RAG-powered assistant using ChaBo. Learn more: ",
    "linkTitle": "Documentation",
    "linkHref": "https://github.com/your-org/chabo"
  }
]`
```

Minimal starting config, not the full list — theming, usage limits, admin, and metrics vars are
documented separately under [Extra parameters](#extra-parameters).

### Key Configuration Fields for ChaBo

#### Model Instructions (`instructions`)

Display custom usage instructions to users when they start a conversation:

```json
"instructions": {
  "title": "How to Use",
  "content": "Your instructions here...\n\nSupports line breaks."
}
```

#### Multimodal File Upload (`multimodal`, `multimodalAcceptedMimetypes`)

Enable file uploads with specific MIME types:

```json
"multimodal": true,
"multimodalAcceptedMimetypes": [
  "application/geojson",
  "text/plain",
  "application/pdf"
]
```

The upload button will automatically display accepted file types to users.

#### Model, Dataset & Project Links (`modelUrl`, `datasetUrl`, `websiteUrl`, `chaboUrl`)

Render as clickable links on each card at `/models`. `modelUrl`/`datasetUrl`/`websiteUrl` are
instance-specific (this deployment's own docs); `chaboUrl` is a constant link back to the ChaBo
project, the same for every instance.

#### LangServe Streaming Endpoints

ChaBo uses LangServe for streaming responses:

```json
"endpoints": [{
  "type": "langserve-streaming",
  "url": "http://chabo:7860/chatfed-ui-stream",           // Text-only queries
  "streamingFileUploadUrl": "http://chabo:7860/chatfed-with-file-stream",  // Queries with files
  "inputKey": "text",        // Key for text input
  "fileInputKey": "files"    // Key for file uploads
}]
```

### Authentication for Private ChaBo Spaces

If your ChaBo instance is hosted as a private Hugging Face Space, set the `HF_TOKEN` environment variable:

```bash
# In .env.local
HF_TOKEN=hf_your_token_here
```

Alternatively, you can specify the token in the endpoint configuration:

```json
"endpoints": [{
  "type": "langserve-streaming",
  "url": "https://your-username-chabo.hf.space/chatfed-ui-stream",
  "accessToken": "hf_your_token_here"
}]
```

Make sure your ChaBo backend is accessible at the URL specified in `endpoints.url` before
starting Chat UI, then follow [Setup](#setup) below to install MongoDB and launch it.

### File Upload Workflow

1. User clicks the upload button (shows accepted file types)
2. User selects a file
3. File is automatically submitted (no need to type a prompt)
4. ChaBo processes the file and generates a response with citations
5. Files are automatically cleaned up after processing

### Source Citations

Responses from ChaBo include source citations that are automatically rendered as:

- **Clickable hyperlinks** for web sources (HTTP/HTTPS URLs)
- **Citation numbers** matching inline references in the response text
- **Source metadata** (title, page numbers, etc.)

---

---

## Setup

To deploy an actual ChaBo instance, use [ChaBo-Deploy](https://github.com/ChaBo-Project/ChaBo-Deploy)
— the deployment topology (Dockerfiles, HF Spaces, and `docker-compose`) lives there, not
in this repo. ChaBo-ChatUI is the optional `chatui` component in both supported
topologies:

- [`hf-spaces/README.md`](https://github.com/ChaBo-Project/ChaBo-Deploy/blob/main/hf-spaces/README.md) — three independent single-service Hugging Face Spaces (orchestrator/qdrant/chatui).
- [`compose/README.md`](https://github.com/ChaBo-Project/ChaBo-Deploy/blob/main/compose/README.md) — a single-VM `docker-compose` stack, the reference topology for adopters.

### Local development / running outside of ChaBo

This isn't the ChaBo path above — it's generic Chat UI setup, for local development on
this fork or for running it standalone against a different backend.

The default config for Chat UI is stored in the `.env` file. You will need to override
some values to get Chat UI to run locally. This is done in `.env.local`.

Start by creating a `.env.local` file in the root of the repository. The bare minimum
config you need to get Chat UI to run locally is the following:

```env
MONGODB_URL=<the URL to your MongoDB instance>
HF_TOKEN=<your access token>
```

#### Database

The chat history is stored in a MongoDB instance, and having a DB instance available is needed for Chat UI to work.

You can use a local MongoDB instance. The easiest way is to spin one up using docker:

```bash
docker run -d -p 27017:27017 --name mongo-chatui mongo:latest
```

In which case the url of your DB will be `MONGODB_URL=mongodb://localhost:27017`.

Alternatively, you can use a [free MongoDB Atlas](https://www.mongodb.com/pricing) instance for this, Chat UI should fit comfortably within their free tier. After which you can set the `MONGODB_URL` variable in `.env.local` to match your instance.

Two related optional vars: `MONGODB_DB_NAME` (default `chat-ui`; ChaBo sets `chabo-chatui`; only
matters sharing a cluster) and `MONGODB_DIRECT_CONNECTION` (only for a bare standalone `mongod`
with no replica set). Self-hosted Mongo auth goes inline in `MONGODB_URL`
(`mongodb://user:pass@host:27017/?authSource=admin`) — no separate credential var.

#### Hugging Face Access Token

If you use a remote inference endpoint, you will need a Hugging Face access token to run Chat UI locally. You can get one from [your Hugging Face profile](https://huggingface.co/settings/tokens).

#### Launch

After you're done with the `.env.local` file you can run Chat UI locally with:

```bash
npm install
npm run dev
```

## Extra parameters

### Theming

Chat UI's appearance is driven by environment variables. The single most important thing to know
is **when** each one applies:

- **Runtime** variables are read on every request. Change them in `.env.local` (or in a Space's
  `DOTENV_LOCAL` secret), restart the app, and the change takes effect.
- **Build time** variables are baked into the compiled CSS/JS. Setting them in `.env.local` or
  `DOTENV_LOCAL` does **nothing** — the app has to be rebuilt with the variable present in the
  build environment (for Docker, passed as a build `ARG`).

| Variable                                                 | Applies                               | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_APP_NAME`                                        | runtime                               | Page title, `og:title`, logo alt text, web app manifest name.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `PUBLIC_APP_DESCRIPTION`                                 | runtime                               | `og:description`, the `description` meta tag, the intro screen and the modals.                                                                                                                                                                                                                                                                                                                                                                                               |
| `PUBLIC_APP_ASSETS`                                      | runtime lookup, assets are build time | Logos & favicons are read from `static/$PUBLIC_APP_ASSETS/`. The path is resolved at runtime, but the files themselves must already be baked into the image. Bundled options are `chatui`, `huggingchat`, and `chabo-official`.                                                                                                                                                                                                                                              |
| `PUBLIC_APP_COLOR`                                       | **build time only**                   | The accent colour. Consumed by `tailwind.config.cjs`, so it is compiled into the stylesheet; `Dockerfile` passes it as a build `ARG`. **Setting it in `DOTENV_LOCAL` has no effect.** It only affects five class sites: `icons/Logo.svelte`, `LoginModal.svelte`, `DisclaimerModal.svelte`, `ChatWindow.svelte`, `ModelThumbnail.svelte` (per-model `og:image`). Can be any of the [tailwind colors](https://tailwindcss.com/docs/customizing-colors#default-color-palette). |
| `PUBLIC_APP_BACKGROUND`                                  | runtime                               | Light-mode page background. Accepts `#rrggbb`, `#rgb`, `rgb(r, g, b)` or a bare `r g b` triplet. **Quote hex values** — see the note below. Defaults to white.                                                                                                                                                                                                                                                                                                               |
| `PUBLIC_APP_SURFACE`                                     | runtime                               | Light-mode secondary surface — sidebar gradient, mobile nav bar. Defaults to `gray-50`.                                                                                                                                                                                                                                                                                                                                                                                      |
| `PUBLIC_APP_BACKGROUND_DARK`                             | runtime                               | Dark-mode page background. Defaults to `gray-900`.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `PUBLIC_APP_SURFACE_DARK`                                | runtime                               | Dark-mode secondary surface. Defaults to `gray-800`.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `PUBLIC_ANNOUNCEMENT_BANNERS`                            | runtime                               | JSON5 array of `{ title, linkTitle, linkHref }`; renders the pill above the chat intro.                                                                                                                                                                                                                                                                                                                                                                                      |
| `PUBLIC_APP_DISCLAIMER`                                  | runtime                               | Set to `1` to show the disclaimer modal on load. **Also arms a server-side gate**: with it on, every non-GET request outside `/settings`, `/login` and `/admin` is rejected with `405 You need to accept the welcome modal first` until the current session has accepted the modal. That makes it a hard dependency on a working session cookie — see [Embedding in an iframe](#embedding-in-an-iframe).                                                                     |
| `PUBLIC_APP_DISCLAIMER_MESSAGE`                          | runtime                               | Body text of that modal.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `PUBLIC_APP_ISSUE_URL`                                   | runtime                               | URL for reporting issues / privacy-rights requests, shown on the `/privacy` page.                                                                                                                                                                                                                                                                                                                                                                                            |
| `PUBLIC_APP_PRIVACY_EMAIL`                               | runtime                               | Contact email for privacy-rights requests, shown on the `/privacy` page. Optional — the line is omitted entirely if both this and `PUBLIC_APP_ISSUE_URL` are unset.                                                                                                                                                                                                                                                                                                         |
| `PUBLIC_APP_DATA_SHARING`                                | runtime                               | Set to `1` to add a settings toggle letting users opt in to data sharing with the model creator.                                                                                                                                                                                                                                                                                                                                                                             |
| `PUBLIC_APP_GUEST_MESSAGE`                               | runtime                               | Shown in the login modal when guest mode is enabled.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `PUBLIC_SMOOTH_UPDATES`                                  | runtime                               | Set to `true` to stream tokens with smoothing.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `PUBLIC_ORIGIN`                                          | runtime                               | The app's canonical public URL. Used for absolute `og:`/icon URLs, as an allowed POST origin, and as the "open in a new tab" target when cookies are blocked. **Leaving it empty renders a broken `undefined/` link in the sidebar** — set it.                                                                                                                                                                                                                               |
| `PUBLIC_SHARE_PREFIX`                                    | runtime                               | URL prefix used when sharing a conversation.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `APP_BASE`                                               | **build time**                        | Base path the app is served under (`svelte.config.js`).                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ALLOW_IFRAME`                                           | runtime                               | Anything other than `"true"` makes the server append `Content-Security-Policy: frame-ancestors 'none'`, which blocks embedding outright.                                                                                                                                                                                                                                                                                                                                     |
| `COOKIE_SAMESITE`, `COOKIE_SECURE`, `COOKIE_PARTITIONED` | runtime                               | Session cookie attributes — see below.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `COOKIE_NAME`                                            | runtime                               | Default `hf-chat`; ChaBo sets `chabo-chatui`. `path` is always `/`, not scoped to `APP_BASE` — use a unique value per instance if co-hosting behind the same hostname, or sessions will overwrite each other's cookie.                                                                                                                                                                                                                                                       |

#### Theme selection

The app follows the visitor's OS `prefers-color-scheme` by default. Two things override it:

- The **Theme** button in the sidebar, which stores the choice in `localStorage`.
- A **`?__theme=light`** or **`?__theme=dark`** URL parameter, which wins over both and is then
  remembered. This is the practical way for an embedder to pin the theme:

  ```html
  <iframe src="https://your-space.hf.space/?__theme=light"></iframe>
  ```

  Without it, an embedded chat renders dark for any visitor whose OS is set to dark, regardless of
  the host page — the usual cause of a colour clash in an embed.

#### Matching a host page's colours

`PUBLIC_APP_BACKGROUND` / `PUBLIC_APP_SURFACE` (and their `_DARK` counterparts) are injected at
runtime as the CSS custom properties `--app-bg` and `--app-surface`, which every app-level
background is defined in terms of. Hover states reuse `--app-surface` at reduced opacity
(`bg-app-surface/70`) rather than a separate token, so they follow the same theme. To recolour a
deployment, set the variables and restart — no rebuild:

```env
PUBLIC_APP_BACKGROUND="#f4faf8"
PUBLIC_APP_SURFACE="#e6f2ee"
```

> [!IMPORTANT]
> Quote any value starting with `#`. Unquoted, dotenv treats the `#` as the start of a comment and the variable comes through empty — the app silently keeps its default colours. `rgb(244, 250, 248)` and a bare `244 250 248` need no quoting.

An unparseable value is ignored and the defaults stay in place. Note that `PUBLIC_APP_COLOR` — the
accent colour — is _not_ runtime-configurable; changing it requires a rebuild.

#### Embedding in an iframe

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

### Custom models

For ChaBo deployments, **the underlying LLM provider and model are chosen inside ChaBo
Orchestrator, not in Chat UI's `MODELS` variable.** ChaBo picks its provider (HuggingFace,
OpenAI, Anthropic, Cohere, or Azure OpenAI) and model via its own `params.cfg` `[generator]`
section (`PROVIDER` / `MODEL`, plus per-provider fields) — see the
[ChaBo README](https://github.com/ChaBo-Project/chabo) for the full set of providers/models and
how to configure or switch between them. Chat UI never talks to those providers directly in a
ChaBo deployment; it only ever calls ChaBo Orchestrator's `langserve-streaming` API, which
internally runs the embed → search → rerank → generate pipeline and returns the result.

What "custom model" means from Chat UI's side is: **add another `MODELS` entry pointed at a
different ChaBo Orchestrator instance**, following the exact same shape as the example in
[Configuration for ChaBo](#configuration-for-chabo) above — same
`"type": "langserve-streaming"`, with `url` / `streamingFileUploadUrl` pointed at that
instance's `/chatfed-ui-stream` and `/chatfed-with-file-stream` routes. Adding several entries,
each pointed at its own orchestrator instance, is how you offer visitors a choice between
differently-configured ChaBo deployments (different retrieval collections, guardrail settings,
or underlying LLMs) from the same Chat UI — `name`, `displayName`, `instructions`, and
`multimodal`/`multimodalAcceptedMimetypes` can all differ per entry, same as any other field in
[Key Configuration Fields for ChaBo](#key-configuration-fields-for-chabo) above.

#### chatPromptTemplate

`chatPromptTemplate` still applies to a `langserve-streaming` model: it renders the conversation
into the `text` input key sent for backward compatibility, alongside the structured `messages`
array ChaBo Orchestrator actually uses for generation. The minimal pass-through template in the
ChaBo example above (`{{content}}` per message, no extra formatting) is normally all you need —
only change it if your orchestrator's `/chatfed-ui-stream` route expects a differently-formatted
`text` field. `messages` has the format `[{ content: string }, ...]`; `ifUser` / `ifAssistant`
block helpers identify which side a message is from.

#### Bypassing ChaBo — direct provider endpoints

This fork keeps the full set of provider integrations from upstream chat-ui (the SDKs are still
in `package.json`: OpenAI, Anthropic, AWS Bedrock/SageMaker, Google Vertex, Cohere, TGI, and
more), so a `MODELS` entry can point directly at a provider or a self-hosted inference server
instead of at ChaBo Orchestrator, if you want Chat UI to skip the RAG pipeline entirely for that
model. One example, OpenAI-compatible servers (also covers self-hosted options like
text-generation-webui, LocalAI, vLLM):

```env
MODELS=`[
  {
    "name": "text-generation-webui",
    "id": "text-generation-webui",
    "parameters": {
      "temperature": 0.9,
      "top_p": 0.95,
      "max_new_tokens": 1024,
      "stop": []
    },
    "endpoints": [{
      "type" : "openai",
      "baseURL": "http://localhost:8000/v1"
    }]
  }
]`
```

For the rest — Anthropic, Amazon, Cloudflare Workers AI, Cohere, Google Vertex, Ollama,
llama.cpp, TGI, custom-endpoint auth (Basic/Bearer/mTLS), weighted multi-endpoint setups, and
embedding-model selection — see upstream's full configuration reference:
[hf.co/docs/chat-ui/configuration/models/overview](https://huggingface.co/docs/chat-ui/configuration/models/overview).

### Usage limits & admin

`EXPOSE_API` (default `true`) gates the whole `/api/*` REST surface — `403` when off. The chat UI
itself never calls `/api/*`, so this only affects external/scripted access.

`USAGE_LIMITS` (JSON5, all fields optional, unset = unlimited) protects a publicly-embedded,
cost-bearing RAG endpoint from abuse:

```env
USAGE_LIMITS=`{ "messagesPerMinute": 10, "messages": 50, "messageLength": 2000, "conversations": 20 }`
```

`messagesPerMinute` uses a sliding 60s window checked _before_ the current request, so `N` actually
allows `N+1` through before the `N+2`th is blocked. `BODY_SIZE_LIMIT` (default 15MB) caps total
request size — file uploads separately have their own hardcoded 10MB-per-file cap, not
configurable here.

`ADMIN_API_SECRET` gates `/admin/*` (usage stats, parquet export) behind
`Authorization: Bearer <secret>`. `PARQUET_EXPORT_DATASET`/`PARQUET_EXPORT_HF_TOKEN` configure
where exports upload to.

### Metrics

`METRICS_ENABLED=true` exposes Prometheus-format metrics (latency, tokens, conversations) at
`/metrics` on `METRICS_PORT` (default 5565) — a **separate** server, its own port. Optional
`METRICS_SECRET` requires `Authorization: Bearer <secret>`, else it's open.

> [!IMPORTANT]
> HF Spaces only expose one port (`app_port`), so `METRICS_PORT` isn't externally reachable there
> unless you route it yourself. Works out of the box in `compose`, where you control port publishing.

## Common issues

### 403：You don't have access to this conversation

Most likely you are running chat-ui over HTTP. The recommended option is to setup something like NGINX to handle HTTPS and proxy the requests to chat-ui. If you really need to run over HTTP you can add `ALLOW_INSECURE_COOKIES=true` to your `.env.local`.

Make sure to set your `PUBLIC_ORIGIN` in your `.env.local` to the correct URL as well.

## Deploying to a HF Space

Create a `DOTENV_LOCAL` secret to your HF space with the content of your .env.local, and they will be picked up automatically when you run.

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.

## Populate database

> [!WARNING]
> The `MONGODB_URL` used for this script will be fetched from `.env.local`. Make sure it's correct! The command runs directly on the database.

You can populate the database using faker data using the `populate` script:

```bash
npm run populate <flags here>
```

At least one flag must be specified, the following flags are available:

- `reset` - resets the database
- `all` - populates all tables
- `users` - populates the users table
- `settings` - populates the settings table for existing users
- `assistants` - populates the assistants table for existing users
- `conversations` - populates the conversations table for existing users
- `tools` - populates the community tools table

For example, you could use it like so:

```bash
npm run populate reset
```

to clear out the database. Then login in the app to create your user and run the following command:

```bash
npm run populate users settings assistants conversations
```

to populate the database with fake data, including fake conversations and assistants for your user.

## Untested upstream features

The following are inherited from upstream chat-ui and still functional in this fork's code, but
are not currently used or tested in any ChaBo deployment. If you rely on one, test it
independently before trusting it in production.

### OpenID connect

The login feature is disabled by default and users are attributed a unique ID based on their browser. But if you want to use OpenID to authenticate your users, you can add the following to your `.env.local` file:

```env
OPENID_CONFIG=`{
  PROVIDER_URL: "<your OIDC issuer>",
  CLIENT_ID: "<your OIDC client ID>",
  CLIENT_SECRET: "<your OIDC client secret>",
  SCOPES: "openid profile",
  TOLERANCE: // optional
  RESOURCE: // optional
}`
```

These variables will enable the openID sign-in modal for users.

### Trusted header authentication

You can set the env variable `TRUSTED_EMAIL_HEADER` to point to the header that contains the user's email address. This will allow you to authenticate users from the header. This setup is usually combined with a proxy that will be in front of chat-ui and will handle the auth and set the header.

> [!WARNING]
> Make sure to only allow requests to chat-ui through your proxy which handles authentication, otherwise users could authenticate as anyone by setting the header manually! Only set this up if you understand the implications and know how to do it correctly.

Here is a list of header names for common auth providers:

- Tailscale Serve: `Tailscale-User-Login`
- Cloudflare Access: `Cf-Access-Authenticated-User-Email`
- oauth2-proxy: `X-Forwarded-Email`
