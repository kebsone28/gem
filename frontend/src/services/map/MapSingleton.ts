import maplibregl from 'maplibre-gl';
import {
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT_VECTOR,
  MAP_STYLE_SATELLITE,
} from '../../components/terrain/mapConfig';
import { registerIcons } from '../../components/terrain/mapUtils';

export class MapManager {
  public container: HTMLDivElement | null = null;
  public map: maplibregl.Map | null = null;
  public isInitializing: boolean = false;

  public async getMap(
    isDarkMode: boolean
  ): Promise<{ map: maplibregl.Map; container: HTMLDivElement }> {
    if (this.map && this.container) {
      return { map: this.map, container: this.container };
    }

    if (this.isInitializing) {
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (this.map && this.container) {
            clearInterval(interval);
            resolve({ map: this.map, container: this.container });
          }
        }, 50);
      });
    }

    this.isInitializing = true;

    // 1. Create a detached DOM container
    const div = document.createElement('div');
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.position = 'absolute';
    div.style.inset = '0';
    this.container = div;

    // 2. Instantiate the global MapLibre Map
    this.map = new maplibregl.Map({
      container: this.container,
      style: isDarkMode ? MAP_STYLE_DARK : MAP_STYLE_LIGHT_VECTOR,
      center: [-14.45, 14.5], // PROQUELEC default focus
      zoom: 7,
      pitch: 0,
      maxPitch: 85,
      bearing: 0,
      transformRequest: (url) => {
        if (url.includes('households') && !url.includes('t=')) {
          return { url: `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` };
        }
        return { url };
      },
    });

    // 3. Setup core controls
    this.map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      'top-right'
    );
    this.map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

    // 4. Await internal setup
    await new Promise<void>((resolve) => {
      this.map!.once('load', async () => {
        await registerIcons(this.map!); // ✅ Gold Standard Registration
        resolve();
      });
    });

    this.isInitializing = false;

    return { map: this.map, container: this.container };
  }

  /**
   * Helper to safely switch styles on the global instance
   */
  public switchStyle(targetSource: string, isDarkMode: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.map) return resolve();

      // Prevent updates if interrupted
      if ((this.map as unknown as { _removed?: boolean })._removed) return resolve();

      let styleObj: object = isDarkMode ? MAP_STYLE_DARK : MAP_STYLE_LIGHT_VECTOR;
      if (targetSource === 'satellite')
        styleObj = { ...MAP_STYLE_SATELLITE, metadata: { source: 'satellite' } };
      if (targetSource === 'light') styleObj = MAP_STYLE_LIGHT_VECTOR;
      if (targetSource === 'dark') styleObj = MAP_STYLE_DARK;

      const applyStyle = () => {
        if ((this.map as unknown as { _removed?: boolean })._removed) return resolve();

        try {
          // Force clear placement to avoid "reading get" crash during transition
          (this.map as unknown as { _placement?: unknown })._placement = undefined;

          this.map!.setStyle(styleObj, { diff: false });

          // We wait for 'style.load' which is the official "all good" signal
          const onStyleLoad = async () => {
            try {
              console.log('[MapSingleton] Style loaded, registering icons...');
              await registerIcons(this.map!);
              console.log('[MapSingleton] Style transition complete.');
              resolve();
            } catch (err) {
              console.warn('[MapSingleton] Icon registration failed:', err);
              resolve(); // Still resolve to let app continue
            }
          };

          this.map!.once('style.load', onStyleLoad);
        } catch (e) {
          console.warn('[SingletonMap] Style aborted safely', e);
          resolve();
        }
      };

      if (!this.map.isStyleLoaded()) {
        this.map.once('load', applyStyle);
      } else {
        applyStyle();
      }
    });
  }
}

export const globalSingletonMap = new MapManager();
