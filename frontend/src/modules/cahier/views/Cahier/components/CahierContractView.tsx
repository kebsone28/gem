import React from 'react';
import { FileText, ShieldCheck, Scale } from 'lucide-react';
import type { ContractTemplateLibrary } from '../../../../../data/contractTemplates';
import { isContractHeading } from '../utils/cahierUtils';

interface CahierContractViewProps {
  contractLibrary: ContractTemplateLibrary;
  selectedRole: string;
  isEditing: boolean;
  editData: any;
  setEditData: React.Dispatch<React.SetStateAction<any>>;
}

export const CahierContractView: React.FC<CahierContractViewProps> = ({
  contractLibrary,
  selectedRole,
  isEditing,
  editData,
  setEditData,
}) => {
  // Map selectedRole → valid library key. Falls back to 'LOT A' so
  // template is never undefined (avoids runtime crash on unknown roles).
  const LOT_MAP: Record<string, string> = {
    'Pré-câblage': 'LOT A',
    'Maçonnerie': 'LOT B',
    'Réseau Extérieur': 'LOT C',
  };
  const currentLot = LOT_MAP[selectedRole] ?? Object.keys(contractLibrary)[0] ?? 'LOT A';
  const template = contractLibrary[currentLot];


  if (!template) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center text-slate-500">
        <p className="text-lg font-bold">Aucun contrat disponible pour ce lot.</p>
        <p className="text-sm mt-2 opacity-60">Rôle sélectionné : {selectedRole}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-6 md:p-12 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Filigrane décoratif */}
        <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
          <Scale size={300} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10 pb-6 border-b border-white/5">
            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-lg">
              <FileText size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Clauses Particulières</p>
              <h2 className="text-2xl font-black text-white">{template.title}</h2>
            </div>
          </div>

          {isEditing ? (
            <textarea
              value={editData.contractContent}
              onChange={(e) => setEditData((prev: any) => ({ ...prev, contractContent: e.target.value }))}
              className="w-full h-[600px] bg-slate-950 border border-indigo-500/30 rounded-2xl p-6 text-slate-300 text-sm focus:border-indigo-500 outline-none resize-none font-mono leading-relaxed"
              placeholder="Saisissez les clauses contractuelles ici..."
            />
          ) : (
            <div className="prose prose-invert max-w-none">
              <div className="space-y-6">
                {template.content.map((line, i) => {
                  const isHeading = isContractHeading(line);
                  return (
                    <p
                      key={i}
                      className={`${
                        isHeading
                          ? 'text-lg font-black text-white uppercase tracking-wider mt-10 mb-4 flex items-center gap-3'
                          : 'text-slate-400 leading-relaxed text-base font-medium'
                      }`}
                    >
                      {isHeading && <div className="h-4 w-1 bg-indigo-500 rounded-full" />}
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3 text-slate-500">
              <ShieldCheck size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Document Certifié GED OS SAAS</span>
            </div>
            <div className="flex gap-4">
              <div className="w-32 h-px bg-white/10 self-center" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">Paraphe Obligatoire</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
