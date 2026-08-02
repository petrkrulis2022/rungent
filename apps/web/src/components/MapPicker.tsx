import { useEffect, useRef, useState } from "react";
import { useGoogleMaps } from "../lib/useGoogleMaps";

export interface Pin {
  lat: number;
  lng: number;
}

interface Props {
  start: Pin;
  end: Pin;
  routePreview?: Array<{ lat: number; lng: number }>;
  onChange: (next: { start: Pin; end: Pin }) => void;
}

/**
 * Tap-to-place / drag-to-move start and end pins on a real map.
 * First tap sets START, second sets END, subsequent taps move whichever pin
 * is closer — which in testing is what people expect without being told.
 */
export function MapPicker({ start, end, routePreview, onChange }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const endMarkerRef = useRef<any>(null);
  const lineRef = useRef<any>(null);
  const { loaded, error } = useGoogleMaps();
  const [hint, setHint] = useState("Drag a pin, or tap the map to move the nearer one.");

  useEffect(() => {
    if (!loaded || !divRef.current || mapRef.current) return;
    const g = (window as any).google;

    const map = new g.maps.Map(divRef.current, {
      center: { lat: start.lat, lng: start.lng },
      zoom: 16,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
      styles: DARK_MAP_STYLE,
    });
    mapRef.current = map;

    startMarkerRef.current = new g.maps.Marker({
      position: start,
      map,
      draggable: true,
      label: { text: "A", color: "#07090C", fontWeight: "700" },
      title: "Start",
    });
    endMarkerRef.current = new g.maps.Marker({
      position: end,
      map,
      draggable: true,
      label: { text: "B", color: "#07090C", fontWeight: "700" },
      title: "End",
    });

    const emit = () => {
      const s = startMarkerRef.current.getPosition();
      const e = endMarkerRef.current.getPosition();
      onChange({
        start: { lat: s.lat(), lng: s.lng() },
        end: { lat: e.lat(), lng: e.lng() },
      });
    };

    startMarkerRef.current.addListener("dragend", emit);
    endMarkerRef.current.addListener("dragend", emit);

    map.addListener("click", (ev: any) => {
      const clicked = { lat: ev.latLng.lat(), lng: ev.latLng.lng() };
      const s = startMarkerRef.current.getPosition();
      const e = endMarkerRef.current.getPosition();
      const dStart = (s.lat() - clicked.lat) ** 2 + (s.lng() - clicked.lng) ** 2;
      const dEnd = (e.lat() - clicked.lat) ** 2 + (e.lng() - clicked.lng) ** 2;
      if (dStart <= dEnd) {
        startMarkerRef.current.setPosition(clicked);
        setHint("Moved START (A).");
      } else {
        endMarkerRef.current.setPosition(clicked);
        setHint("Moved END (B).");
      }
      emit();
    });
  }, [loaded]);

  // keep markers in sync when parent changes pins (e.g. "use my GPS")
  useEffect(() => {
    if (!startMarkerRef.current) return;
    startMarkerRef.current.setPosition(start);
    endMarkerRef.current.setPosition(end);
  }, [start.lat, start.lng, end.lat, end.lng]);

  // draw the planned walking route
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const g = (window as any).google;
    if (lineRef.current) lineRef.current.setMap(null);
    if (!routePreview?.length) return;

    lineRef.current = new g.maps.Polyline({
      path: routePreview,
      map: mapRef.current,
      strokeColor: "#00FF6A",
      strokeOpacity: 0.9,
      strokeWeight: 4,
    });

    const bounds = new g.maps.LatLngBounds();
    routePreview.forEach((p) => bounds.extend(p));
    mapRef.current.fitBounds(bounds, 48);
  }, [loaded, routePreview]);

  if (error) {
    return <div className="warn-banner">{error}</div>;
  }

  return (
    <div>
      <div
        ref={divRef}
        style={{
          width: "100%",
          height: 320,
          borderRadius: 8,
          border: "1px solid #2a3138",
          background: "#10141a",
        }}
      />
      <p style={{ fontSize: "0.75rem", color: "#8fa3a0", marginTop: 6 }}>{hint}</p>
    </div>
  );
}

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#10141a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#07090C" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8fa3a0" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a3138" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6b7d7a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1a1f" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
