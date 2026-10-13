import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { computeWebhookSignature, verifyWebhookSignature } = require('../dist/nodes/MuziekMakenMetAiTrigger/webhook-signature.js');

// Serializes like the server: Python json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).
function pythonJsonDump(value) {
	if (Array.isArray(value)) {
		return `[${value.map(pythonJsonDump).join(',')}]`;
	}
	if (value !== null && typeof value === 'object') {
		const entries = Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${pythonJsonDump(value[key])}`);
		return `{${entries.join(',')}}`;
	}
	return JSON.stringify(value);
}

const secret = 'unit-test-secret';
const timestamp = String(Math.floor(Date.now() / 1000));
const event = {
	id: '5f0d3d29-9d92-4f8e-a4d4-9d92f8e0d3d2',
	type: 'music.generation.succeeded',
	data: {
		id: 'b6f0f0aa-1111-2222-3333-444455556666',
		object: 'music_generation',
		status: 'succeeded',
		model: 'music-v1',
		created_at: '2026-10-13T12:00:00+00:00',
		completed_at: '2026-10-13T12:01:30+00:00',
		tracks: [
			{
				id: '42',
				title: 'Testtrack',
				duration_seconds: 84,
				audio_url: 'https://muziekmakenmetai.nl/media/test.mp3',
				image_url: null,
			},
		],
	},
};

const rawBody = Buffer.from(pythonJsonDump(event), 'utf8');
const signature = `sha256=${createHmac('sha256', secret).update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawBody])).digest('hex')}`;

let failures = 0;
function check(name, actual, expected) {
	const ok = actual === expected;
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
}

// 1. Correct signature computed the same way the server does.
check('valid signature is accepted', verifyWebhookSignature(secret, timestamp, signature, rawBody), true);

// 2. computeWebhookSignature matches the server algorithm byte for byte.
check('computeWebhookSignature matches server algorithm', computeWebhookSignature(secret, timestamp, rawBody), signature);

// 3. Tampered body must fail.
check('tampered body is rejected', verifyWebhookSignature(secret, timestamp, signature, Buffer.from(rawBody.toString('utf8').replace('succeeded', 'failed'))), false);

// 4. Wrong secret must fail.
check('wrong secret is rejected', verifyWebhookSignature('other-secret', timestamp, signature, rawBody), false);

// 5. Wrong timestamp must fail.
check('wrong timestamp is rejected', verifyWebhookSignature(secret, '123', signature, rawBody), false);

// 6. Missing pieces must fail.
check('missing timestamp is rejected', verifyWebhookSignature(secret, undefined, signature, rawBody), false);
check('missing signature is rejected', verifyWebhookSignature(secret, timestamp, undefined, rawBody), false);
check('missing body is rejected', verifyWebhookSignature(secret, timestamp, signature, undefined), false);

// 7. Signature without the sha256= prefix has a different length and must fail.
check('signature without prefix is rejected', verifyWebhookSignature(secret, timestamp, signature.replace('sha256=', ''), rawBody), false);

process.exit(failures ? 1 : 0);
