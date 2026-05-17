/**
 * DomainRenderAdapter
 *
 * Frontend interface for domain-specific rendering logic
 * Each domain implements how to:
 * - Color entities by status
 * - Choose icons
 * - Generate popup content
 * - Convert entities to GeoJSON features
 */

import { Feature } from 'geojson';

export interface DomainRenderAdapter {
  /**
   * Get color for entity based on status
   * @param properties Entity properties
   * @returns Hex color or CSS color
   */
  getColorByStatus(properties: Record<string, any>): string;

  /**
   * Get icon ID to display on map
   * @param properties Entity properties
   * @returns Icon identifier
   */
  getIconId(properties: Record<string, any>): string;

  /**
   * Convert domain entity to GeoJSON Feature
   * @param entity Domain-specific entity
   * @returns GeoJSON Feature
   */
  toFeature(entity: Record<string, any>): Feature;

  /**
   * Generate HTML popup content for entity
   * @param entity Domain-specific entity
   * @returns HTML string
   */
  getPopupContent(entity: Record<string, any>): string;

  /**
   * Get list of fields to display in popup
   * @returns Array of field names
   */
  getDisplayFields(): string[];
}
