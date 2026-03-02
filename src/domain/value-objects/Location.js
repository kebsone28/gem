/**
 * Value Object pour les coordonnées GPS
 * Immutable
 */
export class Coordinates {
    constructor(latitude, longitude, precision = null) {
        // Validation
        if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
            throw new ValidationError('Latitude must be between -90 and 90');
        }
        if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
            throw new ValidationError('Longitude must be between -180 and 180');
        }

        this._latitude = latitude;
        this._longitude = longitude;
        this._precision = precision;

        Object.freeze(this);
    }

    get latitude() {
        return this._latitude;
    }

    get longitude() {
        return this._longitude;
    }

    get precision() {
        return this._precision;
    }

    /**
     * Calcule la distance vers d'autres coordonnées (en km)
     * Utilise la formule de Haversine
     */
    distanceTo(other) {
        if (!(other instanceof Coordinates)) {
            throw new Error('Parameter must be Coordinates instance');
        }

        const R = 6371; // Rayon de la Terre en km
        const dLat = this.toRadians(other.latitude - this.latitude);
        const dLon = this.toRadians(other.longitude - this.longitude);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(this.latitude)) *
            Math.cos(this.toRadians(other.latitude)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convertit des degrés en radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Vérifie si les coordonnées sont valides
     */
    isValid() {
        return this._latitude !== null &&
            this._longitude !== null &&
            !isNaN(this._latitude) &&
            !isNaN(this._longitude);
    }

    /**
     * Égalité entre coordonnées
     */
    equals(other) {
        if (!(other instanceof Coordinates)) return false;
        return this._latitude === other._latitude &&
            this._longitude === other._longitude;
    }

    /**
     * Représentation textuelle
     */
    toString() {
        return `${this._latitude.toFixed(6)}, ${this._longitude.toFixed(6)}`;
    }

    /**
     * Sérialisation JSON
     */
    toJSON() {
        return {
            latitude: this._latitude,
            longitude: this._longitude,
            precision: this._precision
        };
    }

    /**
     * Désérialisation JSON
     */
    static fromJSON(data) {
        return new Coordinates(data.latitude, data.longitude, data.precision);
    }
}

/**
 * Value Object pour la localisation
 * Immutable
 */
export class Location {
    constructor(region, department, commune, village, coordinates) {
        if (!region || !department || !commune) {
            throw new ValidationError('Region, department, and commune are required');
        }

        this._region = region;
        this._department = department;
        this._commune = commune;
        this._village = village || '';
        this._coordinates = coordinates;

        Object.freeze(this);
    }

    get region() {
        return this._region;
    }

    get department() {
        return this._department;
    }

    get commune() {
        return this._commune;
    }

    get village() {
        return this._village;
    }

    get coordinates() {
        return this._coordinates;
    }

    /**
     * Calcule la distance vers une autre localisation
     */
    distanceTo(other) {
        if (!(other instanceof Location)) {
            throw new Error('Parameter must be Location instance');
        }

        if (!this._coordinates || !other._coordinates) {
            return null;
        }

        return this._coordinates.distanceTo(other._coordinates);
    }

    /**
     * Vérifie si deux localisations sont dans la même zone administrative
     */
    isSameAdministrativeZone(other, level = 'commune') {
        if (!(other instanceof Location)) return false;

        switch (level) {
            case 'region':
                return this._region === other._region;
            case 'department':
                return this._region === other._region &&
                    this._department === other._department;
            case 'commune':
                return this._region === other._region &&
                    this._department === other._department &&
                    this._commune === other._commune;
            case 'village':
                return this._region === other._region &&
                    this._department === other._department &&
                    this._commune === other._commune &&
                    this._village === other._village;
            default:
                return false;
        }
    }

    /**
     * Égalité
     */
    equals(other) {
        if (!(other instanceof Location)) return false;
        return this._region === other._region &&
            this._department === other._department &&
            this._commune === other._commune &&
            this._village === other._village;
    }

    /**
     * Représentation textuelle
     */
    toString() {
        const parts = [this._village, this._commune, this._department, this._region]
            .filter(p => p);
        return parts.join(', ');
    }

    /**
     * Représentation courte
     */
    toShortString() {
        return this._village || this._commune;
    }

    /**
     * Sérialisation JSON
     */
    toJSON() {
        return {
            region: this._region,
            department: this._department,
            commune: this._commune,
            village: this._village,
            coordinates: this._coordinates ? this._coordinates.toJSON() : null
        };
    }

    /**
     * Désérialisation JSON
     */
    static fromJSON(data) {
        if (!data) return null;
        const coordinates = data.coordinates
            ? Coordinates.fromJSON(data.coordinates)
            : null;

        return new Location(
            data.region,
            data.department,
            data.commune,
            data.village,
            coordinates
        );
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.Coordinates = Coordinates;
    window.Location = Location;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Coordinates, Location };
}
