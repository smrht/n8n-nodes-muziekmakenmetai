import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { MuziekMakenMetAiTrigger } = require('../dist/nodes/MuziekMakenMetAiTrigger/MuziekMakenMetAiTrigger.node.js');
const { computeWebhookSignature } = require('../dist/nodes/MuziekMakenMetAiTrigger/webhook-signature.js');
const secret = 'synthetic-header-regression-test';
const timestamp = String(Math.floor(Date.now() / 1000));
const body = { id: 'body-id', type: 'music.generation.succeeded', data: { id: 'generation-id', status: 'succeeded', tracks: [] } };
const rawBody = Buffer.from(JSON.stringify(body));
const signature = computeWebhookSignature(secret, timestamp, rawBody);
function context(headers, raw = rawBody) {
 return {
  getWorkflowStaticData: () => ({ webhookSigningSecret: secret }),
  getHeaderData: () => headers,
  getRequestObject: () => ({ rawBody: raw }),
  getBodyData: () => body,
  getNode: () => ({ id: 'test', name: 'test', type: 'test', typeVersion: 1, position: [0, 0] }),
  helpers: { returnJsonArray: values => (Array.isArray(values) ? values : [values]).map(json => ({ json })) },
 };
}
const headers = { 'x-mmmai-timestamp': timestamp, 'x-mmmai-signature': signature, 'x-mmmai-event': 'header-event-id' };
const result = await new MuziekMakenMetAiTrigger().webhook.call(context(headers));
assert.equal(result.workflowData[0][0].json.event_id, 'header-event-id');
await assert.rejects(() => new MuziekMakenMetAiTrigger().webhook.call(context(headers, Buffer.from('tampered'))), /Invalid webhook signature/);
await assert.rejects(() => new MuziekMakenMetAiTrigger().webhook.call(context({ ...headers, 'x-mmmai-signature': 'sha256=wrong' })), /Invalid webhook signature/);
await assert.rejects(() => new MuziekMakenMetAiTrigger().webhook.call(context({ 'x-mmai-timestamp': timestamp, 'x-mmai-signature': signature })), /Invalid webhook signature/);
console.log('PASS API header event accepted; tampered body, wrong signature and wrong header names rejected');
