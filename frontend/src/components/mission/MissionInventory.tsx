 
import { ListChecks, Package, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';

interface InventoryItem {
  id: string;
  label: string;
  quantityTaken: number;
  quantityReturned?: number;
  isChecked: boolean;
}

interface MissionInventoryProps {
  inventory?: InventoryItem[];
  onChange: (inventory: InventoryItem[]) => void;
}

const DEFAULT_ITEMS = [
  { id: '1', label: 'Tablettes de collecte (Saisie)', quantityTaken: 2, isChecked: false },
  { id: '2', label: 'Compteurs monophasés', quantityTaken: 10, isChecked: false },
  { id: '3', label: 'Kits solaires de test', quantityTaken: 1, isChecked: false },
  { id: '4', label: 'Gilets réfléchissants & EPI', quantityTaken: 4, isChecked: false },
  { id: '5', label: 'Câbles de raccordement (mètres)', quantityTaken: 50, isChecked: false },
];

export function MissionInventory({ inventory = [], onChange }: MissionInventoryProps) {
  const activeInventory = inventory.length > 0 ? inventory : DEFAULT_ITEMS;

  const handleToggleCheck = (id: string) => {
    const newInventory = activeInventory.map((item) =>
      item.id === id ? { ...item, isChecked: !item.isChecked } : item
    );
    onChange(newInventory);
  };

  const handleUpdateQuantity = (
    id: string,
    field: 'quantityTaken' | 'quantityReturned',
    value: number
  ) => {
    const newInventory = activeInventory.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    onChange(newInventory);
  };

  const handleAddItem = () => {
    const newItem: InventoryItem = {
      id: crypto.randomUUID(),
      label: 'Nouvel article...',
      quantityTaken: 1,
      isChecked: false,
    };
    onChange([...activeInventory, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    onChange(activeInventory.filter((item) => item.id !== id));
  };

  const allChecked = activeInventory.every((item) => item.isChecked);

  return (
    <section className="glass-card !p-8 !rounded-[2.5rem] space-y-8">
      <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 pb-6">
        <div>
          <h2 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-sm flex items-center gap-3">
            <div className="p-1.5 bg-amber-500/10 rounded-lg">
              <ListChecks size={16} className="text-amber-500" />
            </div>
            Inventaire & Préparatifs
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-60">
            Vérification du matériel avant départ
          </p>
        </div>

        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
            allChecked
              ? 'bg-emerald-500/10 text-emerald-600 shadow-inner'
              : 'bg-amber-500/10 text-amber-600 shadow-inner'
          }`}
        >
          {allChecked ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {allChecked ? 'Prêt pour départ' : 'Vérification en cours'}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-12 gap-4 px-4 mb-2">
          <div className="col-span-6 text-xs font-black uppercase text-slate-400 tracking-widest">
            Article / Désignation
          </div>
          <div className="col-span-3 text-xs font-black uppercase text-slate-400 tracking-widest text-center">
            Qté Sortie
          </div>
          <div className="col-span-2 text-xs font-black uppercase text-slate-400 tracking-widest text-center">
            Check
          </div>
          <div className="col-span-1"></div>
        </div>

        <div className="space-y-2">
          {activeInventory.map((item) => (
            <div
              key={item.id}
              className={`grid grid-cols-12 gap-4 items-center p-4 rounded-2xl border transition-all ${
                item.isChecked
                  ? 'bg-white dark:bg-slate-800 border-indigo-500/20 opacity-100'
                  : 'bg-slate-100/80 dark:bg-slate-900/30 border-transparent opacity-80'
              }`}
            >
              <div className="col-span-6 flex items-center gap-3">
                <Package
                  size={16}
                  className={item.isChecked ? 'text-indigo-500' : 'text-slate-400'}
                />
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => {
                    const newInv = activeInventory.map((i) =>
                      i.id === item.id ? { ...i, label: e.target.value } : i
                    );
                    onChange(newInv);
                  }}
                  title="Désignation de l'article"
                  className="bg-transparent border-none text-xs font-black text-slate-800 dark:text-white focus:ring-0 w-full p-0"
                />
              </div>

              <div className="col-span-3 flex justify-center">
                <input
                  type="number"
                  value={item.quantityTaken}
                  onChange={(e) =>
                    handleUpdateQuantity(item.id, 'quantityTaken', Number(e.target.value))
                  }
                  title="Quantité prélevée"
                  className="w-16 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-center text-xs font-black py-1 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="col-span-2 flex justify-center">
                <button
                  onClick={() => handleToggleCheck(item.id)}
                  title={item.isChecked ? 'Décocher' : 'Cocher'}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                    item.isChecked
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                      : 'bg-slate-200 dark:bg-slate-700 text-transparent'
                  }`}
                >
                  <CheckCircle2 size={14} />
                </button>
              </div>

              <div className="col-span-1 flex justify-end">
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  aria-label="Supprimer l'article"
                  className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleAddItem}
          className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:bg-slate-50 dark:bg-slate-800/50 dark:hover:bg-slate-900/50 hover:text-indigo-500 hover:border-indigo-500/30 transition-all font-black text-xs uppercase tracking-widest"
        >
          <Plus size={16} />
          Ajouter un article à la checklist
        </button>
      </div>
    </section>
  );
}
