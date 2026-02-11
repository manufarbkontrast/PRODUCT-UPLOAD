'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { genderOptions } from '@/config/product';
import { getSilhouetteOptions } from '@/config/zalando-attributes';
import ZalandoAttributeForm from '@/components/ZalandoAttributeForm';
import EanScanner from '@/components/EanScanner';
import { useViewMode } from '@/contexts/ViewModeContext';
import type { EanLookupResult } from '@/config/ean-lookup-mappings';

type Step = 'scan' | 'details';

const silhouetteOptions = getSilhouetteOptions();

export default function NewProductPage() {
  const { isMobile } = useViewMode();
  const router = useRouter();
  const [step, setStep] = useState<Step>('scan');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lookupMessage, setLookupMessage] = useState<{
    type: 'success' | 'warning';
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    ean: '',
    name: '',
    gender: '',
    silhouette: '',
  });

  const [zalandoAttributes, setZalandoAttributes] = useState<Record<string, string>>({});

  const handleEanScan = (ean: string) => {
    setFormData(prev => ({ ...prev, ean }));
  };

  const handleLookupResult = useCallback((result: EanLookupResult) => {
    if (result.found) {
      // Formular vorausfüllen mit Lookup-Daten
      // HINWEIS: Silhouette wird NICHT automatisch gesetzt - Mitarbeiter wählt manuell
      setFormData(prev => ({
        ...prev,
        name: result.name || prev.name,
        gender: result.genderCode || prev.gender,
        // silhouette bleibt leer - muss manuell gewählt werden
      }));

      // Zalando-Attribute vorausfüllen
      const newAttrs: Record<string, string> = {};

      // Marke
      if (result.brandCode) {
        newAttrs.brand_code = result.brandCode;
      } else if (result.brand) {
        newAttrs.brand_code = result.brand;
      }

      // Farbe
      if (result.colorCode) {
        newAttrs.color_code_primary = result.colorCode;
      }

      // Material
      if (result.material) {
        newAttrs.material_upper_material_clothing = result.material;
      }

      // Beschreibung (aus Shopify)
      if (result.description) {
        newAttrs.description = result.description;
      }

      // SKU (Artikelnummer)
      if (result.sku) {
        newAttrs.sku = result.sku;
      }

      // Größe
      if (result.size) {
        newAttrs.size_codes = result.size;
      }

      if (Object.keys(newAttrs).length > 0) {
        setZalandoAttributes(prev => ({ ...prev, ...newAttrs }));
      }

      const filledFields: string[] = [];
      if (result.name) filledFields.push('Name');
      if (result.brandCode || result.brand) filledFields.push('Marke');
      if (result.colorCode || result.color) filledFields.push('Farbe');
      if (result.genderCode) filledFields.push('Geschlecht');
      if (result.description) filledFields.push('Beschreibung');
      if (result.sku) filledFields.push('SKU');
      if (result.size) filledFields.push('Größe');

      const sourceInfo = result.source === 'shopify' ? ' (Shopify)' : '';
      setLookupMessage({
        type: 'success',
        text: `Produktdaten gefunden${sourceInfo}! Vorausgefüllt: ${filledFields.join(', ')}. Bitte Produktart wählen.`,
      });
    } else {
      // Kein Hinweis nötig - Formular ist bereit zum Ausfüllen
      setLookupMessage(null);
    }

    // Immer zum Details-Step wechseln
    setStep('details');
  }, []);

  const handleSkipEan = () => {
    setStep('details');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    setLookupMessage(null);

    // Reset Zalando-Attribute wenn Silhouette wechselt
    if (name === 'silhouette') {
      setZalandoAttributes({});
    }
  };

  const handleAttributeChange = (key: string, value: string) => {
    setZalandoAttributes(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name ist erforderlich';
    }
    if (!formData.gender) {
      newErrors.gender = 'Bitte auswählen';
    }
    if (!formData.silhouette) {
      newErrors.silhouette = 'Bitte auswählen';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    const submitData = {
      ean: formData.ean || null,
      name: formData.name,
      gender: formData.gender,
      category: formData.silhouette,
      zalandoAttributes,
    };

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        console.error('POST /api/products failed:', res.status, errorBody);
        throw new Error(
          res.status === 401
            ? 'Nicht eingeloggt. Bitte neu einloggen.'
            : `Fehler beim Speichern (${res.status})`
        );
      }

      const product = await res.json();

      // Bei bestehendem Produkt: Hinweis anzeigen, trotzdem weiterleiten
      if (product.existingProduct) {
        console.info('Produkt mit dieser EAN existiert bereits, weiterleitung...');
      }

      router.push(`/products/${product.id}/images`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Speichern';
      setErrors({ form: `${message}. Bitte erneut versuchen.` });
    } finally {
      setLoading(false);
    }
  };

  // Step 1: EAN Scan
  if (step === 'scan') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold">Neues Produkt</h1>
        </div>

        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-900 text-white text-xs dark:bg-white dark:text-zinc-900">1</span>
          <span>EAN</span>
          <span className="text-zinc-300 dark:text-zinc-600">{"\u2192"}</span>
          <span className="text-zinc-400">Daten</span>
          <span className="text-zinc-300 dark:text-zinc-600">{"\u2192"}</span>
          <span className="text-zinc-400">Bilder</span>
        </div>

        <EanScanner
          onScan={handleEanScan}
          onSkip={handleSkipEan}
          onLookupResult={handleLookupResult}
          autoLookup={true}
        />
      </div>
    );
  }

  // Step 2: Product Details + Zalando Attribute
  const selectedSilhouetteLabel = silhouetteOptions.find(s => s.value === formData.silhouette)?.label;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setStep('scan')}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold">Produktdaten</h1>
      </div>

      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-xs">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span className="text-zinc-400">EAN</span>
        <span className="text-zinc-300 dark:text-zinc-600">{"\u2192"}</span>
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-900 text-white text-xs dark:bg-white dark:text-zinc-900">2</span>
        <span>Daten</span>
        <span className="text-zinc-300 dark:text-zinc-600">{"\u2192"}</span>
        <span className="text-zinc-400">Bilder</span>
      </div>

      {/* EAN Display */}
      {formData.ean && (
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800">
          <div>
            <p className="text-xs text-green-600 dark:text-green-400">EAN</p>
            <p className="text-sm font-mono font-medium">{formData.ean}</p>
          </div>
          <button
            onClick={() => {
              setLookupMessage(null);
              setStep('scan');
            }}
            className="text-xs text-green-600 underline dark:text-green-400"
          >
            Ändern
          </button>
        </div>
      )}

      {/* Lookup-Ergebnis Meldung */}
      {lookupMessage && (
        <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
          lookupMessage.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
            : 'bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
        }`}>
          <span className="flex-shrink-0 mt-0.5">
            {lookupMessage.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
          </span>
          <span>{lookupMessage.text}</span>
          <button
            onClick={() => setLookupMessage(null)}
            className="ml-auto flex-shrink-0 opacity-60 hover:opacity-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {errors.form && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {errors.form}
        </div>
      )}

      <form onSubmit={handleSubmit} className={`space-y-4 ${!isMobile ? 'max-w-2xl' : ''}`}>
        {/* Grunddaten */}
        <Input
          name="name"
          label="Produktname *"
          placeholder="z.B. Classic T-Shirt"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          autoComplete="off"
        />

        <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <Select
            name="gender"
            label="Geschlecht *"
            placeholder="Wählen"
            options={genderOptions}
            value={formData.gender}
            onChange={handleChange}
            error={errors.gender}
          />

          <Select
            name="silhouette"
            label="Produktart (Silhouette) *"
            placeholder="Wählen"
            options={silhouetteOptions}
            value={formData.silhouette}
            onChange={handleChange}
            error={errors.silhouette}
          />
        </div>

        {/* Zalando-Attribute (dynamisch basierend auf Silhouette) */}
        {formData.silhouette && (
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Zalando-Attribute für {selectedSilhouetteLabel}
              </span>
            </div>
            <ZalandoAttributeForm
              silhouetteKey={formData.silhouette}
              values={zalandoAttributes}
              onChange={handleAttributeChange}
              errors={errors}
              isMobile={isMobile}
            />
          </div>
        )}

        <div className="pt-2">
          <Button type="submit" className={isMobile ? 'w-full' : 'w-auto px-8'} loading={loading}>
            Weiter zu Bilder
          </Button>
        </div>
      </form>
    </div>
  );
}
