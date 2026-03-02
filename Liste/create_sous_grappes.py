"""
create_sous_grappes.py — Génération des sous-grappes par K-Means géographique
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Principe : chaque grappe est découpée en sous-grappes correspondant
au nombre d'équipes intérieur affectées à cette grappe.

Configuration équipes :
  Kaffrine  : 25 équipes intérieur → 4 grappes de 6-7 équipes chacune
  Tamba     : 16 équipes intérieur → 2 grappes de 8 équipes chacune

Numérotation : KAF-G1-SG01, KAF-G2-SG01, TAM-G1-SG01, etc.
"""

import pandas as pd
import numpy as np
import json
import warnings
from math import radians, cos, sin, asin, sqrt
warnings.filterwarnings('ignore')

# ─── Chemins ──────────────────────────────────────────────────────────────────
EXCEL_PATH     = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\Liste-LSE.xlsx'
GRAPPES_JSON   = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\grappes.json'
OUTPUT_JSON    = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\grappes_complet.json'
OUTPUT_XL      = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\Liste-LSE-grappes.xlsx'

# ─── Configuration équipes et grappes ─────────────────────────────────────────
# Préfixe par région pour la numérotation
REGION_PREFIX = {
    'Kaffrine':    'KAF',
    'Tambacounda': 'TAM',
    'Tamba':       'TAM',
}

# Nombre total d'équipes intérieur par région → répartition sur les grappes
EQUIPES_INTERIEURES = {
    'Kaffrine':    25,
    'Tambacounda': 16,
}

# Nombre de grappes par région
GRAPPES_PAR_REGION = {
    'Kaffrine':    4,
    'Tambacounda': 2,
}


# ─── Helpers ─────────────────────────────────────────────────────────────────
def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    return 2 * R * asin(sqrt(a))

def kmeans_geo(points, k, max_iter=300, tol=1e-5):
    np.random.seed(42)
    idx = [np.random.randint(len(points))]
    for _ in range(k - 1):
        dists = np.array([min(
            haversine_km(p[0], p[1], points[c][0], points[c][1])
            for c in idx
        ) for p in points])
        probs = dists**2 / (dists**2).sum()
        idx.append(np.random.choice(len(points), p=probs))
    centroids = points[idx]
    labels = np.zeros(len(points), dtype=int)
    for _ in range(max_iter):
        new_labels = np.array([
            min(range(k), key=lambda c: haversine_km(p[0], p[1], centroids[c][0], centroids[c][1]))
            for p in points
        ])
        new_centroids = np.array([
            points[new_labels == c].mean(axis=0) if (new_labels == c).any() else centroids[c]
            for c in range(k)
        ])
        if np.allclose(centroids, new_centroids, atol=tol):
            break
        centroids, labels = new_centroids, new_labels
    return labels, centroids

class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer): return int(obj)
        if isinstance(obj, np.floating): return float(obj)
        if isinstance(obj, np.ndarray): return obj.tolist()
        return super().default(obj)


# ─── Lecture données ──────────────────────────────────────────────────────────
print("📂 Lecture données...")
df = pd.read_excel(EXCEL_PATH, sheet_name=0)
df['latitude']  = pd.to_numeric(df['latitude'],  errors='coerce')
df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')
df['gps_valid'] = df['latitude'].between(12.0, 16.5) & df['longitude'].between(-17.5, -11.0)
df['grappe']      = 'Sans GPS'
df['grappe_id']   = ''
df['sous_grappe'] = 'Sans GPS'
df['sous_grappe_id'] = ''
df['equipe_suggeree'] = ''

with open(GRAPPES_JSON, 'r', encoding='utf-8') as f:
    grappes_data = json.load(f)

# ─── Clustering principal (grappes) ───────────────────────────────────────────
print("🗺️  Clustering principal...")
for region in df['region'].dropna().unique():
    nb_grappes = GRAPPES_PAR_REGION.get(region, 1)
    mask = (df['region'] == region) & df['gps_valid']
    subset = df[mask].copy()
    if len(subset) == 0: continue
    k = min(nb_grappes, len(subset))
    points = subset[['latitude', 'longitude']].values
    labels, _ = kmeans_geo(points, k) if k > 1 else (np.zeros(len(subset), dtype=int), points.mean(axis=0, keepdims=True))
    # Sort clusters by size descending
    sizes = [(c, (labels==c).sum()) for c in range(k)]
    sizes.sort(key=lambda x: -x[1])
    remap = {old: new for new, (old, _) in enumerate(sizes)}
    labels = np.array([remap[l] for l in labels])
    prefix = REGION_PREFIX.get(region, region[:3].upper())
    for i, idx in enumerate(subset.index):
        g = labels[i] + 1
        df.at[idx, 'grappe']    = f"{region} – Grappe {g}"
        df.at[idx, 'grappe_id'] = f"{prefix}-G{g}"

# ─── Sous-clustering (sous-grappes) ───────────────────────────────────────────
print("🔬 Sous-clustering...")

