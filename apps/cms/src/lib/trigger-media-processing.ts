import type { Payload } from 'payload';

/**
 * Starts the "Process uploaded images" GitHub workflow, so a new upload no longer waits for someone
 * to run the worker. Runs only when GITHUB_DISPATCH_TOKEN is set; locally, pnpm media:watch does the
 * work. The token needs only the "Actions: write" permission on the repository.
 *
 * A failure is logged and never blocks the save. The upload stays pending, and the next run, or a
 * manual one, picks it up. The workflow's concurrency group folds a burst of uploads into one run.
 */
export async function triggerMediaProcessing(logger: Payload['logger']): Promise<void> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return;

  const repository = process.env.GITHUB_DISPATCH_REPOSITORY || 'NickBevers/nickbevers.dev';
  const url = `https://api.github.com/repos/${repository}/actions/workflows/process-media.yml/dispatches`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: process.env.GITHUB_DISPATCH_REF || 'main' }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      logger.error(`Could not start image processing: GitHub answered ${response.status}.`);
    }
  } catch (error) {
    logger.error({ err: error }, 'Could not start image processing.');
  }
}
