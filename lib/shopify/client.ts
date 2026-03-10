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

// ─── Inventory & Varianten-Abfrage ──────────────────────────────────────────

export interface InventoryLevel {
  readonly locationName: string;
  readonly locationId: string;
  readonly available: number;
}

export interface VariantInventory {
  readonly variantId: string;
  readonly title: string;
  readonly barcode: string | null;
  readonly sku: string | null;
  readonly price: string | null;
  readonly color: string | null;
  readonly size: string | null;
  readonly inventoryQuantity: number;
  readonly inventoryLevels: readonly InventoryLevel[];
}

export interface ProductInventoryResult {
  readonly found: boolean;
  readonly productTitle?: string;
  readonly vendor?: string;
  readonly productType?: string;
  readonly matchedBarcode?: string;
  readonly totalInventory?: number;
  readonly variants?: readonly VariantInventory[];
}

/**
 * Holt alle Varianten eines Produkts mit Lagerbestaenden pro Standort.
 * Sucht zuerst die passende Variante per Barcode, dann alle Varianten des Produkts.
 */
export async function findProductInventory(barcode: string): Promise<ProductInventoryResult> {
  const storeDomain = getStoreDomain();
  const accessToken = getAccessToken();

  if (!storeDomain || !accessToken) {
    return { found: false };
  }

  const graphqlUrl = `https://${storeDomain}/admin/api/${API_VERSION}/graphql.json`;

  // Schritt 1: Produkt-ID ueber Barcode finden
  const findQuery = `
    query findProductByBarcode($barcode: String!) {
      productVariants(first: 1, query: $barcode) {
        edges {
          node {
            product {
              id
              title
              vendor
              productType
            }
          }
        }
      }
    }
  `;

  try {
    const findResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: findQuery,
        variables: { barcode: `barcode:${barcode}` },
      }),
    });

    if (!findResponse.ok) {
      console.error(`Shopify inventory lookup error: ${findResponse.status}`);
      return { found: false };
    }

    const findData = await findResponse.json();

    if (findData.errors) {
      console.error('Shopify inventory find errors:', JSON.stringify(findData.errors));
    }

    const edges = findData?.data?.productVariants?.edges;

    if (!edges || edges.length === 0) {
      console.error('Shopify inventory: no variant found for barcode:', barcode);
      return { found: false };
    }

    const productNode = edges[0].node.product;
    const productId = productNode.id;

    // Schritt 2: Alle Varianten mit Inventory Levels laden
    const inventoryQuery = `
      query getProductInventory($productId: ID!) {
        product(id: $productId) {
          title
          vendor
          productType
          variants(first: 100) {
            edges {
              node {
                id
                title
                barcode
                sku
                price
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
                inventoryItem {
                  inventoryLevels(first: 20) {
                    edges {
                      node {
                        quantities(names: ["available"]) {
                          name
                          quantity
                        }
                        location {
                          id
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const invResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: inventoryQuery,
        variables: { productId },
      }),
    });

    if (!invResponse.ok) {
      console.error(`Shopify inventory query error: ${invResponse.status}`);
      return { found: false };
    }

    const invData = await invResponse.json();

    if (invData.errors) {
      console.error('Shopify inventory GraphQL errors:', JSON.stringify(invData.errors));
      // Fallback: Ohne inventoryLevels versuchen
      return await findProductInventorySimple(graphqlUrl, accessToken, productId, barcode);
    }

    const product = invData?.data?.product;
    if (!product) {
      return { found: false };
    }

    const variants: VariantInventory[] = (product.variants?.edges ?? []).map(
      (edge: {
        node: {
          id: string;
          title: string;
          barcode: string | null;
          sku: string | null;
          price: string | null;
          inventoryQuantity: number;
          selectedOptions: readonly { name: string; value: string }[];
          inventoryItem?: {
            inventoryLevels?: {
              edges: readonly {
                node: {
                  quantities: readonly { name: string; quantity: number }[];
                  location: { id: string; name: string };
                };
              }[];
            };
          };
        };
      }) => {
        const v = edge.node;
        const options = v.selectedOptions ?? [];
        const colorOpt = options.find((o) =>
          ['color', 'colour', 'farbe'].includes(o.name.toLowerCase())
        );
        const sizeOpt = options.find((o) =>
          ['size', 'größe', 'groesse'].includes(o.name.toLowerCase())
        );

        const levels: InventoryLevel[] = (
          v.inventoryItem?.inventoryLevels?.edges ?? []
        ).map(
          (le: {
            node: {
              quantities: readonly { name: string; quantity: number }[];
              location: { id: string; name: string };
            };
          }) => {
            const availableQty =
              le.node.quantities.find((q) => q.name === 'available')?.quantity ?? 0;
            return {
              locationName: le.node.location.name,
              locationId: le.node.location.id,
              available: availableQty,
            };
          }
        );

        return {
          variantId: v.id,
          title: v.title,
          barcode: v.barcode,
          sku: v.sku,
          price: v.price,
          color: colorOpt?.value ?? null,
          size: sizeOpt?.value ?? null,
          inventoryQuantity: v.inventoryQuantity,
          inventoryLevels: levels,
        };
      }
    );

    const totalInventory = variants.reduce((sum, v) => sum + v.inventoryQuantity, 0);

    return {
      found: true,
      productTitle: product.title,
      vendor: product.vendor,
      productType: product.productType,
      matchedBarcode: barcode,
      totalInventory,
      variants,
    };
  } catch (error) {
    console.error('Shopify inventory lookup error:', error);
    return { found: false };
  }
}

/**
 * Fallback: Varianten ohne inventoryLevels (fuer aeltere API-Versionen)
 */
async function findProductInventorySimple(
  graphqlUrl: string,
  accessToken: string,
  productId: string,
  barcode: string
): Promise<ProductInventoryResult> {
  const simpleQuery = `
    query getProductInventory($productId: ID!) {
      product(id: $productId) {
        title
        vendor
        productType
        variants(first: 100) {
          edges {
            node {
              id
              title
              barcode
              sku
              price
              inventoryQuantity
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: simpleQuery,
        variables: { productId },
      }),
    });

    if (!res.ok) return { found: false };

    const data = await res.json();
    const product = data?.data?.product;
    if (!product) return { found: false };

    const variants: VariantInventory[] = (product.variants?.edges ?? []).map(
      (edge: {
        node: {
          id: string;
          title: string;
          barcode: string | null;
          sku: string | null;
          price: string | null;
          inventoryQuantity: number;
          selectedOptions: readonly { name: string; value: string }[];
        };
      }) => {
        const v = edge.node;
        const options = v.selectedOptions ?? [];
        const colorOpt = options.find((o) =>
          ['color', 'colour', 'farbe'].includes(o.name.toLowerCase())
        );
        const sizeOpt = options.find((o) =>
          ['size', 'größe', 'groesse'].includes(o.name.toLowerCase())
        );

        return {
          variantId: v.id,
          title: v.title,
          barcode: v.barcode,
          sku: v.sku,
          price: v.price,
          color: colorOpt?.value ?? null,
          size: sizeOpt?.value ?? null,
          inventoryQuantity: v.inventoryQuantity,
          inventoryLevels: [],
        };
      }
    );

    const totalInventory = variants.reduce((sum, v) => sum + v.inventoryQuantity, 0);

    return {
      found: true,
      productTitle: product.title,
      vendor: product.vendor,
      productType: product.productType,
      matchedBarcode: barcode,
      totalInventory,
      variants,
    };
  } catch (error) {
    console.error('Shopify simple inventory lookup error:', error);
    return { found: false };
  }
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

