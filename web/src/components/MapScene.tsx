import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent, StyleSpecification } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { apiConfig, type Coordinate } from "../api";

maplibregl.setWorkerUrl(mapWorkerUrl);

interface MapSceneProps {
  route?: Coordinate[];
  pickup?: Coordinate;
  dropoff?: Coordinate;
  draw?: boolean;
  onRouteChange?: (route: Coordinate[]) => void;
  className?: string;
}

const blankStyle: StyleSpecification = {
  version: 8,
  sources: {
    "poolr-schematic": {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: { weight: "major" }, geometry: { type: "LineString", coordinates: [[77.49, 13.025], [77.54, 12.995], [77.59, 12.977], [77.65, 12.968], [77.69, 12.94]] } },
          { type: "Feature", properties: { weight: "major" }, geometry: { type: "LineString", coordinates: [[77.55, 13.06], [77.57, 13.02], [77.5946, 12.9716], [77.61, 12.925], [77.625, 12.885]] } },
          { type: "Feature", properties: { weight: "major" }, geometry: { type: "LineString", coordinates: [[77.50, 12.94], [77.55, 12.95], [77.60, 12.955], [77.66, 12.985]] } },
          { type: "Feature", properties: { weight: "minor" }, geometry: { type: "LineString", coordinates: [[77.52, 13.04], [77.56, 13.01], [77.62, 13.015], [77.67, 12.995]] } },
          { type: "Feature", properties: { weight: "minor" }, geometry: { type: "LineString", coordinates: [[77.535, 12.91], [77.57, 12.94], [77.63, 12.945], [77.675, 12.92]] } },
          { type: "Feature", properties: { weight: "minor" }, geometry: { type: "LineString", coordinates: [[77.53, 13.055], [77.55, 13.00], [77.54, 12.955], [77.565, 12.91]] } },
          { type: "Feature", properties: { weight: "minor" }, geometry: { type: "LineString", coordinates: [[77.635, 13.05], [77.62, 13.01], [77.64, 12.97], [77.655, 12.91]] } },
        ],
      },
    },
  },
  layers: [
    { id: "paper", type: "background", paint: { "background-color": "#eadcc1" } },
    { id: "schematic-minor", type: "line", source: "poolr-schematic", filter: ["==", ["get", "weight"], "minor"], paint: { "line-color": "#fff8ec", "line-width": 5, "line-opacity": .72 } },
    { id: "schematic-major", type: "line", source: "poolr-schematic", filter: ["==", ["get", "weight"], "major"], paint: { "line-color": "#fffaf1", "line-width": 10, "line-opacity": .95 } },
  ],
};

function featureCollection(route: Coordinate[], pickup?: Coordinate, dropoff?: Coordinate) {
  return {
    type: "FeatureCollection" as const,
    features: [
      ...(route.length > 1 ? [{ type: "Feature" as const, properties: { kind: "route" }, geometry: { type: "LineString" as const, coordinates: route } }] : []),
      ...route.map((coordinate, index) => ({ type: "Feature" as const, properties: { kind: "route-point", index }, geometry: { type: "Point" as const, coordinates: coordinate } })),
      ...(pickup ? [{ type: "Feature" as const, properties: { kind: "pickup" }, geometry: { type: "Point" as const, coordinates: pickup } }] : []),
      ...(dropoff ? [{ type: "Feature" as const, properties: { kind: "dropoff" }, geometry: { type: "Point" as const, coordinates: dropoff } }] : []),
    ],
  };
}

