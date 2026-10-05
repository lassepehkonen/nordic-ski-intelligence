import { smokeDeployment } from './smoke.js';

export async function onSuccess() {
	const result = await smokeDeployment(process.env.DEPLOY_URL);
	console.log(`[nsi-smoke] PASS GET ${result.url}`);
}
