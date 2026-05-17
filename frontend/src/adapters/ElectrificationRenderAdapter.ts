/**
 * ElectrificationRenderAdapter
 *
 * Renders household entities on the map with electricity-specific colors and icons
 */

import { Feature } from 'geojson';
import { DomainRenderAdapter } from './DomainRenderAdapter';

export class ElectrificationRenderAdapter implements DomainRenderAdapter {
  /**
   * Color mapping for household status
   */
  private statusColors = {
    planning: '#0099ff', // Blue - not yet connected
    connected: '#00ff00', // Green - actively connected
    maintenance: '#ff9900', // Orange - maintenance needed
    disconnected: '#ff0000', // Red - disconnected
    alert: '#ff0000', // Red - alert state
  };

  /**
   * Get color by household status
   */
  getColorByStatus(properties: Record<string, any>): string {
    const status = properties.status || 'planning';
    return this.statusColors[status as keyof typeof this.statusColors] || '#cccccc';
  }

  /**
   * Get icon identifier for household
   */
  getIconId(properties: Record<string, any>): string {
    const status = properties.status || 'planning';
    const isPulsing = status === 'connected' ? '-pulsing' : '';
    return `icon-electricity-${status}${isPulsing}`;
  }

  /**
   * Convert household to GeoJSON Feature
   */
  toFeature(household: Record<string, any>): Feature {
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [household.longitude || 0, household.latitude || 0],
      },
      properties: {
        id: household.id,
        name: household.name || `Household ${household.numeroordre}`,
        status: household.status || 'planning',
        phone: household.phone,
        numeroordre: household.numeroordre,
        voltage: household.voltage,
        region: household.region,
        departement: household.departement,
        village: household.village,
        connectionDate: household.connectionDate,
      },
    };
  }

  /**
   * Generate popup HTML for household
   */
  getPopupContent(household: Record<string, any>): string {
    const status = household.status || 'planning';
    const statusLabel = this.getStatusLabel(status);

    return `
      <div class="popup-content">
        <h3 style="margin: 0 0 8px 0; font-weight: 600;">
          ${household.name || `Household ${household.numeroordre}`}
        </h3>
        
        <div style="font-size: 12px; line-height: 1.6; color: #333;">
          <div><strong>Status:</strong> <span style="color: ${this.getColorByStatus(household)}">${statusLabel}</span></div>
          ${household.numeroordre ? `<div><strong>Order #:</strong> ${household.numeroordre}</div>` : ''}
          ${household.phone ? `<div><strong>Phone:</strong> ${household.phone}</div>` : ''}
          ${household.voltage ? `<div><strong>Voltage:</strong> ${household.voltage}V</div>` : ''}
          ${household.region ? `<div><strong>Region:</strong> ${household.region}</div>` : ''}
          ${household.village ? `<div><strong>Village:</strong> ${household.village}</div>` : ''}
          ${household.connectionDate ? `<div><strong>Connected:</strong> ${new Date(household.connectionDate).toLocaleDateString()}</div>` : ''}
        </div>

        <div style="margin-top: 8px; font-size: 11px; color: #666;">
          Updated: ${new Date(household.updatedAt || Date.now()).toLocaleString()}
        </div>
      </div>
    `;
  }

  /**
   * Fields to display in popup
   */
  getDisplayFields(): string[] {
    return [
      'name',
      'numeroordre',
      'phone',
      'status',
      'voltage',
      'region',
      'departement',
      'village',
      'connectionDate',
    ];
  }

  /**
   * Helper: Get human-readable status label
   */
  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      planning: 'Planning',
      connected: 'Connected',
      maintenance: 'Maintenance',
      disconnected: 'Disconnected',
      alert: 'Alert',
    };
    return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
  }
}
