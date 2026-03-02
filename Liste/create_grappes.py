"""
create_grappes.py — Création automatique des grappes par K-Means géographique
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Configuration :
  - Kaffrine → 4 grappes de ~546 ménages
  - Tamba    → 2 grappes de ~675 ménages

Sortie :
  - Liste-LSE-grappes.xlsx  (original + colonnes grappe, latence)
  - grappes_summary.txt     (résumé par grappe)
  - grappes.json            (pour import dans l'application web)
"""

import pandas as pd
import numpy as np
import json
import warnings
from math import radians, cos, sin, asin, sqrt
warnings.filterwarnings('ignore')

# ─── Parametres ──────────────────────────────────────────────────────────────
EXCEL_PATH  = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\Liste-LSE.xlsx'
OUTPUT_XL   = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\Liste-LSE-grappes.xlsx'
OUTPUT_JSON = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\grappes.json'
OUTPUT_TXT  = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\grappes_summary.txt'

# Nombre de grappes par région
# Toute région non listée ici recevra 1 grappe par défaut
REGION_CONFIG = {
    'Kaffrine': 4,
    'Tamba':    2,
    'Tambacounda': 2,
}

# ─── Helpers ─────────────────────────────────────────────────────────────────
def haversine_km(lat1, lon1, lat2, lon2):
    """Distance en km entre deux points GPS."""
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    return 2 * R * asin(sqrt(a))

def kmeans_geo(points, k, max_iter=300, tol=1e-5):
    """
    K-Means géographique simple sans dépendance sklearn.
    points : array (N, 2) de [lat, lon]
    k      : nombre de clusters
    Retour : array (N,) d'entiers 0..k-1
    """
    np.random.seed(42)
    # Init++ : choix des centroïdes intelligents
    idx = [np.random.randint(len(points))]
    for _ in range(k - 1):
        dists = np.array([min(
            haversine_km(p[0], p[1], points[c][0], points[c][1])
            for c in idx
        ) for p in points])
        probs = dists ** 2 / (dists ** 2).sum()
        idx.append(np.random.choice(len(points), p=probs))

    centroids = points[idx]

    labels = np.zeros(len(points), dtype=int)
    for it in range(max_iter):
        # Assigner chaque point au centroïde le plus proche
        new_labels = np.array([
            min(range(k), key=lambda c: haversine_km(p[0], p[1], centroids[c][0], centroids[c][1]))
            for p in points
        ])
        # Recalculer les centroïdes
        new_centroids = np.array([
            points[new_labels == c].mean(axis=0) if (new_labels == c).any() else centroids[c]
            for c in range(k)
        ])
        if np.allclose(centroids, new_centroids, atol=tol):
            break
        centroids = new_centroids
        labels = new_labels

    return labels, centroids

# ─── Main ────────────────────────────────────────────────────────────────────
print("📂 Lecture du fichier Excel...")
df = pd.read_excel(EXCEL_PATH, sheet_name=0)
print(f"   {len(df)} ménages chargés")

# Nettoyage coordonnées
df['latitude']  = pd.to_numeric(df['latitude'],  errors='coerce')
df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')

# Filtrer les GPS invalides (Sénégal ≈ lat 12-16, lon -17 à -11)
df['gps_valid'] = (
    df['latitude'].between(12.0, 16.5) &
    df['longitude'].between(-17.5, -11.0)
)

total_valid   = df['gps_valid'].sum()
total_invalid = (~df['gps_valid']).sum()
print(f"   GPS valides   : {total_valid}")
print(f"   GPS invalides : {total_invalid} (ignorés pour le clustering, assignés à 'Sans GPS')")

df['grappe']   = 'Sans GPS'
df['grappe_num'] = 0
df['distance_centre_km'] = np.nan

# ─── Clustering par région ────────────────────────────────────────────────────
summary_lines = []
all_grappes = {}

