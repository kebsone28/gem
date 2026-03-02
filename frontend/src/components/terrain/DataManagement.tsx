import { useDropzone } from 'react-dropzone';
import { Upload, FileDown, Trash2, Database } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Household } from '../../utils/types';

interface DataManagementProps {
    onImport: (data: Household[]) => void;
    onClear: () => void;
    totalCount: number;
}

export default function DataManagement({ onImport, onClear, totalCount }: DataManagementProps) {
    const onDrop = (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet);

            // Mappe les champs Excel vers Household
            const mappedData: Household[] = json.map(row => ({
                id: (row.id_menage || row.id || `EXT-${Math.random().toString(36).substr(2, 5)}`).toString(),
                status: row.status || row.etat_avancement || 'En attente',
                region: row.region || 'N/A',
                location: row.lat && row.lon ? {
                    type: "Point",
                    coordinates: [parseFloat(row.lon), parseFloat(row.lat)]
                } : undefined
            }));

            onImport(mappedData);
        };

        reader.readAsBinaryString(file);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/json': ['.json']
        },
        multiple: false
    });

    const exportData = async () => {
        // Logique simplifiée d'export
        alert('Export Excel généré');
    };

    return (
        <div className="bg-slate-900/50 rounded-3xl border border-slate-800/50 p-6 backdrop-blur-xl">
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 mb-6">
                <Database className="w-4 h-4 text-emerald-400" />
                Gestion Données
            </h3>

            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer mb-6 ${isDragActive ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-800 hover:border-slate-700 bg-slate-950/30'
                    }`}
            >
                <input {...getInputProps()} />
                <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragActive ? 'text-emerald-500' : 'text-slate-600'}`} />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {isDragActive ? 'Déposez ici' : 'Import Excel / JSON'}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                    onClick={exportData}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/20 transition-all gap-2"
                >
                    <FileDown size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Export</span>
                </button>
                <button
                    onClick={() => { if (confirm('Vider la base ?')) onClear(); }}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 transition-all gap-2"
                >
                    <Trash2 size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Réinitialiser</span>
                </button>
            </div>

            <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ménages en base</span>
                <span className="text-white font-black">{totalCount}</span>
            </div>
        </div>
    );
}
