/**
 * Audit & fix shoe images in Google Drive folders.
 *
 * For each folder:
 * 1. Download all images
 * 2. Classify shoe views with Gemini (fast text model)
 * 3. Check for orientation issues (toes pointing right)
 * 4. Fix issues: Gemini image editing + Sharp framing normalization
 * 5. Upload corrected images back to the same folder
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import * as fs from 'fs';

// ─── Config ──────────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

const TOKEN_FILE = 'google-oauth-token.json';
const FOLDER_LIST = '/tmp/drive_folder_list.txt';

// ─── Google Drive helpers ────────────────────────────────────────────────────

let cachedToken: string | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json() as { access_token: string };
  cachedToken = data.access_token;
  return cachedToken;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  const token = await getAccessToken();
  const url = `https://www.googleapis.com/drive/v3/files?q=%27${folderId}%27+in+parents+and+mimeType+contains+%27image%27&fields=files(id,name,mimeType)&pageSize=20&orderBy=name`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json() as { files: DriveFile[] };
  return data.files || [];
}

async function downloadFile(fileId: string): Promise<Buffer> {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Buffer.from(await res.arrayBuffer());
}

async function uploadFile(folderId: string, name: string, buffer: Buffer, mimeType: string): Promise<string> {
  const token = await getAccessToken();
  const metadata = JSON.stringify({ name, parents: [folderId] });
  const boundary = '---BOUNDARY---';

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const data = await res.json() as { id: string };
  return data.id;
}

// ─── Gemini classifier ──────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

interface ClassifyResult {
  index: number;
  view: string;
  toes_direction: string; // 'left', 'right', 'unknown', 'not_applicable'
}

async function classifyAndCheckOrientation(images: { name: string; buffer: Buffer; mimeType: string }[]): Promise<ClassifyResult[]> {
  if (images.length === 0) return [];

  const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];

  for (let i = 0; i < images.length; i++) {
    parts.push({
      inlineData: {
        mimeType: images[i].mimeType,
        data: images[i].buffer.toString('base64'),
      },
    });
    parts.push({ text: `Image ${i}: ${images[i].name}` });
  }

  parts.push({
    text: `You are a shoe photography quality checker for an e-commerce store.

For each image, determine:
1. Is this a SHOE image? (not clothing, hats, bags, etc.)
2. If it's a shoe: what VIEW TYPE is it? (side_outer, back_pair_angled, heel_pair, sole, angled_front, other)
3. Which direction do the shoe TOES point? (left, right, not_applicable for sole/non-shoe)

CRITICAL: Look at where the FRONT/TOE of the shoe points:
- "left" = toe points to the LEFT side of the image
- "right" = toe points to the RIGHT side of the image
- For back views: look at which direction the shoes face AWAY from camera
- For sole views or non-shoe items: "not_applicable"

Return ONLY a JSON array:
[{"index": 0, "view": "side_outer", "toes_direction": "right"}, ...]

Possible views: side_outer, back_pair_angled, heel_pair, sole, angled_front, other, not_shoe
Possible toes_direction: left, right, not_applicable`,
  });

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(parts);
  const text = result.response.text();

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  return JSON.parse(jsonMatch[0]);
}

// ─── Image processing ────────────────────────────────────────────────────────

const SHOE_BASE = `Professional e-commerce product photography with these specifications:

CONSISTENT FRAMING - HIGHEST PRIORITY:
- The product MUST occupy exactly 60-65% of the total image HEIGHT
- Camera ANGLE must stay the same
- Product proportions must remain accurate

LIGHTING SETUP:
- Soft, diffused studio lighting from top-left at 45-degree angle
- Shadow opacity approximately 15-20%, very soft edges
- Color temperature: neutral daylight (5500K)

BACKGROUND & COMPOSITION:
- Pure white background (#FFFFFF)
- Product perfectly centered

TECHNICAL REQUIREMENTS:
- Ultra-high resolution, sharp focus
- Clean edges, no background artifacts
- No people, hands, or styling props`;

const VIEW_PROMPTS: Record<string, string> = {
  side_outer: `${SHOE_BASE}

VIEW RULES:
- Shoe toe MUST point to the LEFT
- If toe points RIGHT, MIRROR/FLIP horizontally
- Show full profile from toe to heel

TRANSFORM: background to white, lighting, flip if toe points right`,

  back_pair_angled: `${SHOE_BASE}

VIEW RULES:
- PAIR of shoes from behind at slight angle
- Shoe toes MUST point to the LEFT
- If toes point RIGHT, MIRROR/FLIP horizontally
- Both shoes evenly lit

TRANSFORM: background to white, lighting, flip if toes point right`,

  angled_front: `${SHOE_BASE}

VIEW RULES:
- Single shoe at 3/4 angle from front
- Toe should point toward LEFT
- If toe points RIGHT, MIRROR/FLIP horizontally

TRANSFORM: background to white, lighting, flip if toe points right`,

  heel_pair: `${SHOE_BASE}

VIEW RULES:
- PAIR of shoes straight from behind
- Symmetric view
- Do NOT flip

TRANSFORM: background to white, lighting, centering`,

  sole: `${SHOE_BASE}

VIEW RULES:
- Bottom/outsole visible
- Toe end points UPWARD

TRANSFORM: background to white, lighting, centering`,
};

async function processImage(imageBuffer: Buffer, view: string): Promise<Buffer> {
  const prompt = VIEW_PROMPTS[view] || VIEW_PROMPTS.side_outer;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    generationConfig: { responseModalities: ['Text', 'Image'] } as Record<string, unknown>,
  });

  const result = await model.generateContent([
    { inlineData: { mimeType: 'image/jpeg', data: imageBuffer.toString('base64') } },
    { text: `${prompt}\n\nEdit this product image. Return ONLY the edited image.` },
  ]);

  const parts = result.response.candidates?.[0]?.content.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  throw new Error('Gemini returned no image');
}

async function normalizeShoeFraming(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) return imageBuffer;

  const flattened = await sharp(imageBuffer)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  const trimmedResult = await sharp(flattened)
    .trim({ threshold: 50 })
    .png()
    .toBuffer({ resolveWithObject: true });

  const pw = trimmedResult.info.width;
  const ph = trimmedResult.info.height;

  const finalHeight = Math.round(ph / 0.625);
  const finalWidth = Math.max(Math.round(finalHeight * 0.75), Math.round(pw / 0.7));

  const padTop = Math.round((finalHeight - ph) / 2);
  const padBottom = finalHeight - ph - padTop;
  const padLeft = Math.round((finalWidth - pw) / 2);
  const padRight = finalWidth - pw - padLeft;

  return sharp(trimmedResult.data)
    .extend({
      top: Math.max(0, padTop),
      bottom: Math.max(0, padBottom),
      left: Math.max(0, padLeft),
      right: Math.max(0, padRight),
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const folderLines = fs.readFileSync(FOLDER_LIST, 'utf-8').trim().split('\n');
  const folders = folderLines.map(line => {
    const [id, ...nameParts] = line.split('|');
    return { id, name: nameParts.join('|') };
  });

  console.log(`\n=== SHOE IMAGE AUDIT ===`);
  console.log(`Total folders: ${folders.length}\n`);

  const issues: { folder: string; image: string; view: string; direction: string; fixed: boolean }[] = [];
  let processedFolders = 0;
  let skippedNonShoe = 0;

  for (const folder of folders) {
    processedFolders++;
    process.stdout.write(`[${processedFolders}/${folders.length}] ${folder.name} ... `);

    try {
      // List images in folder
      const files = await listFilesInFolder(folder.id);
      if (files.length === 0) {
        console.log('keine Bilder');
        continue;
      }

      // Download images (limit to 10 per folder)
      const imageFiles = files.slice(0, 10);
      const images = await Promise.all(
        imageFiles.map(async f => ({
          id: f.id,
          name: f.name,
          buffer: await downloadFile(f.id),
          mimeType: f.mimeType || 'image/jpeg',
        }))
      );

      // Classify and check orientation
      const classifications = await classifyAndCheckOrientation(
        images.map(img => ({ name: img.name, buffer: img.buffer, mimeType: img.mimeType }))
      );

      // Check for non-shoe folder
      const shoeViews = classifications.filter(c => c.view !== 'not_shoe');
      if (shoeViews.length === 0) {
        console.log(`kein Schuh (${files.length} Bilder)`);
        skippedNonShoe++;
        continue;
      }

      // Find orientation issues
      const wrongOrientation = classifications.filter(
        c => c.toes_direction === 'right' && ['side_outer', 'back_pair_angled', 'angled_front'].includes(c.view)
      );

      if (wrongOrientation.length === 0) {
        console.log(`OK (${shoeViews.length} Schuhbilder, alle korrekt)`);
        continue;
      }

      console.log(`${wrongOrientation.length} FEHLER gefunden:`);

      for (const issue of wrongOrientation) {
        const img = images[issue.index];
        if (!img) continue;

        console.log(`  - ${img.name}: ${issue.view}, Spitze nach RECHTS`);
        issues.push({ folder: folder.name, image: img.name, view: issue.view, direction: issue.toes_direction, fixed: false });

        // Fix: process with Gemini + Sharp
        try {
          console.log(`    Korrigiere...`);
          const processed = await processImage(img.buffer, issue.view);
          const normalized = await normalizeShoeFraming(processed);

          // Upload corrected image with "_corrected" suffix
          const correctedName = img.name.replace(/\.[^.]+$/, '_corrected.png');
          await uploadFile(folder.id, correctedName, normalized, 'image/png');

          console.log(`    Hochgeladen: ${correctedName}`);
          issues[issues.length - 1].fixed = true;
        } catch (err) {
          console.error(`    FEHLER beim Korrigieren:`, err instanceof Error ? err.message : err);
        }
      }
    } catch (err) {
      console.log(`FEHLER: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Summary
  console.log(`\n=== ZUSAMMENFASSUNG ===`);
  console.log(`Ordner geprüft: ${processedFolders}`);
  console.log(`Nicht-Schuh-Ordner: ${skippedNonShoe}`);
  console.log(`Fehler gefunden: ${issues.length}`);
  console.log(`Korrigiert: ${issues.filter(i => i.fixed).length}`);

  if (issues.length > 0) {
    console.log(`\nFehlerhafte Bilder:`);
    for (const issue of issues) {
      const status = issue.fixed ? 'KORRIGIERT' : 'FEHLGESCHLAGEN';
      console.log(`  [${status}] ${issue.folder} / ${issue.image} (${issue.view}, Spitze ${issue.direction})`);
    }
  }

  // Save report
  fs.writeFileSync('/tmp/shoe_audit_report.json', JSON.stringify(issues, null, 2));
  console.log(`\nReport gespeichert: /tmp/shoe_audit_report.json`);
}

main().catch(console.error);
