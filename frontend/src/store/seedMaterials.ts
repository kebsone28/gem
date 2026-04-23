 
import { db } from './db';

const MATERIALS = [
  // HTA
  { name: 'Poteau Béton HTA 12m/800daN', category: 'HTA', stock: 150, unitPrice: 350000 },
  { name: 'Transformateur H61 100kVA 30kV/B2', category: 'HTA', stock: 5, unitPrice: 2400000 },
  { name: 'Câble Almélec 54.6 mm²', category: 'HTA', stock: 12000, unitPrice: 1500 },
  { name: 'IAC Type Aérien 30kV', category: 'HTA', stock: 2, unitPrice: 850000 },

  // BT
  { name: 'Câble Torsadé Alu 3x70+54.6+16', category: 'RESEAU', stock: 8500, unitPrice: 2200 },
  { name: 'Câble Torsadé Alu 3x50+54.6+16', category: 'RESEAU', stock: 4000, unitPrice: 1800 },
  { name: "Pince d'Ancrage PA 1500", category: 'RESEAU', stock: 300, unitPrice: 4500 },
  { name: 'Coffret de Façade (Branchement)', category: 'NS 01-001', stock: 2350, unitPrice: 18500 },

  // EP
  { name: 'Luminaire LED 60W Senelec', category: 'ECLAIRAGE PUBLIC', stock: 80, unitPrice: 125000 },
  { name: 'Crosse en Acier Galva 2m', category: 'ECLAIRAGE PUBLIC', stock: 85, unitPrice: 35000 },

  // NS 01-001 (Kits)
  { name: 'Compteur Woyofal Monophasé', category: 'NS 01-001', stock: 2350, unitPrice: 45000 },
  {
    name: 'Disjoncteur de Branchement 5/15A',
    category: 'NS 01-001',
    stock: 2350,
    unitPrice: 12500,
  },
  {
    name: 'Kit Intérieur Standard (Hublot/Prise)',
    category: 'NS 01-001',
    stock: 2350,
    unitPrice: 25000,
  },
];

export async function seedMaterials(projectId: string) {
  // Clear existing for this project to avoid duplicates if re-run
  const existing = await (
    db as unknown as {
      inventory: {
        where: (key: string) => { equals: (val: string) => { toArray: () => Promise<unknown[]> } };
      };
    }
  ).inventory
    .where('projectId')
    .equals(projectId)
    .toArray();
  if (existing.length > 0) return;

  for (const mat of MATERIALS) {
    await (db as unknown as { inventory: { add: (item: unknown) => Promise<void> } }).inventory.add(
      {
        ...mat,
        projectId,
        id: `mat_seed_${mat.name.toLowerCase().replace(/ /g, '_')}`,
        isActive: true,
      }
    );
  }
}
