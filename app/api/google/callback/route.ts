import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/google/auth';
import { isVercelConfigured, updateEnvVar, triggerRedeploy } from '@/lib/vercel/update-env';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  try {
    const tokens = await getTokensFromCode(code);

    // On Vercel, we can't persist to filesystem — show base64 for env var update
    const base64Tokens = Buffer.from(JSON.stringify(tokens)).toString('base64');

    // Auto-update Vercel env var if configured
    let vercelStatus = '';
    let redeployStatus = '';

    if (isVercelConfigured()) {
      const envResult = await updateEnvVar('GOOGLE_OAUTH_TOKENS', base64Tokens);
      vercelStatus = envResult.success
        ? '&#x2705; Vercel Env-Var automatisch aktualisiert'
        : `&#x26A0;&#xFE0F; Vercel-Update fehlgeschlagen: ${envResult.message}`;

      if (envResult.success) {
        const deployResult = await triggerRedeploy();
        redeployStatus = deployResult.success
          ? '&#x2705; Vercel Redeploy ausgeloest'
          : `&#x2139;&#xFE0F; ${deployResult.message}`;
      }
    }

    const expiryDate = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : 'unbekannt';

    // Return a page that shows success and instructions
    const html = `<!DOCTYPE html>
<html><head><title>Google Auth Success</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
  .success { color: #16a34a; font-size: 1.5em; }
  .token-box { background: #f1f5f9; padding: 12px; border-radius: 8px; word-break: break-all; font-size: 0.85em; margin: 12px 0; user-select: all; }
  .info { color: #64748b; font-size: 0.9em; }
  .status { margin: 8px 0; padding: 8px 12px; border-radius: 6px; background: #f0fdf4; }
  .status.warn { background: #fefce8; }
  a { color: #2563eb; }
  button { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9em; }
  button:hover { background: #1d4ed8; }
</style></head>
<body>
  <p class="success">&#x2705; Google-Autorisierung erfolgreich!</p>
  <p>Die OAuth2-Tokens wurden gespeichert. Token-Ablauf: ${expiryDate}</p>

  ${vercelStatus ? `<div class="status">${vercelStatus}</div>` : ''}
  ${redeployStatus ? `<div class="status">${redeployStatus}</div>` : ''}

  ${!isVercelConfigured() ? `
  <p class="info">Fuer automatisches Vercel-Update setze diese Env-Vars:</p>
  <ul class="info">
    <li><code>VERCEL_TOKEN</code> — Vercel Personal Access Token</li>
    <li><code>VERCEL_PROJECT_ID</code> — Projekt-ID</li>
    <li><code>VERCEL_DEPLOY_HOOK</code> — (optional) Deploy Hook URL</li>
  </ul>
  ` : ''}

  <details>
    <summary>GOOGLE_OAUTH_TOKENS (base64) — zum manuellen Kopieren</summary>
    <div class="token-box" id="tokenBox">${base64Tokens}</div>
    <button onclick="navigator.clipboard.writeText(document.getElementById('tokenBox').textContent).then(()=>this.textContent='Kopiert!')">
      In Zwischenablage kopieren
    </button>
  </details>

  <p style="margin-top: 24px;"><a href="/">Zurueck zur App</a></p>
</body></html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent('Failed to exchange code for tokens')}`, request.url)
    );
  }
}
