'use client';

import { useState, useMemo } from 'react';
import { Select, Textarea } from '@/components/ui';
import { Input } from '@/components/ui/shadcn/input';
import {
  getSilhouetteByKey,
  type ZalandoAttribute,
} from '@/config/zalando-attributes';
import { BRAND_OPTIONS } from '@/config/brands';
import { ZALANDO_COLORS } from '@/config/zalando-colors';

interface ZalandoAttributeFormProps {
  readonly silhouetteKey: string;
  readonly values: Record<string, string>;
  readonly onChange: (key: string, value: string) => void;
  readonly errors?: Record<string, string>;
  readonly isMobile?: boolean;
}

// ─── Attribut-Gruppen Definition ────────────────────────────────────────────

interface AttributeGroup {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly keys: readonly string[];
}

const ATTRIBUTE_GROUPS: readonly AttributeGroup[] = [
  {
    key: 'brand_color',
    label: 'Marke & Farben',
    icon: '🏷️',
    keys: ['brand_code', 'color_code_primary'],
  },
  {
    key: 'season',
    label: 'Saison & Größen',
    icon: '📅',
    keys: ['season_code', 'size_group', 'size_codes'],
  },
  {
    key: 'material',
    label: 'Material',
    icon: '🧵',
    keys: [
      'material_upper_material_clothing',
      'material_filling',
      'material_futter_clothing',
      'material_upper_material_front',
      'material_upper_material_back',
      'material_upper_material_sleeves',
      'material_upper_material_insert',
      'material_upper_material_top',
      'material_upper_material_bottom',
      'material_upper_material_middle',
      'material_faux_fur_collar_material',
      'material_inner_jacket_lining',
      'material_inner_jacket_outer_material',
      'material_inner_jacket_padding',
      'material_middle_layer_material',
      'material_outer_jacket_inner_material',
      'material_sleeve_lining',
      'material_trim_material',
    ],
  },
];

// ─── Input mit Label/Fehler (shadcn Input hat keinen eingebauten Wrapper) ───

function LabeledInput({
  name,
  label,
  type,
  placeholder,
  value,
  onChange,
  error,
  autoComplete,
}: {
  readonly name: string;
  readonly label: string;
  readonly type?: string;
  readonly placeholder?: string;
  readonly value: string;
  readonly onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly error?: string;
  readonly autoComplete?: string;
}) {
  return (
    <div className="w-full">
      <label htmlFor={name} className="block text-sm font-medium mb-1 text-muted-foreground">
        {label}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        aria-invalid={!!error}
      />
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

// ─── Einzelnes Feld ─────────────────────────────────────────────────────────

function AttributeField({
  attr,
  value,
  onChange,
  error,
}: {
  readonly attr: ZalandoAttribute;
  readonly value: string;
  readonly onChange: (key: string, value: string) => void;
  readonly error?: string;
}) {
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    onChange(attr.key, e.target.value);
  };

  const label = `${attr.label} *`;
  const placeholder = attr.notApplicable
    ? 'Eingabe oder „nicht zutreffend"'
    : '';

  // Marke → Select mit Marken-Liste
  if (attr.key === 'brand_code') {
    return (
      <Select
        name={attr.key}
        label={label}
        placeholder="Marke wählen"
        options={[...BRAND_OPTIONS]}
        value={value}
        onChange={handleChange}
        error={error}
      />
    );
  }

  // Hauptfarbe → Select mit Zalando-Farbcodes
  if (attr.key === 'color_code_primary') {
    return (
      <Select
        name={attr.key}
        label={label}
        placeholder="Farbe wählen"
        options={[...ZALANDO_COLORS]}
        value={value}
        onChange={handleChange}
        error={error}
      />
    );
  }

  if (attr.type === 'textarea') {
    return (
      <Textarea
        name={attr.key}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        error={error}
      />
    );
  }

  if (attr.type === 'select' && attr.options) {
    const options = attr.options.map(opt => ({
      value: opt,
      label: opt,
    }));

    return (
      <Select
        name={attr.key}
        label={label}
        placeholder="Wählen"
        options={options}
        value={value}
        onChange={handleChange}
        error={error}
      />
    );
  }

  if (attr.type === 'number') {
    return (
      <LabeledInput
        name={attr.key}
        label={label}
        type="number"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        error={error}
        autoComplete="off"
      />
    );
  }

  return (
    <LabeledInput
      name={attr.key}
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      error={error}
      autoComplete="off"
    />
  );
}

// ─── Card Komponente ────────────────────────────────────────────────────────

function AttributeCard({
  group,
  attrs,
  values,
  onChange,
  errors,
  defaultExpanded,
}: {
  readonly group: AttributeGroup;
  readonly attrs: readonly ZalandoAttribute[];
  readonly values: Record<string, string>;
  readonly onChange: (key: string, value: string) => void;
  readonly errors: Record<string, string>;
  readonly defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const filledCount = attrs.filter(
    a => values[a.key] && values[a.key].trim() !== ''
  ).length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center justify-between w-full px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">{group.icon}</span>
          <span className="text-sm font-medium text-foreground">
            {group.label}
          </span>
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">
            !
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {filledCount}/{attrs.length}
          </span>
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {attrs.map(attr => (
            <AttributeField
              key={attr.key}
              attr={attr}
              value={values[attr.key] || ''}
              onChange={onChange}
              error={errors[attr.key]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Hauptkomponente ────────────────────────────────────────────────────────

export default function ZalandoAttributeForm({
  silhouetteKey,
  values,
  onChange,
  errors = {},
}: ZalandoAttributeFormProps) {
  const silhouette = useMemo(
    () => getSilhouetteByKey(silhouetteKey),
    [silhouetteKey]
  );

  // Felder die im Hauptformular bereits existieren
  const mainFormKeys = useMemo(() => new Set([
    'ean', 'name', 'description', 'target_genders', 'target_age_groups',
    'size_codes', 'size_group', 'media',
  ]), []);

  const mandatoryAttrs = useMemo(() => {
    if (!silhouette) return [];
    return silhouette.attributes.filter(a => !mainFormKeys.has(a.key));
  }, [silhouette, mainFormKeys]);

  // Pflichtfelder nach Gruppen sortieren
  const groupedMandatory = useMemo(() => {
    const allGroupKeys = new Set(ATTRIBUTE_GROUPS.flatMap(g => [...g.keys]));
    const groups: { group: AttributeGroup; attrs: ZalandoAttribute[] }[] = [];
    const ungrouped: ZalandoAttribute[] = [];

    for (const group of ATTRIBUTE_GROUPS) {
      const groupKeySet = new Set(group.keys);
      const attrsInGroup = mandatoryAttrs.filter(a => groupKeySet.has(a.key));
      if (attrsInGroup.length > 0) {
        groups.push({ group, attrs: attrsInGroup });
      }
    }

    // Felder die in keiner Gruppe sind
    for (const attr of mandatoryAttrs) {
      if (!allGroupKeys.has(attr.key)) {
        ungrouped.push(attr);
      }
    }

    if (ungrouped.length > 0) {
      groups.push({
        group: { key: 'ungrouped', label: 'Weitere Pflichtfelder', icon: '📝', keys: [] },
        attrs: ungrouped,
      });
    }

    return groups;
  }, [mandatoryAttrs]);

  if (!silhouette) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Pflichtfelder als Cards */}
      {groupedMandatory.map(({ group, attrs }) => (
        <AttributeCard
          key={group.key}
          group={group}
          attrs={attrs}
          values={values}
          onChange={onChange}
          errors={errors}
          defaultExpanded={attrs.length <= 4}
        />
      ))}
    </div>
  );
}
