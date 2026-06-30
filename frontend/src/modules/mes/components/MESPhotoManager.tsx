import React, { useState, useRef } from 'react';
import { Camera, X, ZoomIn, Download, Trash2, Plus } from 'lucide-react';

interface MESPhotoManagerProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

const MESPhotoManager: React.FC<MESPhotoManagerProps> = ({ photos, onChange, maxPhotos = 10 }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > maxPhotos) {
      alert(`Maximum ${maxPhotos} photos autorisées`);
      return;
    }

    setUploading(true);

    try {
      const newPhotos: string[] = [];
      
      for (const file of files) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        newPhotos.push(dataUrl);
      }

      onChange([...photos, ...newPhotos]);
    } catch (error) {
      console.error('Error uploading photos:', error);
      alert('Erreur lors de l\'upload des photos');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onChange(newPhotos);
    if (selectedPhoto === photos[index]) {
      setSelectedPhoto(null);
    }
  };

  const handleDownloadPhoto = (photo: string, index: number) => {
    const link = document.createElement('a');
    link.href = photo;
    link.download = `mes_photo_${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Photo grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {photos.map((photo, index) => (
          <div key={index} className="relative group aspect-square bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
            <img
              src={photo}
              alt={`Photo ${index + 1}`}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setSelectedPhoto(photo)}
            />
            
            {/* Overlay with actions */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedPhoto(photo)}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title="Agrandir"
              >
                <ZoomIn size={16} className="text-white" />
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPhoto(photo, index)}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title="Télécharger"
              >
                <Download size={16} className="text-white" />
              </button>
              <button
                type="button"
                onClick={() => handleRemovePhoto(index)}
                className="p-2 bg-red-500/80 rounded-lg hover:bg-red-500 transition-colors"
                title="Supprimer"
              >
                <Trash2 size={16} className="text-white" />
              </button>
            </div>

            {/* Photo number */}
            <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
              {index + 1}
            </div>
          </div>
        ))}

        {/* Add photo button */}
        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square bg-slate-800/50 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-slate-800 hover:border-slate-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <Camera size={24} className="text-slate-400 animate-pulse" />
            ) : (
              <>
                <Plus size={24} className="text-slate-400" />
                <Camera size={16} className="text-slate-500" />
              </>
            )}
            <span className="text-xs text-slate-400">
              {uploading ? 'Upload...' : 'Ajouter'}
            </span>
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Photo count */}
      <div className="text-xs text-slate-400">
        {photos.length} / {maxPhotos} photos
      </div>

      {/* Photo lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={selectedPhoto}
              alt="Photo agrandie"
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <X size={24} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MESPhotoManager;
