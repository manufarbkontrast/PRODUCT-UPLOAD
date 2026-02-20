/**
 * Vercel API utilities for programmatic environment variable management.
 *
 * Used by the OAuth callback to automatically update GOOGLE_OAUTH_TOKENS
 * on Vercel after re-authorization, avoiding manual copy-paste.
 *
 * Required env vars:
 *   VERCEL_TOKEN        — Vercel personal access token (Settings → Tokens)
 *   VERCEL_PROJECT_ID   — Project ID (Settings → General → Project ID)
 *   VERCEL_DEPLOY_HOOK  — (optional) Deploy Hook URL for auto-redeploy
 */

const VERCEL_API_BASE = 'https://api.vercel.com';

interface VercelEnvVar {
  id: string;
  key: string;
  value: string;
  type: 'encrypted' | 'plain' | 'secret' | 'sensitive' | 'system';
  target: string[];
}

interface UpdateResult {
  success: boolean;
  message: string;
}

/**
 * Check if Vercel API credentials are configured.
 */
export function isVercelConfigured(): boolean {
  return !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
}

/**
 * Find a Vercel environment variable by key.
 */
async function findEnvVar(key: string): Promise<VercelEnvVar | null> {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    return null;
  }

  const response = await fetch(
    `${VERCEL_API_BASE}/v10/projects/${projectId}/env`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Vercel API error (list env): HTTP ${response.status}`);
  }

  const data = (await response.json()) as { envs: VercelEnvVar[] };
  return data.envs.find((env) => env.key === key) ?? null;
}

/**
 * Update an existing environment variable on Vercel.
 */
export async function updateEnvVar(key: string, value: string): Promise<UpdateResult> {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    return {
      success: false,
      message: 'VERCEL_TOKEN and VERCEL_PROJECT_ID must be set to auto-update env vars.',
    };
  }

  try {
    const existing = await findEnvVar(key);

    if (existing) {
      // Update existing env var
      const response = await fetch(
        `${VERCEL_API_BASE}/v10/projects/${projectId}/env/${existing.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ value }),
        }
      );

      if (!response.ok) {
        const errBody = await response.text();
        return {
          success: false,
          message: `Failed to update env var: HTTP ${response.status} — ${errBody}`,
        };
      }

      return { success: true, message: `Updated ${key} on Vercel.` };
    }

    // Create new env var if it doesn't exist
    const response = await fetch(
      `${VERCEL_API_BASE}/v10/projects/${projectId}/env`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          value,
          type: 'encrypted',
          target: ['production', 'preview'],
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      return {
        success: false,
        message: `Failed to create env var: HTTP ${response.status} — ${errBody}`,
      };
    }

    return { success: true, message: `Created ${key} on Vercel.` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Vercel API error: ${msg}` };
  }
}

/**
 * Trigger a Vercel redeploy via Deploy Hook.
 */
export async function triggerRedeploy(): Promise<UpdateResult> {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK;

  if (!hookUrl) {
    return {
      success: false,
      message: 'VERCEL_DEPLOY_HOOK not set — manual redeploy required.',
    };
  }

  try {
    const response = await fetch(hookUrl, { method: 'POST' });

    if (!response.ok) {
      return {
        success: false,
        message: `Deploy hook failed: HTTP ${response.status}`,
      };
    }

    return { success: true, message: 'Vercel redeploy triggered.' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Deploy hook error: ${msg}` };
  }
}
