# Changelog

## 0.2.1

- Trigger: read the actual X-MMMAI-Timestamp, X-MMMAI-Signature and X-MMMAI-Event API headers so correctly signed completion events are accepted.
- Regression test covers a valid signed event, altered body, wrong signature and wrong header names.

## 0.2.0

- Trigger: removing the webhook now also clears the stored signing secret from the workflow static data.
- Song Create: Language is now a list with English labels (Dutch, English, German); the API still receives the same values.
- Song Create: Wait for Completion moved into Additional Fields (still on by default).

## 0.1.0

- Initial release: `Muziek maken met AI` node (Song Create/Get, Account Get) and `Muziek maken met AI Trigger` node with signature verification.
