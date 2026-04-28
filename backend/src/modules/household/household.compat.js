const EMPTY_OBJECT = {};

export const LEGACY_SAFE_HOUSEHOLD_READ_SELECT = {
  id: true,
  grappeId: true,
  numeroordre: true,
  phone: true,
  zoneId: true,
  organizationId: true,
  status: true,
  location: true,
  owner: true,
  koboData: true,
  source: true,
  version: true,
  updatedAt: true,
  deletedAt: true,
  zone: {
    select: {
      name: true,
      projectId: true,
    },
  },
};

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function toRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : EMPTY_OBJECT;
}

export function normalizeLegacyHousehold(rawHousehold) {
  const household = rawHousehold || EMPTY_OBJECT;
  const owner = toRecord(household.owner);
  const koboData = toRecord(household.koboData);
  const location = toRecord(household.location);
  const coordinates = Array.isArray(location.coordinates) ? location.coordinates : [];
  const longitude = typeof coordinates[0] === 'number' ? coordinates[0] : null;
  const latitude = typeof coordinates[1] === 'number' ? coordinates[1] : null;

  return {
    ...household,
    owner,
    koboData,
    location: Object.keys(location).length > 0 ? location : null,
    name: pickFirstString(owner.name, koboData.name, koboData.nom, koboData.beneficiaire),
    phone: pickFirstString(
      household.phone,
      owner.phone,
      owner.telephone,
      koboData.phone,
      koboData.telephone,
      koboData.tel,
      koboData.contact,
      koboData.contact_phone,
      koboData.numero_telephone,
      koboData.tel_mobile
    ),
    region: pickFirstString(koboData.region, owner.region),
    departement: pickFirstString(koboData.departement, owner.departement),
    village: pickFirstString(
      koboData.village,
      koboData.commune,
      koboData.localite,
      owner.village,
      owner.commune
    ),
    commune: pickFirstString(
      koboData.commune,
      koboData.commune_nom,
      koboData.commune_name,
      owner.commune
    ),
    latitude,
    longitude,
    alerts: [],
    assignedTeams: [],
    manualOverrides: [],
    koboSync: {},
    constructionData: {},
  };
}