export default function MapScene({ route = [], pickup, dropoff, draw = false, onRouteChange, className = "" }: MapSceneProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const routeRef = useRef(route);
  const pickupRef = useRef(pickup);
  const dropoffRef = useRef(dropoff);
  const callbackRef = useRef(onRouteChange);
  const [usingFallback, setUsingFallback] = useState(!apiConfig.mapStyleUrl);
  const [mapMessage, setMapMessage] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  routeRef.current = route;
  pickupRef.current = pickup;
  dropoffRef.current = dropoff;
  callbackRef.current = onRouteChange;

  useEffect(() => {
    if (!elementRef.current) return;
    let fallbackActive = !apiConfig.mapStyleUrl;
    const map = new maplibregl.Map({
      container: elementRef.current,
      style: apiConfig.mapStyleUrl || blankStyle,
      center: route[0] ?? pickup ?? [77.5946, 12.9716],
      zoom: 11.8,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: apiConfig.mapAttribution || "Poolr schematic · not road routing" }), "bottom-right");

    const frameData = () => {
      const coordinates = [...routeRef.current, ...(pickupRef.current ? [pickupRef.current] : []), ...(dropoffRef.current ? [dropoffRef.current] : [])];
      map.resize();
      if (coordinates.length === 1) {
        map.jumpTo({ center: coordinates[0], zoom: 13.5 });
        return;
      }
      if (coordinates.length > 1) {
        const bounds = new maplibregl.LngLatBounds(coordinates[0], coordinates[0]);
        coordinates.slice(1).forEach((coordinate) => bounds.extend(coordinate));
        map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
      }
    };

    const installRouteLayers = () => {
      if (map.getSource("poolr-route")) return;
      map.addSource("poolr-route", { type: "geojson", data: featureCollection(routeRef.current, pickupRef.current, dropoffRef.current) });
      map.addLayer({ id: "poolr-route-halo", type: "line", source: "poolr-route", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#fff8ec", "line-width": 13, "line-opacity": .95 } });
      map.addLayer({ id: "poolr-route", type: "line", source: "poolr-route", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#e44d3a", "line-width": 6 }, layout: { "line-cap": "round", "line-join": "round" } });
      map.addLayer({ id: "poolr-points", type: "circle", source: "poolr-route", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": ["match", ["get", "kind"], "route-point", 5, 9], "circle-color": ["match", ["get", "kind"], "dropoff", "#f0b92f", "pickup", "#0f4f4c", "#e44d3a"], "circle-stroke-color": "#211d1b", "circle-stroke-width": 2 } });
      frameData();
      setMapReady(true);
    };

    map.on("style.load", installRouteLayers);
    map.on("error", () => {
      if (!fallbackActive) {
        fallbackActive = true;
        setUsingFallback(true);
        setMapReady(false);
        setMapMessage("The configured basemap could not load. Using Poolr’s schematic canvas instead.");
        map.setStyle(blankStyle);
      }
    });
    if (draw) {
      map.getCanvas().style.cursor = "crosshair";
      map.on("click", (event: MapMouseEvent) => callbackRef.current?.([...routeRef.current, [event.lngLat.lng, event.lngLat.lat]]));
    }
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      if (map.isStyleLoaded()) frameData();
    });
    resizeObserver.observe(elementRef.current);
    mapRef.current = map;
    return () => { resizeObserver.disconnect(); map.remove(); mapRef.current = null; };
  // Map is constructed once. Data updates through the source below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource("poolr-route") as GeoJSONSource | undefined)?.setData(featureCollection(route, pickup, dropoff));
    map.resize();
    const coordinates = [...route, ...(pickup ? [pickup] : []), ...(dropoff ? [dropoff] : [])];
    if (coordinates.length === 1) map.jumpTo({ center: coordinates[0], zoom: 13.5 });
    if (coordinates.length > 1) {
      const bounds = new maplibregl.LngLatBounds(coordinates[0], coordinates[0]);
      coordinates.slice(1).forEach((coordinate) => bounds.extend(coordinate));
      map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
    }
  }, [route, pickup, dropoff]);

  const addCentrePoint = () => {
    const center = mapRef.current?.getCenter();
    if (center) callbackRef.current?.([...routeRef.current, [center.lng, center.lat]]);
  };

  return (
    <div className={`map-shell isolate overflow-hidden bg-[#eadcc1] ${className}`}>
      <div ref={elementRef} className="h-full w-full" aria-label={draw ? "Route drawing map. Click to add points or use the add-centre button." : "Ride route map"} />
      {usingFallback && <span className="pointer-events-none absolute bottom-10 left-3 z-10 max-w-[calc(100%-4rem)] rounded-full bg-paper/95 px-3 py-1.5 text-xs font-bold text-ink shadow">Schematic canvas · no road basemap</span>}
      {!mapReady && <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[#eadcc1]/90"><span className="rounded-full bg-paper px-4 py-2 text-xs font-bold text-ink shadow">Preparing route canvas…</span></div>}
      {draw && <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-4.5rem)] flex-wrap items-center gap-2"><span className="rounded-full bg-ink px-3 py-2 text-xs font-bold text-paper shadow">Click map to draw</span><button type="button" onClick={addCentrePoint} className="rounded-full bg-paper px-3 py-2 text-xs font-bold text-ink shadow">Add centre point</button></div>}
      {mapMessage && <p role="status" className="absolute inset-x-3 bottom-20 z-20 rounded-xl bg-paper p-3 text-xs font-semibold text-ink shadow-lg">{mapMessage}</p>}
    </div>
  );
}
