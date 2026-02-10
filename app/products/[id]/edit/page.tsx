'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { genderOptions } from '@/config/product';
import { getSilhouetteOptions } from '@/config/zalando-attributes';
import ZalandoAttributeForm from '@/components/ZalandoAttributeForm';
import { useViewMode } from '@/contexts/ViewModeContext';

interface Product {
  id: string;
  ean: string | null;
  name: string;
  gender: string;
  category: string;
  description: string | null;
  sku: string | null;
  status: string;
  zalandoAttributes: Record<string, string> | null;
}

const silhouetteOptions = getSilhouetteOptions();

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isMobile } = useViewMode();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    ean: '',
    name: '',
    gender: '',
    silhouette: '',
  });

  const [zalandoAttributes, setZalandoAttributes] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${id}`);
        if (!res.ok) throw new Error('Produkt nicht gefunden');
        const data: Product = await res.json();
        setFormData({
          ean: data.ean || '',
          name: data.name,
          gender: data.gender,
          silhouette: data.category,
        });
        setZalandoAttributes(data.zalandoAttributes || {});
      } catch {
        router.push('/products');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    setSuccess(false);

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
    setSuccess(false);
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

    setSaving(true);
    setSuccess(false);

    const submitData = {
      name: formData.name,
      gender: formData.gender,
      category: formData.silhouette,
      zalandoAttributes,
    };

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!res.ok) {
        throw new Error('Fehler beim Speichern');
      }

      setSuccess(true);
    } catch {
      setErrors({ form: 'Fehler beim Speichern. Bitte erneut versuchen.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="w-6 h-6 animate-spin text-zinc-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  const selectedSilhouetteLabel = silhouetteOptions.find(s => s.value === formData.silhouette)?.label;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push(`/products/${id}`)}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold">Produkt bearbeiten</h1>
      </div>

      {errors.form && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {errors.form}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400 flex items-center justify-between">
          <span>Änderungen gespeichert!</span>
          <button
            onClick={() => router.push(`/products/${id}`)}
            className="text-green-700 dark:text-green-400 underline text-sm"
          >
            Zum Produkt
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={`space-y-4 ${!isMobile ? 'max-w-2xl' : ''}`}>
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

        <div className={`pt-2 flex gap-3 ${isMobile ? 'flex-col' : ''}`}>
          <Button type="submit" className={isMobile ? 'w-full' : 'px-8'} loading={saving}>
            Speichern
          </Button>
          <Button
            type="button"
            variant="secondary"
            className={isMobile ? 'w-full' : 'px-8'}
            onClick={() => router.push(`/products/${id}`)}
          >
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  );
}
