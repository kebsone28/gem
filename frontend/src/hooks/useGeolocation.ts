 
import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import logger from '../utils/logger';

export const useGeolocation = (onLocationFound?: (loc: [number, number]) => void) => {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);

  // Garde la ref à jour sans déclencher de re-render
  const onLocationFoundRef = useRef(onLocationFound);
  useEffect(() => {
    onLocationFoundRef.current = onLocationFound;
  });

  // Do not request geolocation on mount. Browsers increasingly require
  // a direct user gesture, and auto-requesting here causes console violations.
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeolocationError('Géolocalisation non disponible sur ce navigateur');
      logger.warn('Geolocation not available');
    } else {
      setGeolocationError(null);
    }
  }, []);

  const handleRequestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non disponible sur ce navigateur');
      return;
    }

    setGeolocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLoc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(newLoc);
        if (onLocationFound) onLocationFound(newLoc);
        toast.success('✅ Position trouvée ! ' + newLoc.map((v) => v.toFixed(4)).join(', '));
        logger.debug('✅ Position obtenue:', newLoc);
      },
      (err) => {
        let errorMsg = 'Position indisponible';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMsg =
              '❌ Permission refusée.\n\nPour activer :\n• Chrome/Edge : Paramètres → Confidentialité → Permissions\n• Firefox : Autorisations';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMsg = '⚠️ Position indisponible. Vérifiez votre GPS.';
            break;
          case err.TIMEOUT:
            errorMsg = "⏱️ Délai d'attente dépassé.";
            break;
        }
        logger.warn('❌ Geolocation error:', err.code, errorMsg);
        setGeolocationError(errorMsg);
        toast.error(errorMsg, { duration: 5000 });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [onLocationFound]);

  return {
    userLocation,
    setUserLocation,
    geolocationError,
    handleRequestGeolocation,
  };
};
