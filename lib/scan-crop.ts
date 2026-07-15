/** Intrinsic pixel size of a video/camera frame as delivered by the browser. */
export interface VideoIntrinsicSize {
  readonly videoWidth: number;
  readonly videoHeight: number;
}

/** Source-pixel crop rectangle, in the raw video's coordinate space. */
export interface ScanCropRect {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
}

/**
 * Computes the source-pixel crop rectangle that corresponds EXACTLY to the
 * scan-target overlay the user sees on screen.
 *
 * Context: the `<video>` element is displayed inside a fixed-aspect-ratio
 * container using CSS `object-cover`. `object-cover` scales the raw camera
 * frame up until it fills the container in both dimensions, then crops the
 * overflow, centered. So whenever the camera's delivered resolution has a
 * different aspect ratio than the container (e.g. a 16:9 camera frame in a
 * 4:3 container), only a centered sub-rectangle of the raw frame — the
 * "visible window" — is ever shown to the user. The rest is invisible.
 *
 * The green scan-target rectangle (EanScannerOverlay.tsx's REGION_STYLE) is
 * positioned as a percentage of that VISIBLE window, because it is rendered
 * as a DOM overlay on top of the already-cropped `<video>` box. To make the
 * barcode detector read exactly what the user sees highlighted, the pixel
 * crop taken from the raw video frame must be computed the same way: first
 * find the object-cover visible window inside the raw frame, then take the
 * region percentages of THAT window (not of the full raw frame).
 *
 * @param video Intrinsic size of the raw camera frame (videoWidth/videoHeight).
 * @param containerAspect Displayed aspect ratio (width / height) of the
 *   `<video>` container — e.g. 4/3 for `aspect-[4/3]`. See
 *   `SCAN_CONTAINER_ASPECT` in config/constants.ts.
 * @param widthPct Scan region width as a fraction (0-1) of the visible window.
 * @param heightPct Scan region height as a fraction (0-1) of the visible window.
 */
export function computeScanCropRect(
  video: VideoIntrinsicSize,
  containerAspect: number,
  widthPct: number,
  heightPct: number
): ScanCropRect {
  const { videoWidth: vw, videoHeight: vh } = video;
  const rawAspect = vw / vh;

  // The centered sub-rectangle of the raw frame that object-cover actually
  // displays: whichever dimension the raw frame has "more of" relative to
  // the container gets cropped, the other fills the container exactly.
  const visibleW = rawAspect >= containerAspect ? vh * containerAspect : vw;
  const visibleH = rawAspect >= containerAspect ? vh : vw / containerAspect;
  const visibleX = (vw - visibleW) / 2;
  const visibleY = (vh - visibleH) / 2;

  // Scan region: a centered percentage of the VISIBLE window — matching
  // EanScannerOverlay's REGION_STYLE, which is positioned relative to the
  // already object-cover-cropped `<video>` box.
  const sw = visibleW * widthPct;
  const sh = visibleH * heightPct;
  const sx = visibleX + (visibleW - sw) / 2;
  const sy = visibleY + (visibleH - sh) / 2;

  return {
    sx: Math.round(sx),
    sy: Math.round(sy),
    sw: Math.round(sw),
    sh: Math.round(sh),
  };
}
