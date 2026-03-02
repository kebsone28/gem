import L from 'leaflet';

export const getStatusIcon = (status: string) => {
    let color = '#94a3b8'; // default slate-400

    switch (status) {
        case 'Conforme':
        case 'Terminé':
            color = '#10b981'; // emerald-500
            break;
        case 'Attente Maçon':
        case 'Attente Branchement':
        case 'En cours':
            color = '#3b82f6'; // blue-500
            break;
        case 'Attente démarrage':
            color = '#f59e0b'; // amber-500
            break;
        case 'Inéligible':
        case 'Injoignable':
            color = '#ef4444'; // red-500
            break;
        case 'Attente Controleur':
            color = '#8b5cf6'; // purple-500
            break;
    }

    const svgHtml = `
        <div style="position: relative; width: 30px; height: 30px;">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 21L4.5 13.5C3.5 12.5 3 11.3 3 10C3 7.2 5.2 5 8 5C9.3 5 10.5 5.5 11.5 6.4L12 6.9L12.5 6.4C13.5 5.5 14.7 5 16 5C18.8 5 21 7.2 21 10C21 11.3 20.5 12.5 19.5 13.5L12 21Z" 
                    fill="${color}" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="10" r="3" fill="white" fill-opacity="0.3"/>
            </svg>
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 50%; box-shadow: 0 0 15px ${color}; opacity: 0.5;"></div>
        </div>
    `;

    return L.divIcon({
        html: svgHtml,
        className: 'custom-status-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });
};
