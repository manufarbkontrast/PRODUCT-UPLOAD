// Shopify Admin API Client
// Verwendet für EAN-Lookup und Produktdaten-Synchronisation

const API_VERSION = '2024-01';

// Getter-Funktionen um Umgebungsvariablen zur Laufzeit zu lesen
function getStoreDomain(): string | undefined {
  return process.env.SHOPIFY_STORE_DOMAIN;
}

function getAccessToken(): string | undefined {
  return process.env.SHOPIFY_ACCESS_TOKEN;
}

interface ShopifyVariant {
  readonly id: number;
  readonly product_id: number;
  readonly title: string;
  readonly price: string;
  readonly sku: string;
  readonly barcode: string | null;
  readonly option1: string | null;
  readonly option2: string | null;
  readonly option3: string | null;
  readonly inventory_quantity: number;
  readonly weight: number;
  readonly weight_unit: string;
  readonly compare_at_price: string | null;
  readonly image_id: number | null;
}

interface ShopifyImage {
  readonly id: number;
  readonly product_id: number;
  readonly position: number;
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string | null;
}

interface ShopifyProduct {
  readonly id: number;
  readonly title: string;
  readonly body_html: string;
  readonly vendor: string;
  readonly product_type: string;
  readonly handle: string;
  readonly status: string;
  readonly tags: string;
  readonly variants: readonly ShopifyVariant[];
  readonly images: readonly ShopifyImage[];
  readonly options: readonly {
    readonly id: number;
    readonly product_id: number;
    readonly name: string;
    readonly position: number;
    readonly values: readonly string[];
  }[];
}

export interface ShopifyLookupResult {
  readonly found: boolean;
  readonly product?: ShopifyProduct;
  readonly variant?: ShopifyVariant;
  readonly name?: string;
  readonly brand?: string;
  readonly description?: string;
  readonly sku?: string;
  readonly price?: string;
  readonly compareAtPrice?: string;
  readonly barcode?: string;
  readonly color?: string;
  readonly size?: string;
  readonly tags?: string[];
  readonly productType?: string;
  readonly images?: readonly string[];
  readonly inventoryQuantity?: number;
}

/**
 * Prüft ob Shopify konfiguriert ist
 */
export function isShopifyConfigured(): boolean {
  const domain = getStoreDomain();
  const token = getAccessToken();
  return Boolean(domain && token);
}

/**
 * Führt einen API-Request an Shopify aus
 */
