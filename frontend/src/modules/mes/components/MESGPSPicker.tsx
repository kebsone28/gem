import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Crosshair } from 'lucide-react';

interface MESGPSPickerProps {
  lat: number | string;
  lng: number | string;
  onLatChange: (value: string) => void;
  onLngChange: (value: string) => void;
}

const MESGPSPicker: React.FC<MESGPSPickerProps> = ({ lat, lng, onLatChange, onLngChange }) => {
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('La géolocalisation n\'est pas supportée par votre navigateur');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        onLatChange(latitude.toString());
        onLngChange(longitude.toString());
        setLoading(false);
      },
      (error) => {
        console.error('Erreur de géolocalisation:', error);
        alert('Impossible d\'obtenir votre position. Veuillez vérifier vos paramètres de localisation.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const openGoogleMaps = () => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Latitude
          </label>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => onLatChange(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="-90 à 90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Longitude
          </label>
          <input
            type="number"
            step="any"
            value={lng}
            onChange={(e) => onLngChange(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="-180 à 180"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={getCurrentLocation}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg text-sm text-blue-400 hover:bg-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Crosshair size={16} className="animate-spin" />
              Localisation...
            </>
          ) : (
            <>
              <Navigation size={16} />
              Ma position
            </>
          )}
        </button>

        <button
          type="button"
          onClick={openGoogleMaps}
          disabled={!lat || !lng}
          className="flex-1 px-4 py-2 bg-green-600/20 border border-green-500/30 rounded-lg text-sm text-green-400 hover:bg-green-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MapPin size={16} />
          Voir sur carte
        </button>
      </div>

      {currentLocation && (
        <div className="p-3 bg-slate-800/50 rounded-lg text-xs text-slate-400">
          Position actuelle: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
        </div>
      )}
    </div>
  );
};

export default MESGPSPicker;
