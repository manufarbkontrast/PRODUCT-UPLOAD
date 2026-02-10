export const productCategories = [
  'T-Shirts',
  'Hoodies',
  'Pullover',
  'Jacken',
  'Hosen',
  'Shorts',
  'Kleider',
  'Röcke',
  'Accessoires',
  'Schuhe',
  'Taschen',
  'Sonstiges',
] as const;

export const genderOptions = [
  { value: 'mann', label: 'Herren' },
  { value: 'frau', label: 'Damen' },
  { value: 'unisex', label: 'Unisex' },
  { value: 'kinder', label: 'Kinder' },
] as const;

export const statusLabels: Record<string, string> = {
  draft: 'Entwurf',
  processing: 'Wird verarbeitet',
  processed: 'Verarbeitet',
  uploaded: 'Hochgeladen',
  error: 'Fehler',
};

export const statusColors: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-700',
  processing: 'bg-yellow-100 text-yellow-700',
  processed: 'bg-blue-100 text-blue-700',
  uploaded: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};
