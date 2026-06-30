// Image Editor Component - Basic image editing with Canvas
import React, { useRef, useEffect, useState, useCallback } from 'react';

export interface ImageEditorProps {
  imageUrl: string;
  onSave: (editedImage: Blob) => void;
  onCancel: () => void;
}

export interface ImageFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  shadow: {
    enabled: boolean;
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
  };
}

export interface ImageTransforms {
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  crop: {
    enabled: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [filters, setFilters] = useState<ImageFilters>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    shadow: {
      enabled: false,
      offsetX: 5,
      offsetY: 5,
      blur: 10,
      color: 'rgba(0, 0, 0, 0.5)',
    },
  });
  const [transforms, setTransforms] = useState<ImageTransforms>({
    scale: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
    crop: {
      enabled: false,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    },
  });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      imageRef.current = img;
      drawCanvas();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Draw canvas with filters and transforms
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;

    if (!canvas || !ctx || !img) return;

    // Set canvas size
    canvas.width = img.width;
    canvas.height = img.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply shadow if enabled
    if (filters.shadow.enabled) {
      ctx.shadowColor = filters.shadow.color;
      ctx.shadowOffsetX = filters.shadow.offsetX;
      ctx.shadowOffsetY = filters.shadow.offsetY;
      ctx.shadowBlur = filters.shadow.blur;
    }

    // Apply transforms
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((transforms.rotation * Math.PI) / 180);
    ctx.scale(
      transforms.flipX ? -transforms.scale : transforms.scale,
      transforms.flipY ? -transforms.scale : transforms.scale
    );
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Apply filters
    ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) blur(${filters.blur}px)`;

    // Draw image
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }, [filters, transforms]);

  // Redraw when filters or transforms change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Handle filter changes
  const handleFilterChange = (key: keyof ImageFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleShadowChange = (key: keyof ImageFilters['shadow'], value: any) => {
    setFilters((prev) => ({
      ...prev,
      shadow: { ...prev.shadow, [key]: value },
    }));
  };

  // Handle transform changes
  const handleTransformChange = (key: keyof ImageTransforms, value: any) => {
    setTransforms((prev) => ({ ...prev, [key]: value }));
  };

  // Reset all edits
  const handleReset = () => {
    setFilters({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      shadow: {
        enabled: false,
        offsetX: 5,
        offsetY: 5,
        blur: 10,
        color: 'rgba(0, 0, 0, 0.5)',
      },
    });
    setTransforms({
      scale: 1,
      rotation: 0,
      flipX: false,
      flipY: false,
      crop: {
        enabled: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
    });
  };

  // Save edited image
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        onSave(blob);
      }
    }, 'image/png');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Éditeur d'Images</h2>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded transition"
            >
              Réinitialiser
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded transition"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded transition font-bold"
            >
              Enregistrer
            </button>
          </div>
        </div>

        <div className="flex">
          {/* Canvas Preview */}
          <div className="flex-1 p-6 bg-gray-100 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[60vh] border-2 border-gray-300 rounded shadow-lg"
            />
          </div>

          {/* Controls Panel */}
          <div className="w-80 bg-white p-6 overflow-y-auto max-h-[80vh]">
            {/* Filters Section */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">Filtres</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Luminosité: {filters.brightness}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={filters.brightness}
                    onChange={(e) => handleFilterChange('brightness', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraste: {filters.contrast}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={filters.contrast}
                    onChange={(e) => handleFilterChange('contrast', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Saturation: {filters.saturation}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={filters.saturation}
                    onChange={(e) => handleFilterChange('saturation', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Flou: {filters.blur}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={filters.blur}
                    onChange={(e) => handleFilterChange('blur', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Shadow Section */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">Ombre</h3>
              
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filters.shadow.enabled}
                    onChange={(e) => handleShadowChange('enabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">Activer l'ombre</span>
                </label>

                {filters.shadow.enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Décalage X: {filters.shadow.offsetX}px
                      </label>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={filters.shadow.offsetX}
                        onChange={(e) => handleShadowChange('offsetX', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Décalage Y: {filters.shadow.offsetY}px
                      </label>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={filters.shadow.offsetY}
                        onChange={(e) => handleShadowChange('offsetY', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Flou de l'ombre: {filters.shadow.blur}px
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={filters.shadow.blur}
                        onChange={(e) => handleShadowChange('blur', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Couleur de l'ombre
                      </label>
                      <input
                        type="color"
                        value={filters.shadow.color}
                        onChange={(e) => handleShadowChange('color', e.target.value)}
                        className="w-full h-8"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Transforms Section */}
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">Transformations</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Échelle: {transforms.scale.toFixed(2)}x
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={transforms.scale}
                    onChange={(e) => handleTransformChange('scale', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rotation: {transforms.rotation}°
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={transforms.rotation}
                    onChange={(e) => handleTransformChange('rotation', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleTransformChange('flipX', !transforms.flipX)}
                    className={`flex-1 py-2 px-4 rounded transition ${
                      transforms.flipX ? 'bg-blue-500 text-white' : 'bg-gray-200'
                    }`}
                  >
                    Flip X
                  </button>
                  <button
                    onClick={() => handleTransformChange('flipY', !transforms.flipY)}
                    className={`flex-1 py-2 px-4 rounded transition ${
                      transforms.flipY ? 'bg-blue-500 text-white' : 'bg-gray-200'
                    }`}
                  >
                    Flip Y
                  </button>
                </div>

                {/* Crop Controls */}
                <div className="border-t pt-4">
                  <label className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      checked={transforms.crop.enabled}
                      onChange={(e) => handleTransformChange('crop', { ...transforms.crop, enabled: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">Activer le recadrage</span>
                  </label>

                  {transforms.crop.enabled && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">X</label>
                          <input
                            type="number"
                            value={transforms.crop.x}
                            onChange={(e) => handleTransformChange('crop', { ...transforms.crop, x: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Y</label>
                          <input
                            type="number"
                            value={transforms.crop.y}
                            onChange={(e) => handleTransformChange('crop', { ...transforms.crop, y: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Largeur</label>
                          <input
                            type="number"
                            value={transforms.crop.width}
                            onChange={(e) => handleTransformChange('crop', { ...transforms.crop, width: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Hauteur</label>
                          <input
                            type="number"
                            value={transforms.crop.height}
                            onChange={(e) => handleTransformChange('crop', { ...transforms.crop, height: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
