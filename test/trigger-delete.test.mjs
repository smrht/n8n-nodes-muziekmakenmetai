import test from 'node:test'; import assert from 'node:assert';
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const { MuziekMakenMetAiTrigger } = require('../dist/nodes/MuziekMakenMetAiTrigger/MuziekMakenMetAiTrigger.node.js');
test('delete clears both keys', async () => {
  const sd = { webhookUrl: 'https://x/hook', webhookSigningSecret: 'whsec_test' };
  const ctx = { getMode: () => 'trigger', getWorkflowStaticData: () => sd,
    helpers: { httpRequest: async () => ({}), httpRequestWithAuthentication: async () => ({}) , requestWithAuthentication: async () => ({}) },
    getCredentials: async () => ({ apiKey: 'x', baseUrl: 'https://muziekmakenmetai.nl' }), getNode: () => ({ name: 't' }) };
  const node = new MuziekMakenMetAiTrigger();
  await node.webhookMethods.default.delete.call(ctx);
  assert.deepStrictEqual(Object.keys(sd), []);
});