for region in df['region'].dropna().unique():
    mask_region = (df['region'] == region) & df['gps_valid']
    subset = df[mask_region].copy()
    n = len(subset)

    if n == 0:
        continue

    # Déterminer le nb de grappes
    k = 1
    for rkey, rval in REGION_CONFIG.items():
        if rkey.lower() in region.lower():
            k = rval
            break

    # Si moins de ménages que grappes
    k = min(k, n)

    print(f"\n🗺️  {region} : {n} ménages → {k} grappe(s)")

    points = subset[['latitude', 'longitude']].values

    if k == 1:
        labels = np.zeros(n, dtype=int)
        centroids = points.mean(axis=0, keepdims=True)
    else:
        labels, centroids = kmeans_geo(points, k)

    # Renuméroter proprement par taille (Grappe 1 = la plus grande)
    cluster_sizes = [(c, (labels == c).sum()) for c in range(k)]
    cluster_sizes.sort(key=lambda x: -x[1])
    remap = {old: new for new, (old, _) in enumerate(cluster_sizes)}
    labels = np.array([remap[l] for l in labels])

    # Affecter les labels
    for i, (idx, row) in enumerate(subset.iterrows()):
        lbl = labels[i]
        grappe_name = f"{region} – Grappe {lbl + 1}"
        df.at[idx, 'grappe'] = grappe_name
        df.at[idx, 'grappe_num'] = lbl + 1
        cen = centroids[remap[int(labels[i])]]
        df.at[idx, 'distance_centre_km'] = round(
            haversine_km(row['latitude'], row['longitude'], cen[0], cen[1]), 2
        )

    # Résumé par grappe
    grappes_region = []
    for lbl in sorted(set(labels)):
        mask_g = labels == lbl
        g_points = points[mask_g]
        cen = g_points.mean(axis=0)
        dists = [haversine_km(p[0], p[1], cen[0], cen[1]) for p in g_points]
        grap_info = {
            'id':           f"{region.lower().replace(' ', '_')}_grappe_{lbl + 1}",
            'nom':          f"{region} – Grappe {lbl + 1}",
            'region':       region,
            'numero':       lbl + 1,
            'nb_menages':   int(mask_g.sum()),
            'centroide_lat': round(float(cen[0]), 6),
            'centroide_lon': round(float(cen[1]), 6),
            'rayon_moyen_km': round(float(np.mean(dists)), 2) if dists else 0,
            'rayon_max_km':  round(float(np.max(dists)), 2) if dists else 0,
        }
        grappes_region.append(grap_info)
        all_grappes[grap_info['id']] = grap_info

        line = (f"  Grappe {lbl+1}: {mask_g.sum()} ménages | "
                f"Centre: {cen[0]:.4f}, {cen[1]:.4f} | "
                f"Rayon moy: {grap_info['rayon_moyen_km']} km | "
                f"Rayon max: {grap_info['rayon_max_km']} km")
        print(line)
        summary_lines.append(line)

print()

# ─── Export Excel ─────────────────────────────────────────────────────────────
print("💾 Export Excel...")
cols_out = [c for c in df.columns if c not in ['gps_valid']]
cols_out_final = cols_out + ['grappe', 'grappe_num', 'distance_centre_km'] if 'grappe' not in cols_out else cols_out
df[cols_out].to_excel(OUTPUT_XL, index=False)
print(f"   → {OUTPUT_XL}")

# ─── Export JSON ──────────────────────────────────────────────────────────────
print("💾 Export JSON pour l'application web...")

class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

json_out = {
    'generated_at': pd.Timestamp.now().isoformat(),
    'total_menages': int(total_valid),
    'configuration': REGION_CONFIG,
    'grappes': list(all_grappes.values())
}
with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(json_out, f, ensure_ascii=False, indent=2, cls=NpEncoder)
print(f"   → {OUTPUT_JSON}")

# ─── Résumé texte ─────────────────────────────────────────────────────────────
with open(OUTPUT_TXT, 'w', encoding='utf-8') as f:
    f.write("RÉSUMÉ DES GRAPPES — PROJET LSE\n")
    f.write("=" * 60 + "\n\n")
    for line in summary_lines:
        f.write(line + "\n")
    f.write(f"\n\nTotal ménages avec GPS valide : {total_valid}\n")
    f.write(f"Total ménages sans GPS        : {total_invalid}\n")
print(f"   → {OUTPUT_TXT}")

print("\n✅ Terminé ! Grappes créées avec succès.")
print(f"   Total grappes : {len(all_grappes)}")
for g in all_grappes.values():
    print(f"   - {g['nom']} : {g['nb_menages']} ménages (rayon moy. {g['rayon_moyen_km']} km)")
