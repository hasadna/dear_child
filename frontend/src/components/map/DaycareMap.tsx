import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import Supercluster from 'supercluster';
import { MapColorMode } from '../shell/AppHeader';
import { DaycareDetailDto } from '../../services/api-client';

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
 * מבוסס על Leaflet + אריחי OpenStreetMap חינמיים (0 ₪, ODbL 1.0) + Supercluster:
 * - בזום-אאוט (<= 13): בועות אגרגציה המציגות חציון מחיר ומספר גנים באשכול.
 * - בזום-אין (>= 14) או בנקודה בודדת: סיכות Price Pills הנצבעות לפי מצב הצביעה ומציגות קו רציף/מקווקו לפי רמת האמינות.
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
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(13);

  // אתחול מפת Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [32.078, 34.778],
      zoom: 13,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors | הסדנא לידע ציבורי (ODbL 1.0)',
    }).addTo(map);

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
      markersLayerRef.current = null;
    };
  }, []);

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

  const jumpToViewport = (lat: number, lon: number, zoom: number) => {
    mapInstanceRef.current?.flyTo([lat, lon], zoom, { duration: 0.6 });
  };

  return (
    <section className="map-pane-wrapper" aria-label="מפת מסגרות ומחירים">
      {/* סרגל קפיצה מהירה לאזורי פיילוט */}
      <div className="map-quick-jump-bar" role="toolbar" aria-label="ניווט מהיר במפה">
        <button
          type="button"
          className="map-jump-chip"
          onClick={() => jumpToViewport(32.078, 34.778, 13)}
        >
          📍 תל אביב-יפו (תצוגת אשכולות)
        </button>
        <button
          type="button"
          className="map-jump-chip"
          onClick={() => jumpToViewport(32.0882, 34.7818, 15)}
        >
          🔍 זום-אין לצפון הישן (Price Pills)
        </button>
        <button
          type="button"
          className="map-jump-chip"
          onClick={() => jumpToViewport(31.8981, 34.8112, 15)}
        >
          📍 רחובות
        </button>
        <button
          type="button"
          className="map-jump-chip"
          onClick={() => jumpToViewport(32.02, 34.85, 10)}
        >
          🇮🇱 מבט ארצי
        </button>
      </div>

      {/* קונטיינר מפת Leaflet */}
      <div ref={mapContainerRef} className="leaflet-map-canvas" />

      {/* מקרא קרטוגרפי חי (D-31, D-32) */}
      <aside className="map-legend-card" aria-label="מקרא סיכות מחיר ואמינות">
        <div className="legend-title">
          מקרא מפה ({' '}
          {colorMode === 'relative_price'
            ? 'רמת מחיר וסבסוד'
            : colorMode === 'supervision_status'
              ? 'סטטוס רישוי רשמי'
              : 'כמות דיווחי הורים'}{' '}
          )
        </div>
        <div className="legend-items">
          <span className="legend-badge pill-affordable pill-border-solid">
            ✓ ₪5,600 קונצנזוס (3+)
          </span>
          <span className="legend-badge pill-above-median pill-border-dashed">
            ~₪5,125 טווח / דיווח בודד
          </span>
          <span className="legend-badge pill-subsidized pill-border-solid">
            🛡️ ₪2,515 מעון סמל / צהרון
          </span>
          <span className="legend-badge pill-no-price pill-border-dashed">
            + הוסף מחיר (טרם דווח)
          </span>
        </div>
      </aside>
    </section>
  );
};
