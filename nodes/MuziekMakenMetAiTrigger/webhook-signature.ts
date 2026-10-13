import { createHmac, timingSafeEqual } from 'node:crypto';

export const SIGNATURE_PREFIX = 'sha256=';

/**
 * Mirrors the server-side algorithm: HMAC-SHA256 over `<timestamp>.<exact raw body>`,
 * hex-encoded and prefixed with `sha256=`.
 */
export function computeWebhookSignature(secret: string, timestamp: string, rawBody: Buffer): string {
	const message = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawBody]);
	return `${SIGNATURE_PREFIX}${createHmac('sha256', secret).update(message).digest('hex')}`;
}

export function verifyWebhookSignature(
	secret: string | undefined,
	timestamp: string | string[] | undefined,
	signatureHeader: string | string[] | undefined,
	rawBody: Buffer | undefined,
): boolean {
	if (!secret || !rawBody) {
		return false;
	}
	const timestampValue = firstValue(timestamp);
	const signatureValue = firstValue(signatureHeader);
	if (!timestampValue || !signatureValue) {
		return false;
	}
	const expected = Buffer.from(computeWebhookSignature(secret, timestampValue, rawBody), 'utf8');
	const received = Buffer.from(signatureValue.trim(), 'utf8');
	if (expected.length !== received.length) {
		return false;
	}
	return timingSafeEqual(expected, received);
}

function firstValue(value: string | string[] | undefined): string | undefined {
	if (Array.isArray(value)) {
		return value[0];
	}
	return value;
}