async function shopifyFetch<T>(endpoint: string): Promise<T | null> {
  const storeDomain = getStoreDomain();
  const accessToken = getAccessToken();

  if (!storeDomain || !accessToken) {
    console.error('Shopify nicht konfiguriert - Domain:', !!storeDomain, 'Token:', !!accessToken);
    return null;
  }

  try {
    const url = `https://${storeDomain}/admin/api/${API_VERSION}${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Shopify API error: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json() as T;
  } catch (error) {
    console.error('Shopify fetch error:', error);
    return null;
  }
}

/**
 * Sucht ein Produkt anhand des Barcodes (EAN)
 * Shopify speichert Barcodes auf Variant-Ebene
 */
export async function findProductByBarcode(barcode: string): Promise<ShopifyLookupResult> {
  const storeDomain = getStoreDomain();
  const accessToken = getAccessToken();

  if (!storeDomain || !accessToken) {
    console.error('Shopify findProductByBarcode: nicht konfiguriert');
    return { found: false };
  }

  // Shopify GraphQL API für Barcode-Suche
  const graphqlUrl = `https://${storeDomain}/admin/api/${API_VERSION}/graphql.json`;

  const query = `
    query findProductByBarcode($barcode: String!) {
      productVariants(first: 1, query: $barcode) {
        edges {
          node {
            id
            title
            barcode
            sku
            price
            compareAtPrice
            inventoryQuantity
            selectedOptions {
              name
              value
            }
            product {
              id
              title
              descriptionHtml
              vendor
              productType
              tags
              status
              handle
              images(first: 10) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { barcode: `barcode:${barcode}` },
      }),
    });

    if (!response.ok) {
      console.error(`Shopify GraphQL error: ${response.status}`);
      return { found: false };
    }

    const data = await response.json();
    const edges = data?.data?.productVariants?.edges;

    if (!edges || edges.length === 0) {
      // Fallback: REST API Suche über alle Produkte
      return await findProductByBarcodeREST(barcode);
    }

    const variantNode = edges[0].node;
    const productNode = variantNode.product;

    // Optionen extrahieren (z.B. Farbe, Größe)
    const options = variantNode.selectedOptions || [];
    const colorOption = options.find((o: { name: string; value: string }) =>
      ['color', 'colour', 'farbe'].includes(o.name.toLowerCase())
    );
    const sizeOption = options.find((o: { name: string; value: string }) =>
      ['size', 'größe', 'groesse'].includes(o.name.toLowerCase())
    );

    // Bilder extrahieren
    const images = productNode.images?.edges?.map(
      (e: { node: { url: string } }) => e.node.url
    ) || [];

    // Tags parsen - GraphQL gibt Array zurück, REST gibt String zurück
    const tags = Array.isArray(productNode.tags)
      ? productNode.tags
      : productNode.tags
        ? productNode.tags.split(',').map((t: string) => t.trim())
        : [];

    return {
      found: true,
      name: productNode.title,
      brand: productNode.vendor,
      description: stripHtml(productNode.descriptionHtml || ''),
      sku: variantNode.sku,
      price: variantNode.price,
      compareAtPrice: variantNode.compareAtPrice,
      barcode: variantNode.barcode,
      color: colorOption?.value,
      size: sizeOption?.value,
      tags,
      productType: productNode.productType,
      images,
      inventoryQuantity: variantNode.inventoryQuantity,
    };
  } catch (error) {
    console.error('Shopify GraphQL error:', error);
    return await findProductByBarcodeREST(barcode);
  }
}

/**
 * Fallback: REST API Suche über alle Produkte
 * Langsamer, aber funktioniert immer
 */
async function findProductByBarcodeREST(barcode: string): Promise<ShopifyLookupResult> {
  // Hole alle Produkte (paginiert wenn nötig)
  let pageInfo: string | null = null;
  let found = false;
  let result: ShopifyLookupResult = { found: false };

  do {
    const endpoint = pageInfo
      ? `/products.json?limit=250&page_info=${pageInfo}`
      : `/products.json?limit=250`;

    const data = await shopifyFetch<{ products: ShopifyProduct[] }>(endpoint);

    if (!data?.products) break;

    for (const product of data.products) {
      for (const variant of product.variants) {
        if (variant.barcode === barcode) {
          // Gefunden!
          const colorOption = extractOption(product, variant, ['color', 'colour', 'farbe']);
          const sizeOption = extractOption(product, variant, ['size', 'größe', 'groesse']);

          result = {
            found: true,
            product,
            variant,
            name: product.title,
            brand: product.vendor,
            description: stripHtml(product.body_html || ''),
            sku: variant.sku,
            price: variant.price,
            compareAtPrice: variant.compare_at_price || undefined,
            barcode: variant.barcode || undefined,
            color: colorOption,
            size: sizeOption,
            tags: product.tags ? product.tags.split(',').map(t => t.trim()) : [],
            productType: product.product_type,
            images: product.images?.map(img => img.src) || [],
            inventoryQuantity: variant.inventory_quantity,
          };
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // Pagination - prüfe Link Header (vereinfacht)
    pageInfo = null; // TODO: Implement cursor-based pagination if needed

  } while (pageInfo && !found);

  return result;
}

/**
 * Extrahiert eine Option (Farbe, Größe) aus Produkt und Variant
 */
function extractOption(
  product: ShopifyProduct,
  variant: ShopifyVariant,
  optionNames: string[]
): string | undefined {
  for (let i = 0; i < product.options.length; i++) {
    const option = product.options[i];
    if (optionNames.includes(option.name.toLowerCase())) {
      // option1, option2, option3 in variant entsprechen den Options
      const optionKey = `option${i + 1}` as 'option1' | 'option2' | 'option3';
      return variant[optionKey] || undefined;
    }
  }
  return undefined;
}

/**
 * Entfernt HTML-Tags aus einem String
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Holt alle Produkte eines Vendors (Marke)
 */
export async function getProductsByVendor(vendor: string): Promise<ShopifyProduct[]> {
  const data = await shopifyFetch<{ products: ShopifyProduct[] }>(
    `/products.json?vendor=${encodeURIComponent(vendor)}&limit=250`
  );
  return data?.products || [];
}

/**
 * Holt ein einzelnes Produkt nach ID
 */
export async function getProductById(productId: number): Promise<ShopifyProduct | null> {
  const data = await shopifyFetch<{ product: ShopifyProduct }>(
    `/products/${productId}.json`
  );
  return data?.product || null;
}