# Calcul des équipes par grappe
# Distribution proportionnelle au nb de ménages
def distribute_equipes(nb_equipes_total, grappes_region, df_region):
    totals = {gid: (df_region['grappe_id'] == gid).sum() for gid in grappes_region}
    total_menages = sum(totals.values())
    distribution = {}
    remaining = nb_equipes_total
    for gid in grappes_region[:-1]:
        eq = round(nb_equipes_total * totals[gid] / total_menages) if total_menages > 0 else 1
        eq = max(1, eq)
        distribution[gid] = eq
        remaining -= eq
    distribution[grappes_region[-1]] = max(1, remaining)
    return distribution

all_sous_grappes = []
equipe_counter = {}

for region in df['region'].dropna().unique():
    prefix     = REGION_PREFIX.get(region, region[:3].upper())
    nb_grappes = GRAPPES_PAR_REGION.get(region, 1)
    nb_equipes = EQUIPES_INTERIEURES.get(region, nb_grappes)
    df_region  = df[df['region'] == region]
    grappes_region = [f"{prefix}-G{g+1}" for g in range(nb_grappes)]

    distribution = distribute_equipes(nb_equipes, grappes_region, df_region)

    # Numérotation séquentielle par région
    equipe_num = 1

    for g_idx in range(nb_grappes):
        grappe_id  = f"{prefix}-G{g_idx+1}"
        nb_sg      = distribution.get(grappe_id, 1)

        mask_g = (df['region'] == region) & (df['grappe_id'] == grappe_id) & df['gps_valid']
        subset = df[mask_g].copy()
        if len(subset) == 0: continue

        k = min(nb_sg, len(subset))
        points = subset[['latitude', 'longitude']].values

        if k <= 1:
            sg_labels = np.zeros(len(subset), dtype=int)
            centroids = points.mean(axis=0, keepdims=True)
        else:
            sg_labels, centroids = kmeans_geo(points, k)
            sizes = [(c, (sg_labels==c).sum()) for c in range(k)]
            sizes.sort(key=lambda x: -x[1])
            remap = {old: new for new, (old, _) in enumerate(sizes)}
            sg_labels = np.array([remap[l] for l in sg_labels])

        # Assign sous-grappes
        for sg in range(k):
            sg_mask = sg_labels == sg
            sg_points = points[sg_mask]
            cen = sg_points.mean(axis=0)
            sg_id  = f"{grappe_id}-SG{str(sg+1).zfill(2)}"
            eq_id  = f"Éq.Int-{str(equipe_num).zfill(2)}"
            nb_men = int(sg_mask.sum())

            all_sous_grappes.append({
                'id':              sg_id,
                'grappe_id':       grappe_id,
                'region':          region,
                'grappe_numero':   g_idx + 1,
                'sous_grappe_numero': sg + 1,
                'nom':             f"{region} – Grappe {g_idx+1} – SG{str(sg+1).zfill(2)}",
                'code':            sg_id,
                'nb_menages':      nb_men,
                'equipe_affectee': eq_id,
                'centroide_lat':   round(float(cen[0]), 6),
                'centroide_lon':   round(float(cen[1]), 6),
            })

            # Mark households
            sg_indices = subset.index[sg_mask]
            for idx in sg_indices:
                df.at[idx, 'sous_grappe']    = f"{region} – {sg_id}"
                df.at[idx, 'sous_grappe_id'] = sg_id
                df.at[idx, 'equipe_suggeree'] = eq_id

            print(f"  {sg_id} → {eq_id} : {nb_men} ménages")
            equipe_num += 1

# ─── Export JSON complet ──────────────────────────────────────────────────────
print("\n💾 Export JSON complet...")

# Enrichir les grappes originales avec leurs sous-grappes
for g in grappes_data['grappes']:
    g['sous_grappes'] = [sg for sg in all_sous_grappes if sg['grappe_id'] == g['id'].upper().replace('_GRAPPE_', '-G')]

grappes_data['sous_grappes'] = all_sous_grappes

with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(grappes_data, f, ensure_ascii=False, indent=2, cls=NpEncoder)
print(f"   → {OUTPUT_JSON}")

# ─── Export JSON simple pour l'UI ─────────────────────────────────────────────
ui_json_path = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\src\config\grappes-config.js'
ui_data = {
    'grappes':       grappes_data['grappes'],
    'sous_grappes':  all_sous_grappes,
}
js_content = f"// Généré automatiquement par create_sous_grappes.py\nconst GRAPPES_CONFIG = {json.dumps(ui_data, ensure_ascii=False, indent=2, cls=NpEncoder)};\nif (typeof window !== 'undefined') window.GRAPPES_CONFIG = GRAPPES_CONFIG;\nif (typeof module !== 'undefined') module.exports = GRAPPES_CONFIG;\n"
with open(ui_json_path, 'w', encoding='utf-8') as f:
    f.write(js_content)
print(f"   → {ui_json_path}")

# ─── Export Excel ─────────────────────────────────────────────────────────────
print("💾 Export Excel...")
cols = [c for c in df.columns if c != 'gps_valid']
df[cols].to_excel(OUTPUT_XL, index=False)
print(f"   → {OUTPUT_XL}")

print(f"\n✅ {len(all_sous_grappes)} sous-grappes créées.")
for sg in all_sous_grappes:
    print(f"   {sg['code']:20s} → {sg['equipe_affectee']:15s} ({sg['nb_menages']} ménages)")
