import { useState } from 'react';
import type { FeatureManifest } from './api';
import { fieldGroup, FORM_GROUPS, parseProfile } from './profile';
import type { FormValues } from './profile';

export function PatientForm({ schema, values, onChange }: {
  schema: FeatureManifest; values: FormValues; onChange: (name: string, value: string) => void;
}) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { errors } = parseProfile(values, schema);
  const invalid = schema.feature_order.filter(name => errors[name]);
  function focusField(name: string) {
    const field = document.getElementById(`field-${schema.feature_order.indexOf(name)}`);
    field?.focus({ preventScroll: true });
    field?.scrollIntoView({ block: 'nearest' });
  }
  return <div className="patient-form">
    <p className="form-note">All 55 source predictors are required. Clinical units are undocumented; none are guessed. No missing values are filled.</p>
    <div className="form-progress"><label htmlFor="profile-progress">{55 - invalid.length} of 55 fields valid</label>
      <progress id="profile-progress" max={55} value={55 - invalid.length} />
      {invalid.length > 0 && <button onClick={() => { setTouched(previous => ({ ...previous, [invalid[0]]: true })); focusField(invalid[0]); }}>Go to first incomplete or invalid field</button>}
    </div>
    <nav className="form-navigation" aria-label="Profile field groups">{FORM_GROUPS.map(group => {
      const names = schema.feature_order.filter(name => fieldGroup(name) === group);
      const valid = names.filter(name => !errors[name]).length;
      return <button key={group} onClick={() => focusField(names.find(name => errors[name]) ?? names[0])}>{group} · {valid}/{names.length}</button>;
    })}</nav>
    <div className="profile-fields">{FORM_GROUPS.map((group, i) => <fieldset key={group} id={`profile-group-${i}`}><legend>{group}</legend>
      <div className="field-grid">{schema.features.filter(field => fieldGroup(field.name) === group).map(field => {
        const id = `field-${schema.feature_order.indexOf(field.name)}`, error = touched[field.name] ? errors[field.name] : null;
        const common = { id, value: values[field.name] ?? '', required: true,
          'aria-invalid': !!error, 'aria-describedby': error ? `${id}-error` : undefined,
          onBlur: () => setTouched(previous => ({ ...previous, [field.name]: true })),
          onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(field.name, event.target.value) };
        return <div key={field.name}>
          <label htmlFor={id}>{field.name}{field.unit_status === 'verified' && field.unit ? ` (${field.unit})` : ''}</label>
          {field.kind === 'category' ? <select {...common}><option value="">Choose category</option>
            {field.categories?.map(value => <option key={value} value={value}>{value}</option>)}</select>
            : <input {...common} type="text" inputMode={field.kind === 'integer' ? 'numeric' : 'decimal'} />}
          {error && <small id={`${id}-error`} className="field-error">{error}</small>}
        </div>;
      })}</div>
    </fieldset>)}</div>
  </div>;
}
