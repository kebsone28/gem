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

    // Initial check — déclenché UNE SEULE FOIS au montage
    useEffect(() => {
        if (!navigator.geolocation) {
            setGeolocationError('Géolocalisation non disponible sur ce navigateur');
            logger.warn('Geolocation not available');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                setUserLocation(loc);
                onLocationFoundRef.current?.(loc);
                logger.log('📍 Auto-location detected:', loc);
            },
            (err) => {
                logger.warn('⚠️ Auto-location failed:', err);
            },
            { enableHighAccuracy: false, timeout: 5000 }
        );
     
    }, []); // Intentionnellement vide : exécuté une seule fois au montage

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
                toast.success('✅ Position trouvée ! ' + newLoc.map(v => v.toFixed(4)).join(', '));
                logger.log('✅ Position obtenue:', newLoc);
            },
            (err) => {
                let errorMsg = 'Position indisponible';
                switch(err.code) {
                    case err.PERMISSION_DENIED:
                        errorMsg = '❌ Permission refusée.\n\nPour activer :\n• Chrome/Edge : Paramètres → Confidentialité → Permissions\n• Firefox : Autorisations';
                        break;
                    case err.POSITION_UNAVAILABLE:
                        errorMsg = '⚠️ Position indisponible. Vérifiez votre GPS.';
                        break;
                    case err.TIMEOUT:
                        errorMsg = '⏱️ Délai d\'attente dépassé.';
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
        handleRequestGeolocation
    };
};
