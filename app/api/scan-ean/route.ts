import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * POST /api/scan-ean
 * Server-side barcode detection fallback using Gemini Vision.
 * Called when the browser's BarcodeDetector API is not available.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return NextResponse.json({ error: 'Kein Bild hochgeladen' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        ean: null,
        message: 'GEMINI_API_KEY nicht konfiguriert. Bitte manuell eingeben.',
      });
    }

    // Convert image to base64
    const bytes = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = image.type || 'image/jpeg';

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
      {
        text: `Look at this image and find any barcode or QR code.
If you find a barcode (EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39), extract the number.
Respond with ONLY the barcode number, nothing else.
If no barcode is found, respond with exactly "NONE".`,
      },
    ]);

    const text = (result.response.text() ?? '').trim();

    // Check if a valid barcode was found
    if (text === 'NONE' || text.length < 8 || text.length > 14 || !/^\d+$/.test(text)) {
      return NextResponse.json({
        ean: null,
        message: 'Kein Barcode erkannt. Bitte manuell eingeben.',
      });
    }

    return NextResponse.json({ ean: text });
  } catch (error) {
    console.error('POST /api/scan-ean error:', error);
    return NextResponse.json({
      ean: null,
      message: 'Fehler beim Scannen. Bitte manuell eingeben.',
    });
  }
}
