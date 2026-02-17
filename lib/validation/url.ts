/**
 * URL validation utilities to prevent SSRF attacks.
 * Only allows URLs from trusted domains (Supabase Storage).
 */

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^fc00:/i,
  /^fe80:/i,
  /^::1$/,
  /^localhost$/i,
];

/**
 * Build allowed domains from environment configuration.
 * Returns a list of trusted domains for image URLs.
 */
function getAllowedDomains(): readonly string[] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const domains: string[] = [];

  try {
    if (supabaseUrl) {
      const parsed = new URL(supabaseUrl.trim());
      domains.push(parsed.hostname);
    }
  } catch {
    console.warn('[URLValidation] Could not parse NEXT_PUBLIC_SUPABASE_URL');
  }

  // Also allow direct Supabase storage subdomains
  domains.push('supabase.co');

  return domains;
}

/**
 * Check if a hostname resolves to a private/internal IP range.
 */
function isPrivateHostname(hostname: string): boolean {
  return PRIVATE_IP_RANGES.some((pattern) => pattern.test(hostname));
}

/**
 * Validate that a URL points to a trusted domain and is safe to fetch.
 * Prevents SSRF attacks by rejecting private IPs, localhost, and unknown domains.
 *
 * @throws Error if the URL is not safe to fetch
 */
export function validateImageUrl(imageUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error(`Invalid image URL format: ${imageUrl.substring(0, 100)}`);
  }

  // Only allow HTTPS (except in development)
  if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error(`Image URL must use HTTPS: ${parsed.protocol}`);
  }

  // Block private/internal IPs
  if (isPrivateHostname(parsed.hostname)) {
    throw new Error(`Image URL points to private/internal address: ${parsed.hostname}`);
  }

  // Check against allowed domains
  const allowedDomains = getAllowedDomains();
  const isAllowed = allowedDomains.some(
    (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
  );

  if (!isAllowed) {
    throw new Error(
      `Image URL domain not in allowlist: ${parsed.hostname}. Allowed: ${allowedDomains.join(', ')}`
    );
  }
}
