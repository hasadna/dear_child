import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import Supercluster from 'supercluster';
import { MapColorMode } from '../shell/AppHeader';
import { DaycareDetailDto } from '../../services/api-client';
import { useModalDismiss } from '../shell/useModalDismiss';

export type BaseMapStyleId =
  | 'osm_standard'
  | 'esri_street'
  | 'esri_gray'
  | 'esri_satellite'
  | 'open_topo';

interface BaseMapStyleMeta {
  id: BaseMapStyleId;
  labelHe: string;
  thumbClass: string;
  createLayer: () => L.Layer;
}

const COMMON_DATA_ATTRIBUTION = ' | נתונים: הסדנא לידע ציבורי (ODbL 1.0)';

const BASE_MAP_STYLES: BaseMapStyleMeta[] = [
  {
    id: 'osm_standard',
    labelHe: 'מפת רחובות',
    thumbClass: 'thumb-streets',
    createLayer: () =>
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors' +
          COMMON_DATA_ATTRIBUTION,
      }),
  },
  {
    id: 'esri_satellite',
    labelHe: 'לוויין',
    thumbClass: 'thumb-satellite',
    createLayer: () =>
      L.layerGroup([
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 19,
            attribution:
              'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics' +
              COMMON_DATA_ATTRIBUTION,
          }
        ),
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 19,
            pane: 'overlayPane',
          }
        ),
      ]),
  },
  {
    id: 'esri_street',
    labelHe: 'מפה נקייה',
    thumbClass: 'thumb-clean',
    createLayer: () =>
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution:
            'Tiles &copy; Esri &mdash; Esri, TomTom, FAO, NOAA, USGS' +
            COMMON_DATA_ATTRIBUTION,
        }
      ),
  },
  {
    id: 'esri_gray',
    labelHe: 'מפה בהירה',
    thumbClass: 'thumb-light',
    createLayer: () =>
      L.layerGroup([
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 16,
            attribution:
              'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ' +
              COMMON_DATA_ATTRIBUTION,
          }
        ),
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
          {
            maxZoom: 16,
            pane: 'overlayPane',
          }
        ),
      ]),
  },
  {
    id: 'open_topo',
    labelHe: 'פני שטח',
    thumbClass: 'thumb-topo',
    createLayer: () =>
      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution:
          'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a> (CC-BY-SA)' +
          COMMON_DATA_ATTRIBUTION,
      }),
  },
];

interface DaycareMapProps {
  items: DaycareDetailDto[];
  selectedId: string | null;
  hoveredId: string | null;
  colorMode: MapColorMode;
  cityMedianPriceNis: number;
  flyToTarget: { lat: number; lon: number; zoom?: number } | null;
  onSelectDaycare: (daycare: DaycareDetailDto) => void;
  onOpenFullProfile: (daycare: DaycareDetailDto) => void;
  onReportPriceForDaycare: (daycare: DaycareDetailDto) => void;
}

interface PointProps {
  daycareId: string;
  price: number | null;
  prices: number[];
}

interface ClusterProps {
  prices: number[];
}

