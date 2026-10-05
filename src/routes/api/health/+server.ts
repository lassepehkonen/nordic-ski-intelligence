import { json } from '@sveltejs/kit';
import { healthPayload } from '../../../lib/server/health';

export function GET() {
	return json(healthPayload());
}
