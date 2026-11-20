/** Shared validation for samples-src/sources.json (used by the build script and its test). */
export const ALLOWED_LICENSES = ['CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0'];
export const CATEGORIES = [
  'Kicks',
  'Snares',
  'Hi-hats',
  'Claps & snaps',
  'Cymbals',
  'Percussion',
  'FX & risers',
  'Melodic one-shots',
  'Guitars',
  'Strings',
  'Vocal chops',
];

export function validateSources(src) {
  const problems = [];
  const kitIds = new Set((src.kits ?? []).map((k) => k.id));
  const seen = new Set();
  for (const e of src.samples ?? []) {
    const where = `sources.json: ${e.id ?? '(no id)'}`;
    if (!e.id) problems.push(`${where} has no id`);
    if (seen.has(e.id)) problems.push(`${where} is a duplicate id`);
    seen.add(e.id);
    if (!ALLOWED_LICENSES.includes(e.license))
      problems.push(`${where} has a license that isn't allowed: ${e.license}`);
    if (!/^https:\/\//.test(e.sourceUrl ?? '')) problems.push(`${where} needs an https sourceUrl`);
    if (!e.author) problems.push(`${where} needs an author`);
    if (!e.downloadUrl && !e.freesoundId)
      problems.push(`${where} needs a downloadUrl or freesoundId`);
    if (!kitIds.has(e.kit)) problems.push(`${where} uses unknown kit ${e.kit}`);
    if (!CATEGORIES.includes(e.category))
      problems.push(`${where} uses unknown category ${e.category}`);
    if (e.license.startsWith('CC-BY') && !e.licenseUrl)
      problems.push(`${where} needs a licenseUrl for attribution`);
  }
  return problems;
}