function computeMedian(values: number[]): number | null {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * רכיב המפה הקרטוגרפית של "ילדי היקר" (D-32)
 * מבוסס Leaflet + שכבות בסיס חינמיות (0 ₪, ללא API Key) עם מתג החלפת תצוגה בסגנון Google Maps,
 * אגרגציית Supercluster בזום-אאוט וסיכות Price Pills בזום-אין.
 */
export const DaycareMap: React.FC<DaycareMapProps> = ({
  items,
  selectedId,
  hoveredId,
  colorMode,
  cityMedianPriceNis,
  flyToTarget,
  onSelectDaycare,
  onOpenFullProfile,
  onReportPriceForDaycare,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.Layer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const layerMenuRef = useRef<HTMLDivElement | null>(null);

  const [currentZoom, setCurrentZoom] = useState<number>(13);
  const [baseStyleId, setBaseStyleId] =
    useState<BaseMapStyleId>('osm_standard');
  const [layersOpen, setLayersOpen] = useState<boolean>(false);

  useModalDismiss(layersOpen, () => setLayersOpen(false));

  // סגירת חלון בחירת סוג המפה בלחיצה מחוץ לו
  useEffect(() => {
    if (!layersOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        layerMenuRef.current &&
        !layerMenuRef.current.contains(event.target as Node)
      ) {
        setLayersOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [layersOpen]);

  // אתחול מפת Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [32.078, 34.778],
      zoom: 13,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = markersLayer;

    const handleMoveEnd = () => {
      setCurrentZoom(map.getZoom());
    };

    map.on('zoomend', handleMoveEnd);
    map.on('moveend', handleMoveEnd);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      baseLayerRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // החלפת שכבת הבסיס
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
      baseLayerRef.current = null;
    }

    const styleMeta =
      BASE_MAP_STYLES.find((s) => s.id === baseStyleId) || BASE_MAP_STYLES[0];
    const nextLayer = styleMeta.createLayer();
    nextLayer.addTo(map);
    baseLayerRef.current = nextLayer;
  }, [baseStyleId]);

  // סנכרון התמקדות מפה בבחירת גן מהטבלה או מה-Autocomplete
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !flyToTarget) return;
    map.flyTo(
      [flyToTarget.lat, flyToTarget.lon],
      flyToTarget.zoom ?? Math.max(map.getZoom(), 15),
      { duration: 0.65 }
    );
  }, [flyToTarget]);

  // בניית Supercluster ורינדור האשכולות וסיכות ה-Price Pills
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    const index = new Supercluster<PointProps, ClusterProps>({
      radius: 62,
      maxZoom: 13,
      map: (props) => ({
        prices: props.price !== null ? [props.price] : [],
      }),
      reduce: (accumulated, props) => {
        accumulated.prices = accumulated.prices.concat(props.prices);
      },
    });

    const features: GeoJSON.Feature<GeoJSON.Point, PointProps>[] = items.map(
      (item) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [item.lon, item.lat],
        },
        properties: {
          daycareId: item.id,
          price: item.headline_price_nis,
          prices: item.headline_price_nis !== null ? [item.headline_price_nis] : [],
        },
      })
    );

    index.load(features);

    const bounds = map.getBounds();
    const bbox: [number, number, number, number] = [
      bounds.getWest() - 0.5,
      bounds.getSouth() - 0.5,
      bounds.getEast() + 0.5,
      bounds.getNorth() + 0.5,
    ];
    const zoom = Math.round(map.getZoom());
    const clusters = index.getClusters(bbox, zoom);

    const itemById = new Map<string, DaycareDetailDto>(
      items.map((it) => [it.id, it])
    );

    clusters.forEach((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const props = feature.properties as unknown as Record<string, unknown>;
      const isCluster = Boolean(props.cluster);

      if (isCluster) {
        const clusterId = Number(props.cluster_id);
        const pointCount = Number(props.point_count || 0);
        const clusterPrices = Array.isArray(props.prices)
          ? (props.prices as number[])
          : [];
        const medianPrice = computeMedian(clusterPrices);

        let clusterToneClass = 'cluster-neutral';
        if (medianPrice !== null) {
          if (medianPrice <= 2700) {
            clusterToneClass = 'cluster-subsidized';
          } else if (medianPrice <= cityMedianPriceNis) {
            clusterToneClass = 'cluster-affordable';
          } else {
            clusterToneClass = 'cluster-expensive';
          }
        }

        const priceLine =
          medianPrice !== null
            ? `₪${medianPrice.toLocaleString()}`
            : 'ממתין למחיר';

        const icon = L.divIcon({
          className: 'custom-cluster-wrapper',
          html: `
            <div class="supercluster-bubble ${clusterToneClass}" role="button" tabindex="0" aria-label="אשכול של ${pointCount} גנים, חציון מחיר ${priceLine}">
              <span class="cluster-price">${priceLine}</span>
              <span class="cluster-count">${pointCount} גנים</span>
            </div>
          `,
          iconSize: [86, 54],
          iconAnchor: [43, 27],
        });

        const marker = L.marker([lat, lon], { icon });
        marker.on('click', () => {
          const expansionZoom = Math.min(
            index.getClusterExpansionZoom(clusterId),
            16
          );
          map.flyTo([lat, lon], expansionZoom, { duration: 0.5 });
        });
        markersLayer.addLayer(marker);
      } else {
        const daycareId = String(props.daycareId);
        const daycare = itemById.get(daycareId);
        if (!daycare) return;

        const isSelected = selectedId === daycare.id;
        const isHovered = hoveredId === daycare.id;

        // קביעת מחלקת צבע לפי מצב הצביעה הפעיל (D-32)
        let pillToneClass = 'pill-no-price';
        if (daycare.has_active_stop_order) {
          pillToneClass = 'pill-stop-order';
        } else if (colorMode === 'relative_price') {
          if (daycare.display_mode === 'no_price') {
            pillToneClass = 'pill-no-price';
          } else if (daycare.is_subsidized) {
            pillToneClass = 'pill-subsidized';
          } else if (
            daycare.headline_price_nis !== null &&
            daycare.headline_price_nis <= cityMedianPriceNis * 1.02
          ) {
            pillToneClass = 'pill-affordable';
          } else {
            pillToneClass = 'pill-above-median';
          }
        } else if (colorMode === 'supervision_status') {
          if (daycare.license_icon_code === 'valid') {
            pillToneClass = 'pill-affordable';
          } else if (daycare.license_icon_code === 'in_progress') {
            pillToneClass = 'pill-above-median';
          } else {
            pillToneClass = 'pill-stop-order';
          }
        } else if (colorMode === 'reports_count') {
          if (daycare.active_reports_count >= 3) {
            pillToneClass = 'pill-affordable';
          } else if (daycare.active_reports_count >= 1) {
            pillToneClass = 'pill-subsidized';
          } else {
            pillToneClass = 'pill-no-price';
          }
        }

        // קביעת סגנון המסגרת לפי דרגת אמינות המידע (D-31)
        const borderClass =
          daycare.display_mode === 'median' ||
          daycare.price_Trust_tier === 'official_regulated'
            ? 'pill-border-solid'
            : 'pill-border-dashed';

        const activeStateClass =
          isSelected || isHovered ? 'pill-active-selected' : '';

        const icon = L.divIcon({
          className: 'custom-price-pill-wrapper',
          html: `
            <div class="price-pill-marker ${pillToneClass} ${borderClass} ${activeStateClass}" title="${daycare.name} — ${daycare.price_formatted_he}">
              <span class="pill-text">${daycare.price_pill_short_he}</span>
            </div>
          `,
          iconSize: [108, 34],
          iconAnchor: [54, 17],
        });

        const marker = L.marker([lat, lon], {
          icon,
          zIndexOffset: isSelected ? 1000 : isHovered ? 800 : 0,
        });

        marker.on('click', () => {
          onSelectDaycare(daycare);
          if (daycare.display_mode === 'no_price') {
            onReportPriceForDaycare(daycare);
          } else {
            onOpenFullProfile(daycare);
          }
        });

        markersLayer.addLayer(marker);
      }
    });
  }, [
    items,
    selectedId,
    hoveredId,
    colorMode,
    cityMedianPriceNis,
    currentZoom,
    onSelectDaycare,
    onOpenFullProfile,
    onReportPriceForDaycare,
  ]);

  const jumpToBounds = (
    bounds: [[number, number], [number, number]],
    padding: [number, number] = [20, 20]
  ) => {
    mapInstanceRef.current?.flyToBounds(bounds, {
      padding,
      duration: 0.65,
    });
  };

  const activeBaseMeta =
    BASE_MAP_STYLES.find((s) => s.id === baseStyleId) || BASE_MAP_STYLES[0];

  return (
    <section className="map-pane-wrapper" aria-label="מפת מסגרות ומחירים">
      {/* סרגל קפיצה מהירה לאזורי פיילוט */}
      <div
        className="map-quick-jump-bar"
        role="toolbar"
        aria-label="ניווט מהיר במפה"
      >
        <button
          type="button"
          className="map-jump-chip"
          onClick={() =>
            jumpToBounds(
              [
                [29.49, 34.26],
                [33.34, 35.89],
              ],
              [18, 18]
            )
          }
        >
          🇮🇱 מבט ארצי
        </button>
        <button
          type="button"
          className="map-jump-chip"
          onClick={() =>
            jumpToBounds(
              [
                [32.029, 34.741],
                [32.146, 34.852],
              ],
              [24, 24]
            )
          }
        >
          📍 תל אביב-יפו
        </button>
      </div>

      {/* קונטיינר מפת Leaflet */}
      <div ref={mapContainerRef} className="leaflet-map-canvas" />

      {/* מתג החלפת סוג מפה בסגנון Google Maps — בצד שמאל למטה */}
      <div className="map-layers-control" ref={layerMenuRef}>
        {layersOpen && (
          <div
            className="map-layers-popover"
            role="dialog"
            aria-label="בחירת סוג מפה"
          >
            <div className="layers-popover-header">
              <span>סוג מפה</span>
              <button
                type="button"
                className="layers-close-btn"
                aria-label="סגירת חלון סוג מפה"
                onClick={() => setLayersOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="layers-grid">
              {BASE_MAP_STYLES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  className={`layer-option-card ${
                    baseStyleId === st.id ? 'active' : ''
                  }`}
                  onClick={() => {
                    setBaseStyleId(st.id);
                    setLayersOpen(false);
                  }}
                >
                  <span className={`layer-swatch ${st.thumbClass}`} />
                  <span className="layer-option-label">{st.labelHe}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className={`map-layers-fab ${activeBaseMeta.thumbClass}`}
          aria-expanded={layersOpen}
          aria-label={`החלפת סוג מפה — פעיל כעת: ${activeBaseMeta.labelHe}`}
          title={`סוג מפה פעיל: ${activeBaseMeta.labelHe}`}
          onClick={() => setLayersOpen((prev) => !prev)}
        >
          <span className="layers-fab-overlay">
            <span className="layers-fab-text">{activeBaseMeta.labelHe}</span>
          </span>
        </button>
      </div>

      {/* מקרא קרטוגרפי דינמי לפי מצב הצביעה הנבחר (ללא הצגת מחירים) */}
      <aside className="map-legend-card" aria-label="מקרא סיכות המפה">
        <div className="legend-title">
          מקרא מפה —{' '}
          {colorMode === 'relative_price'
            ? 'רמת מחיר יחסית וסבסוד'
            : colorMode === 'supervision_status'
              ? 'סטטוס רישוי ופיקוח רשמי'
              : 'מספר דיווחי הורים'}
        </div>
        <div className="legend-items">
          {colorMode === 'relative_price' && (
            <>
              <span className="legend-badge pill-affordable pill-border-solid">
                זול / סביב החציון
              </span>
              <span className="legend-badge pill-above-median pill-border-solid">
                יקר מהחציון
              </span>
              <span className="legend-badge pill-subsidized pill-border-solid">
                מעון סמל / צהרון מפוקח
              </span>
              <span className="legend-badge pill-no-price pill-border-dashed">
                טרם דווח מחיר
              </span>
              <span className="legend-badge pill-stop-order pill-border-solid">
                צו הפסקה פעיל
              </span>
            </>
          )}

          {colorMode === 'supervision_status' && (
            <>
              <span className="legend-badge pill-affordable pill-border-solid">
                רישיון בתוקף / סמל מוכר
              </span>
              <span className="legend-badge pill-above-median pill-border-solid">
                בתהליך רישוי
              </span>
              <span className="legend-badge pill-stop-order pill-border-solid">
                ללא בקשה / צו הפסקה
              </span>
            </>
          )}

          {colorMode === 'reports_count' && (
            <>
              <span className="legend-badge pill-affordable pill-border-solid">
                קונצנזוס (3+ דיווחים · קו רציף)
              </span>
              <span className="legend-badge pill-subsidized pill-border-dashed">
                1–2 דיווחים (קו מקווקו)
              </span>
              <span className="legend-badge pill-no-price pill-border-dashed">
                טרם דווח (0 דיווחים)
              </span>
            </>
          )}
        </div>
      </aside>
    </section>
  );
};
