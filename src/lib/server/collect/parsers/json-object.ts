export type JsonObjectResult =
	| { readonly ok: true; readonly value: Record<string, unknown> }
	| { readonly ok: false; readonly error: string };

export const MAX_PAYLOAD_BYTES = 1_048_576;

export function parseJsonObject(input: unknown, label: string): JsonObjectResult {
	let value = input;
	if (typeof input === 'string') {
		if (Buffer.byteLength(input, 'utf8') > MAX_PAYLOAD_BYTES) {
			return { ok: false, error: `${label} exceeds the 1 MiB payload limit` };
		}
		try {
			value = JSON.parse(input) as unknown;
		} catch {
			return { ok: false, error: `${label} is not valid JSON` };
		}
	}
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return { ok: false, error: `${label} must be a JSON object` };
	}
	return { ok: true, value: value as Record<string, unknown> };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
