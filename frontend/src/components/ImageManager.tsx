// Image Manager Component - Manage project images with editing capabilities
import React, { useState, useRef } from 'react';
import { Upload, X, Edit, Image as ImageIcon, Plus } from 'lucide-react';
import { ImageEditor } from './ImageEditor';

export interface ProjectImage {
  id: string;
  url: string;
  name: string;
  category: 'technical' | 'site' | 'validation' | 'other';
  uploadedAt: Date;
}

export interface ImageManagerProps {
  images: ProjectImage[];
  onImagesChange: (images: ProjectImage[]) => void;
  maxImages?: number;
  acceptedTypes?: string[];
}

export const ImageManager: React.FC<ImageManagerProps> = ({
  images,
  onImagesChange,
  maxImages = 20,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'],
}) => {
  const [editingImage, setEditingImage] = useState<ProjectImage | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newImages: ProjectImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!acceptedTypes.includes(file.type)) {
        alert(`Type de fichier non accepté: ${file.type}`);
        continue;
      }

      // Create object URL for preview
      const url = URL.createObjectURL(file);
      
      newImages.push({
        id: `img_${Date.now()}_${i}`,
        url,
        name: file.name,
        category: 'other',
        uploadedAt: new Date(),
      });
    }

    if (images.length + newImages.length > maxImages) {
      alert(`Maximum ${maxImages} images autorisées`);
      return;
    }

    onImagesChange([...images, ...newImages]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle image deletion
  const handleDeleteImage = (imageId: string) => {
    const imageToDelete = images.find(img => img.id === imageId);
    if (imageToDelete) {
      URL.revokeObjectURL(imageToDelete.url);
    }
    onImagesChange(images.filter(img => img.id !== imageId));
  };

  // Handle image edit
  const handleEditImage = (image: ProjectImage) => {
    setEditingImage(image);
    setIsEditorOpen(true);
  };

  // Handle save edited image
  const handleSaveEditedImage = (editedBlob: Blob) => {
    if (!editingImage) return;

    const editedUrl = URL.createObjectURL(editedBlob);
    
    onImagesChange(
      images.map(img =>
        img.id === editingImage.id
          ? { ...img, url: editedUrl, name: `${img.name}_edited` }
          : img
      )
    );

    // Revoke old URL
    URL.revokeObjectURL(editingImage.url);
    
    setIsEditorOpen(false);
    setEditingImage(null);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditorOpen(false);
    setEditingImage(null);
  };

  // Handle category change
  const handleCategoryChange = (imageId: string, category: ProjectImage['category']) => {
    onImagesChange(
      images.map(img =>
        img.id === imageId ? { ...img, category } : img
      )
    );
  };

  // Group images by category
  const groupedImages = {
    technical: images.filter(img => img.category === 'technical'),
    site: images.filter(img => img.category === 'site'),
    validation: images.filter(img => img.category === 'validation'),
    other: images.filter(img => img.category === 'other'),
  };

  const categoryLabels = {
    technical: 'Images Techniques',
    site: 'Photos de Chantier',
    validation: 'Validations',
    other: 'Autres',
  };

  const categoryColors = {
    technical: 'border-blue-300 bg-blue-50',
    site: 'border-green-300 bg-green-50',
    validation: 'border-purple-300 bg-purple-50',
    other: 'border-gray-300 bg-gray-50',
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= maxImages}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          <Upload size={20} />
          <span>Ajouter des images</span>
        </button>
        <p className="mt-2 text-sm text-gray-600">
          {images.length} / {maxImages} images
        </p>
        <p className="text-xs text-gray-500">
          Formats acceptés: JPEG, PNG, WebP
        </p>
      </div>

      {/* Images by Category */}
      {(Object.keys(groupedImages) as Array<keyof typeof groupedImages>).map(category => {
        const categoryImages = groupedImages[category];
        if (categoryImages.length === 0) return null;

        return (
          <div key={category} className="space-y-3">
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-sm ${categoryColors[category]}`}>
                {categoryLabels[category]}
              </span>
              <span className="text-gray-500">({categoryImages.length})</span>
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categoryImages.map(image => (
                <div
                  key={image.id}
                  className={`relative group border-2 rounded-lg overflow-hidden ${categoryColors[category]}`}
                >
                  {/* Image Preview */}
                  <div className="aspect-square relative">
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEditImage(image)}
                        className="p-2 bg-white rounded-full hover:bg-blue-100 transition"
                        title="Éditer"
                      >
                        <Edit size={16} className="text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteImage(image.id)}
                        className="p-2 bg-white rounded-full hover:bg-red-100 transition"
                        title="Supprimer"
                      >
                        <X size={16} className="text-red-600" />
                      </button>
                    </div>
                  </div>

                  {/* Image Info */}
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-800 truncate" title={image.name}>
                      {image.name}
                    </p>
                    <select
                      value={image.category}
                      onChange={(e) => handleCategoryChange(image.id, e.target.value as ProjectImage['category'])}
                      className="mt-1 text-xs w-full border rounded px-1 py-0.5"
                    >
                      <option value="technical">Technique</option>
                      <option value="site">Chantier</option>
                      <option value="validation">Validation</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty State */}
      {images.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <ImageIcon size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">Aucune image</p>
          <p className="text-sm">Ajoutez des images pour commencer</p>
        </div>
      )}

      {/* Image Editor Modal */}
      {isEditorOpen && editingImage && (
        <ImageEditor
          imageUrl={editingImage.url}
          onSave={handleSaveEditedImage}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
};
