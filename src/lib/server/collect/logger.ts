import type { Logger } from './types.js';

const FORBIDDEN_KEYS = new Set([
	'api_key',
	'token',
	'secret',
	'password',
	'authorization',
	'cookie',
	'set_cookie'
]);

export interface LoggerOptions {
	readonly sink?: (event: Record<string, unknown>) => void;
	readonly clock?: () => Date;
}

function sanitize(event: Record<string, unknown>): Record<string, unknown> {
	const clean: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(event)) {
		if (FORBIDDEN_KEYS.has(key)) continue;
		clean[key] = value;
	}
	return clean;
}

export function createStructuredLogger(component: string, options: LoggerOptions = {}): Logger {
	const sink = options.sink ?? defaultSink;
	const clock = options.clock ?? (() => new Date());

	function emit(level: 'info' | 'warn' | 'error', event: Record<string, unknown>): void {
		sink({
			level,
			ts: clock().toISOString(),
			component,
			...sanitize(event)
		});
	}

	return {
		info: (event) => emit('info', event),
		warn: (event) => emit('warn', event),
		error: (event) => emit('error', event)
	};
}

function defaultSink(event: Record<string, unknown>): void {
	const line = JSON.stringify(event);
	if (typeof process !== 'undefined' && process.stdout) {
		process.stdout.write(line + '\n');
	}
}