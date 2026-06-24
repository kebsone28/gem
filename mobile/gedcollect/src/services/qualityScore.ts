export interface QualityReport {
  score: number;
  checks: { label: string; ok: boolean; detail?: string }[];
}

export function evaluateQuality(
  values: Record<string, string>,
  photos: Record<string, string[]>,
  gpsAccuracy: number | null,
  fields: any[],
): QualityReport {
  const checks: QualityReport['checks'] = [];
  let total = 0;
  let passed = 0;

  // Champs requis remplis
  const required = fields.filter((f) => f.required === 'yes' || f.required === true);
  total += required.length;
  for (const f of required) {
    const val = values[f.name];
    const ok = !!val && val.trim() !== '';
    checks.push({ label: `${f.label || f.name} rempli`, ok, detail: ok ? undefined : 'Champ obligatoire vide' });
    if (ok) passed++;
  }

  // GPS
  total++;
  const hasGps = Object.keys(values).some((k) => (k.includes('latitude') || k.includes('longitude')) && values[k]);
  checks.push({ label: 'Localisation GPS', ok: hasGps, detail: hasGps ? undefined : 'Géolocalisation recommandée' });
  if (hasGps) passed++;

  // Photos
  total++;
  const photoCount = Object.values(photos).reduce((s, p) => s + p.length, 0);
  checks.push({ label: 'Photos', ok: photoCount > 0, detail: photoCount > 0 ? `${photoCount} photo(s)` : 'Aucune photo' });
  if (photoCount > 0) passed++;

  // Cohérence: âge vs situation matrimoniale
  const age = values['age'] || values['Age'];
  const marital = values['situation_matrimoniale'] || values['marital_status'] || values['Situation_matrimoniale'];
  if (age && marital) {
    total++;
    const ageNum = parseInt(age, 10);
    const isChild = ageNum < 16;
    const married = marital === 'Marie' || marital === 'Marié' || marital === 'Mariée' || marital === 'Married';
    const ok = !(isChild && married);
    checks.push({ label: 'Cohérence âge/situation', ok, detail: ok ? undefined : `Âge ${age} et situation "${marital}" semblent incohérents` });
    if (ok) passed++;
  }

  // Signature
  total++;
  const hasSignature = Object.keys(values).some((k) => k.includes('signature') && values[k]);
  checks.push({ label: 'Signature', ok: hasSignature, detail: hasSignature ? 'Présente' : 'Non signé' });
  if (hasSignature) passed++;

  // Précision GPS
  if (gpsAccuracy !== null) {
    total++;
    const ok = gpsAccuracy < 50;
    checks.push({ label: 'Précision GPS', ok, detail: ok ? `${gpsAccuracy.toFixed(0)}m` : 'Précision faible (>50m)' });
    if (ok) passed++;
  }

  const score = total > 0 ? Math.round((passed / total) * 100) : 100;
  return { score, checks };
}
