import type { Logger } from './types.js';

const SENSITIVE_KEY = /api.?key|token|secret|password|authorization|cookie|credential/i;

export interface LoggerOptions {
	readonly sink?: (event: Record<string, unknown>) => void;
	readonly clock?: () => Date;
}

function sanitizeValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sanitizeValue);
	if (typeof value !== 'object' || value === null) return value;

	const clean: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value)) {
		if (SENSITIVE_KEY.test(key)) continue;
		clean[key] = sanitizeValue(child);
	}
	return clean;
}

function sanitize(event: Record<string, unknown>): Record<string, unknown> {
	return sanitizeValue(event) as Record<string, unknown>;
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
