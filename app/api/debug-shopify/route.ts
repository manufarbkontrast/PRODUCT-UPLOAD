import { NextResponse } from 'next/server';
import { isShopifyConfigured } from '@/lib/shopify/client';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;

  return NextResponse.json({
    shopifyConfigured: isShopifyConfigured(),
    hasDomain: Boolean(domain),
    hasToken: Boolean(token),
    domainValue: domain ? `${domain.substring(0, 10)}...` : 'NOT SET',
    tokenLength: token ? token.length : 0,
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('SHOPIFY')),
  });
}
