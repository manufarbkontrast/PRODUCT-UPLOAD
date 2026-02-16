import { NextResponse } from 'next/server';
import {
  appendToSheet,
  readSheet,
  writeToSheet,
  clearSheet,
} from '@/lib/google';

// Mock product data
const MOCK_PRODUCTS = [
  {
    sku: 'SPZ-001',
    name: 'Nike Air Max 90',
    brand: 'Nike',
    category: 'Sneaker',
    price: 149.99,
    stock: 25,
    color: 'Weiß/Schwarz',
    size: '42',
  },
  {
    sku: 'SPZ-002',
    name: 'Adidas Ultraboost 22',
    brand: 'Adidas',
    category: 'Laufschuhe',
    price: 189.99,
    stock: 18,
    color: 'Core Black',
    size: '43',
  },
  {
    sku: 'SPZ-003',
    name: 'Puma RS-X',
    brand: 'Puma',
    category: 'Sneaker',
    price: 119.99,
    stock: 32,
    color: 'Blau/Rot',
    size: '41',
  },
  {
    sku: 'SPZ-004',
    name: 'New Balance 574',
    brand: 'New Balance',
    category: 'Lifestyle',
    price: 99.99,
    stock: 45,
    color: 'Grau',
    size: '44',
  },
  {
    sku: 'SPZ-005',
    name: 'Converse Chuck Taylor',
    brand: 'Converse',
    category: 'Sneaker',
    price: 79.99,
    stock: 60,
    color: 'Weiß',
    size: '42',
  },
];

export async function POST() {
  try {
    // Clear existing data first (except header if exists)
    await clearSheet('Tabellenblatt1!A:H');

    // Create header row
    const headers = ['SKU', 'Name', 'Brand', 'Category', 'Price', 'Stock', 'Color', 'Size'];

    // Convert products to rows
    const productRows = MOCK_PRODUCTS.map((p) => [
      p.sku,
      p.name,
      p.brand,
      p.category,
      p.price,
      p.stock,
      p.color,
      p.size,
    ]);

    // Write header + data
    const allData = [headers, ...productRows];
    await writeToSheet(allData, 'Tabellenblatt1!A1:H6');

    // Read back to verify
    const verifyData = await readSheet('Tabellenblatt1!A:H');

    return NextResponse.json({
      success: true,
      message: `${MOCK_PRODUCTS.length} Produkte erfolgreich geschrieben!`,
      writtenProducts: MOCK_PRODUCTS.length,
      verifiedData: verifyData,
    });
  } catch (error) {
    console.error('Mock products test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Just read current data
    const data = await readSheet('Tabellenblatt1!A:H');

    if (data.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Keine Daten vorhanden. Nutze POST um Mock-Daten zu schreiben.',
        data: [],
      });
    }

    const headers = data[0];
    const rows = data.slice(1);

    const products = rows.map((row) => {
      const product: Record<string, string | number> = {};
      headers.forEach((header, index) => {
        product[header] = row[index] || '';
      });
      return product;
    });

    return NextResponse.json({
      success: true,
      message: `${products.length} Produkte gefunden`,
      totalRows: data.length,
      headers,
      products,
    });
  } catch (error) {
    console.error('Read products failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
