import React from 'react';
import { FileText, ShieldCheck, Scale } from 'lucide-react';
import type { ContractTemplateLibrary } from '@/data/contractTemplates';
import { isContractHeading } from '../utils/cahierUtils';

function renderFormattedText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

interface CahierContractViewProps {
  contractLibrary: ContractTemplateLibrary;
  selectedContractLot: string;
  isEditing: boolean;
  editData: any;
  setEditData: React.Dispatch<React.SetStateAction<any>>;
}

export const CahierContractView: React.FC<CahierContractViewProps> = ({
  contractLibrary,
  selectedContractLot,
  isEditing,
  editData,
  setEditData,
}) => {
  const currentLot = selectedContractLot ?? Object.keys(contractLibrary)[0] ?? 'LOT A';
  const template = contractLibrary[currentLot];

  if (!template) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center text-slate-500">
        <p className="text-lg font-bold">Aucun contrat disponible pour ce lot.</p>
        <p className="text-sm mt-2 opacity-60">Lot sélectionné : {selectedContractLot}</p>
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
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">
                Clauses Particulières
              </p>
              <h2 className="text-2xl font-black text-white">{template.title}</h2>
            </div>
          </div>

          {isEditing ? (
            <textarea
              value={editData.contractContent}
              onChange={(e) =>
                setEditData((prev: any) => ({ ...prev, contractContent: e.target.value }))
              }
              className="w-full h-[600px] bg-slate-950 border border-indigo-500/30 rounded-2xl p-6 text-slate-300 text-sm focus:border-indigo-500 outline-none resize-none font-mono leading-relaxed"
              placeholder="Saisissez les clauses contractuelles ici..."
            />
          ) : (
            <div className="prose prose-invert max-w-none">
              <div className="space-y-6">
                {template.content.map((line, i) => {
                  const isHeading = isContractHeading(line);
                  const isSubheading = /^\d+\.\s+[A-Z]/.test(line);
                  const isBulletStart = /^[•*-]\s+/.test(line) && !/;\s*$/.test(line);
                  const isCapitalColon = /^[A-Z\u00C0-\u00DC].*:\s*$/.test(line);
                  const isBulletItem =
                    /;\s*$/.test(line) &&
                    (/^[a-z\u00E9-\u00FC]/.test(line) || /^[•*-]\s+/.test(line));
                  const isColonDescription =
                    !isHeading &&
                    !isBulletStart &&
                    !isBulletItem &&
                    !isCapitalColon &&
                    !isSubheading &&
                    /^[A-Z\u00C0-\u00DC].* : /.test(line) &&
                    !/:\s*$/.test(line) &&
                    !/^Dans le cadre/.test(line) &&
                    !/^Le Lot [A-C] couvre/.test(line);

                  // Bold the title part before " : " in lines like "Title : description"
                  const displayLine = isColonDescription
                    ? line.replace(/^([A-Z\u00C0-\u00DC][^:]+) : /, '**$1** : ')
                    : line;

                  if (isBulletStart) {
                    return (
                      <p
                        key={i}
                        className="text-base font-bold text-indigo-400 mt-6 mb-3 ml-4 flex items-start gap-3"
                      >
                        <span className="text-indigo-400/60 mt-1">{line[0]}</span>
                        <span>{renderFormattedText(line.replace(/^[•*-]\s+/, ''))}</span>
                      </p>
                    );
                  }

                  if (isBulletItem) {
                    return (
                      <li
                        key={i}
                        className="text-slate-400 leading-relaxed text-base font-medium ml-6"
                      >
                        {renderFormattedText(line.replace(/;\s*$/, '').replace(/^[•*-]\s+/, ''))}
                      </li>
                    );
                  }

                  return (
                    <p
                      key={i}
                      className={`${
                        isHeading
                          ? 'text-lg font-black text-white uppercase tracking-wider mt-10 mb-4 flex items-center gap-3'
                          : isSubheading
                            ? 'text-base font-bold text-indigo-400 mt-6 mb-3 ml-4'
                            : isCapitalColon
                              ? 'text-base font-bold text-white mt-4 mb-2'
                              : 'text-slate-400 leading-relaxed text-base font-medium'
                      }`}
                    >
                      {isHeading && <div className="h-4 w-1 bg-indigo-500 rounded-full" />}
                      {renderFormattedText(displayLine)}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3 text-slate-500">
              <ShieldCheck size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Document Certifié GED OS SAAS
              </span>
            </div>
            <div className="flex gap-4">
              <div className="w-32 h-px bg-white/10 self-center" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">
                Paraphe Obligatoire
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
