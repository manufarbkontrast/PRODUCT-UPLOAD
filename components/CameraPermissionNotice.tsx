export type CameraErrorType = 'denied' | 'unavailable' | 'other';

interface CameraPermissionNoticeProps {
  readonly type: CameraErrorType;
}

const NOTICE_CONTENT: Record<CameraErrorType, { readonly title: string; readonly steps: readonly string[] }> = {
  denied: {
    title: 'Kamerazugriff wurde verweigert',
    steps: [
      'In Safari: Tippe auf das „aA"-Symbol links in der Adressleiste',
      'Wähle „Website-Einstellungen"',
      'Setze „Kamera" auf „Erlauben"',
      'Lade die Seite danach neu',
    ],
  },
  unavailable: {
    title: 'Keine Kamera gefunden',
    steps: [
      'Prüfe, ob eine andere App gerade die Kamera nutzt',
      'Schließe andere Kamera-Apps und versuche es erneut',
      'Alternativ: EAN unten manuell eingeben',
    ],
  },
  other: {
    title: 'Kamera nicht verfügbar',
    steps: ['Bitte versuche es erneut oder gib die EAN manuell ein'],
  },
};

/** Zeigt iOS-Safari-spezifische Hilfe, wenn die Kamera nicht genutzt werden kann. */
export default function CameraPermissionNotice({ type }: CameraPermissionNoticeProps) {
  const content = NOTICE_CONTENT[type];

  return (
    <div className="p-3 rounded-lg border border-amber-800/60 bg-amber-900/20">
      <p className="text-sm font-medium text-amber-300">{content.title}</p>
      <ol className="mt-1.5 space-y-1 text-xs text-amber-400 list-decimal list-inside">
        {content.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
