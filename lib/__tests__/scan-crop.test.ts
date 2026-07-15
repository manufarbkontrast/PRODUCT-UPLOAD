import { describe, it, expect } from 'vitest';
import { computeScanCropRect } from '@/lib/scan-crop';
import { SCAN_REGION_WIDTH_PCT, SCAN_REGION_HEIGHT_PCT, SCAN_CONTAINER_ASPECT } from '@/config/constants';

// SCAN_CONTAINER_ASPECT is 4/3 (matches the `aspect-[4/3]` video container).
// SCAN_REGION_WIDTH_PCT is 0.86, SCAN_REGION_HEIGHT_PCT is 0.42.

describe('computeScanCropRect', () => {
  it('crops the object-cover VISIBLE window, not the raw frame, for a 16:9 source in a 4:3 container', () => {
    // Raw frame: 1920x1080 (16:9). Container: 4:3.
    // object-cover fills height (1080) and crops width to 1080 * 4/3 = 1440,
    // centered -> side margin (1920 - 1440) / 2 = 240px per side.
    const rect = computeScanCropRect(
      { videoWidth: 1920, videoHeight: 1080 },
      SCAN_CONTAINER_ASPECT,
      SCAN_REGION_WIDTH_PCT,
      SCAN_REGION_HEIGHT_PCT
    );

    const visibleW = 1080 * (4 / 3); // 1440
    const visibleH = 1080;
    const visibleX = (1920 - visibleW) / 2; // 240
    const visibleY = 0;

    const expectedSw = Math.round(visibleW * SCAN_REGION_WIDTH_PCT); // 1238
    const expectedSh = Math.round(visibleH * SCAN_REGION_HEIGHT_PCT); // 454
    const expectedSx = Math.round(visibleX + (visibleW - visibleW * SCAN_REGION_WIDTH_PCT) / 2); // 341
    const expectedSy = Math.round(visibleY + (visibleH - visibleH * SCAN_REGION_HEIGHT_PCT) / 2); // 313

    expect(expectedSw).toBe(1238);
    expect(expectedSx).toBe(341);

    expect(rect.sw).toBe(expectedSw);
    expect(rect.sh).toBe(expectedSh);
    expect(rect.sx).toBe(expectedSx);
    expect(rect.sy).toBe(expectedSy);

    // The crop must stay strictly within the visible object-cover window —
    // never reach into the 240px margins that object-cover hides.
    expect(rect.sx).toBeGreaterThanOrEqual(Math.round(visibleX));
    expect(rect.sx + rect.sw).toBeLessThanOrEqual(Math.round(visibleX + visibleW) + 1); // +1 rounding slack
  });

  it('crops a percentage of the FULL frame when the source is already 4:3 (no object-cover margin)', () => {
    // Raw frame: 1440x1080 is exactly 4:3, matching the container -> the
    // visible object-cover window IS the full raw frame, no side/top crop.
    const rect = computeScanCropRect(
      { videoWidth: 1440, videoHeight: 1080 },
      SCAN_CONTAINER_ASPECT,
      SCAN_REGION_WIDTH_PCT,
      SCAN_REGION_HEIGHT_PCT
    );

    const expectedSw = Math.round(1440 * SCAN_REGION_WIDTH_PCT); // 1238
    const expectedSh = Math.round(1080 * SCAN_REGION_HEIGHT_PCT); // 454
    const expectedSx = Math.round((1440 - 1440 * SCAN_REGION_WIDTH_PCT) / 2); // 101
    const expectedSy = Math.round((1080 - 1080 * SCAN_REGION_HEIGHT_PCT) / 2); // 313

    expect(rect).toEqual({ sx: expectedSx, sy: expectedSy, sw: expectedSw, sh: expectedSh });
  });

  it('handles a portrait source (1080x1920) in a 4:3 container generally, not just 16:9/4:3', () => {
    // Raw frame: 1080x1920 (9:16, portrait). Container: 4:3 (landscape).
    // object-cover fills width (1080) and crops height to 1080 / (4/3) = 810,
    // centered -> top/bottom margin (1920 - 810) / 2 = 555px.
    const rect = computeScanCropRect(
      { videoWidth: 1080, videoHeight: 1920 },
      SCAN_CONTAINER_ASPECT,
      SCAN_REGION_WIDTH_PCT,
      SCAN_REGION_HEIGHT_PCT
    );

    const visibleW = 1080;
    const visibleH = 1080 / (4 / 3); // 810
    const visibleX = 0;
    const visibleY = (1920 - visibleH) / 2; // 555

    const expectedSw = Math.round(visibleW * SCAN_REGION_WIDTH_PCT); // 929
    const expectedSh = Math.round(visibleH * SCAN_REGION_HEIGHT_PCT); // 340
    const expectedSx = Math.round(visibleX + (visibleW - visibleW * SCAN_REGION_WIDTH_PCT) / 2); // 76
    const expectedSy = Math.round(visibleY + (visibleH - visibleH * SCAN_REGION_HEIGHT_PCT) / 2); // 790

    expect(rect.sw).toBe(expectedSw);
    expect(rect.sh).toBe(expectedSh);
    expect(rect.sx).toBe(expectedSx);
    expect(rect.sy).toBe(expectedSy);

    // Crop must stay within the visible vertical window (not reach into the
    // 555px top/bottom margins object-cover crops away).
    expect(rect.sy).toBeGreaterThanOrEqual(Math.round(visibleY));
    expect(rect.sy + rect.sh).toBeLessThanOrEqual(Math.round(visibleY + visibleH) + 1);
  });

  it('is centered: left margin to scan region roughly equals right margin within the visible window', () => {
    const rect = computeScanCropRect(
      { videoWidth: 1920, videoHeight: 1080 },
      SCAN_CONTAINER_ASPECT,
      SCAN_REGION_WIDTH_PCT,
      SCAN_REGION_HEIGHT_PCT
    );

    const visibleX = 240;
    const visibleW = 1440;
    const leftMargin = rect.sx - visibleX;
    const rightMargin = visibleX + visibleW - (rect.sx + rect.sw);
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(1);
  });
});
