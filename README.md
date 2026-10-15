# Muziek maken met AI n8n nodes

Community nodes for [n8n](https://n8n.io) that connect to the [MuziekMakenMetAI Developer API](https://muziekmakenmetai.nl/developers/):

- **Muziek maken met AI**: generate songs, look up finished generations and read your credit balance.
- **Muziek maken met AI Trigger**: start a workflow when a song generation finishes (webhook).

The API produces original songs and stores the results. Each song generation costs **1 credit**, regardless of the model.

## Installation

1. In n8n, go to **Settings → Community Nodes**.
2. Select **Install a community node**.
3. Enter the package name: `n8n-nodes-muziekmakenmetai`.
4. Confirm the install and reload the canvas.

n8n installs the package from npm. Community nodes are available on self-hosted n8n instances.

## Getting an API key

1. Log in at [muziekmakenmetai.nl](https://muziekmakenmetai.nl) and open the [developer portal](https://muziekmakenmetai.nl/developers/portal/).
2. Create a new API key. Give it the scopes you need: `music:generate`, `music:read` and/or `webhooks:write`.
3. Copy the key once and paste it into the **Muziek maken met AI API** credential in n8n.

## Credential

**Muziek Maken Met AI API**: paste your API key. The node sends it as a Bearer token and tests it against your account balance.

## Node: Muziek maken met AI

### Song → Create

Starts a generation with `POST /music/generations/`. Every generation costs 1 credit.

- **Prompt** (required): music description in standard mode (max 500 characters), or the full song lyrics when Custom Mode is on (max 5,000 characters).
- **Wait for Completion** (in Additional Fields, default on): polls the generation every 10 seconds for up to 6 minutes and returns the final result, including the audio URLs in `tracks`. If the song is still processing after 6 minutes, the node returns the latest known status instead; fetch the result later with **Song → Get**.
- **Additional fields**: model (`music-v1`, `music-v1-pro`, `music-v2`, `music-v2-mini`, `music-v2-wild`), Custom Mode, Instrumental, Style, Title, Language (Dutch, English or German), Vocal Gender, Style Weight, Creativity, Audio Weight, Duration, Variety, Negative Tags, Persona ID and Persona Type. Most of these only apply in Custom Mode; the node validates that before calling the API.

The node returns the generation object: `id`, `status` (`queued`, `processing`, `succeeded`, `failed`), `model`, `created_at`, `completed_at` and, on success, `tracks` with `audio_url` and `image_url`.

### Song → Get

Fetches one generation by ID with its current status and audio files.

### Account → Get

Returns your credit balance: `credits`, `api_credits`, `song_credits`, `webhook_configured` and `requests_per_minute`.

## Node: Muziek maken met AI Trigger

Registers the workflow's production webhook URL with `PUT /webhook/` when the workflow is activated, stores the returned signing secret and verifies the HMAC-SHA256 signature on every incoming event (`X-MMMAI-Signature`).

- Emits one item per terminal event: `music.generation.succeeded` or `music.generation.failed`. The item contains the generation object plus `event_id` and `event_type`.
- Your API key has a **single webhook**: activating this node replaces any webhook URL registered earlier on that key. Deactivating the workflow unregisters the webhook again (the API clears it), so events stop until you activate another workflow.
- Events carry a unique `event_id`; the API retries deliveries, so deduplicate on that ID if your workflow must not run twice.
- Testing the trigger in the editor (test webhook) requires that the workflow has been activated at least once, so the signing secret is stored.

## Documentation

Full API reference: [muziekmakenmetai.nl/developers](https://muziekmakenmetai.nl/developers/).

## License

[MIT](LICENSE.md)
