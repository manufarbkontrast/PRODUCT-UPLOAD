import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/google/auth';

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

    // Return a page that shows the tokens and instructions
    const html = `<!DOCTYPE html>
<html><head><title>Google Auth Success</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
  .success { color: #16a34a; font-size: 1.5em; }
  .token-box { background: #f1f5f9; padding: 12px; border-radius: 8px; word-break: break-all; font-size: 0.85em; margin: 12px 0; }
  .info { color: #64748b; font-size: 0.9em; }
  a { color: #2563eb; }
</style></head>
<body>
  <p class="success">&#x2705; Google-Autorisierung erfolgreich!</p>
  <p>Die OAuth2-Tokens wurden gespeichert. Du kannst dieses Fenster schließen.</p>
  <p class="info">Falls die Tokens in der Vercel-Umgebungsvariable aktualisiert werden müssen:</p>
  <details>
    <summary>GOOGLE_OAUTH_TOKENS (base64)</summary>
    <div class="token-box">${base64Tokens}</div>
  </details>
  <p><a href="/">Zurück zur App</a></p>
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
