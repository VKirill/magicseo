import type { MagicSeoClient } from './client.ts';
import type { Autolaunch } from './types.ts';

const MAX_STOP_ATTEMPTS = 3;

type StartClient = Pick<MagicSeoClient, 'getAutolaunch' | 'setAutolaunch'>;
type StopClient = Pick<MagicSeoClient, 'getAutolaunch' | 'setAutolaunch' | 'stopJob'>;

export class StopFailedError extends Error {
  projectId: number;
  attempts: number;

  constructor(projectId: number, attempts: number) {
    super(`Stop promotion failed after ${attempts} attempts`);
    this.name = 'StopFailedError';
    this.projectId = projectId;
    this.attempts = attempts;
  }
}

export async function startPromotion(
  client: StartClient,
  projectId: number,
): Promise<{ ok: true; attempts: number }> {
  const current = await client.getAutolaunch(projectId);
  await client.setAutolaunch(projectId, { ...current, active: true } as Autolaunch);
  const after = await client.getAutolaunch(projectId);
  if (!after.active) {
    throw new Error(`Start promotion did not activate project ${projectId}`);
  }
  return { ok: true, attempts: 1 };
}

export async function stopPromotion(
  client: StopClient,
  projectId: number,
): Promise<{ ok: true; attempts: number }> {
  for (let attempts = 1; attempts <= MAX_STOP_ATTEMPTS; attempts++) {
    const current = await client.getAutolaunch(projectId);
    await client.setAutolaunch(projectId, { ...current, active: false } as Autolaunch);
    try {
      await client.stopJob(projectId);
    } catch {
      // 404 or body error from DELETE /job is non-fatal; GET autolaunch decides.
    }
    const after = await client.getAutolaunch(projectId);
    if (!after.active) return { ok: true, attempts };
  }
  throw new StopFailedError(projectId, MAX_STOP_ATTEMPTS);
}
