export type HealthPayload = Readonly<{ status: 'ok' }>;

export function healthPayload(): HealthPayload {
	return { status: 'ok' };
}
