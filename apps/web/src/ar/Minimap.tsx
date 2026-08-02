import { useEffect } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  route: LatLng[];
  hunter: LatLng;
  rungent: LatLng | null;
  rangeM: number;
  distanceM: number | null;
}

const ll = (p: LatLng): [number, number] => [p.lat, p.lng];

/** Keeps both you and the Rungent framed as either of you moves. */
function Follow({ hunter, rungent }: { hunter: LatLng; rungent: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = [[hunter.lat, hunter.lng]];
    if (rungent && isFinite(rungent.lat)) pts.push([rungent.lat, rungent.lng]);
    if (pts.length === 1) {
      map.setView(pts[0], 16, { animate: false });
    } else {
      map.fitBounds(L.latLngBounds(pts).pad(0.45), { animate: false, maxZoom: 17 });
    }
  }, [map, hunter.lat, hunter.lng, rungent?.lat, rungent?.lng]);
  return null;
}

/**
 * Live street minimap for the hunter: you (cyan) + your engagement-range ring,
 * the committed route, and the Rungent (green) moving live. OpenStreetMap tiles
 * — no API key, works on localhost and over an ngrok tunnel on a phone.
 *
 * DEV/TESTING: the Rungent dot relies on the worker's live position feed, which
 * bypasses the range gate. For the real game, delay or drop that feed.
 */
export function Minimap({ route, hunter, rungent, rangeM, distanceM }: Props) {
  if (!hunter || !isFinite(hunter.lat) || !isFinite(hunter.lng)) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: 120,
        zIndex: 25,
        width: 210,
        background: "rgba(7,9,12,0.9)",
        border: "1px solid #1e2b28",
        borderRadius: 10,
        padding: 8,
      }}
    >
      <MapContainer
        center={ll(hunter)}
        zoom={16}
        style={{ height: 180, width: "100%", borderRadius: 6 }}
        attributionControl={false}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {route.length > 1 && (
          <Polyline
            positions={route.map((p) => [p.lat, p.lng]) as [number, number][]}
            pathOptions={{ color: "#00E5FF", weight: 2, opacity: 0.55 }}
          />
        )}
        <Circle
          center={ll(hunter)}
          radius={rangeM}
          pathOptions={{ color: "#00E5FF", weight: 1, fillColor: "#00E5FF", fillOpacity: 0.08 }}
        />
        <CircleMarker
          center={ll(hunter)}
          radius={6}
          pathOptions={{ color: "#07090c", fillColor: "#00E5FF", fillOpacity: 1, weight: 2 }}
        />
        {rungent && isFinite(rungent.lat) && (
          <CircleMarker
            center={ll(rungent)}
            radius={6}
            pathOptions={{ color: "#07090c", fillColor: "#00FF6A", fillOpacity: 1, weight: 2 }}
          />
        )}
        <Follow hunter={hunter} rungent={rungent} />
      </MapContainer>
      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          fontFamily: "monospace",
          color: "#8fa3a0",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span style={{ color: "#00E5FF" }}>you</span>
        <span style={{ color: "#00FF6A" }}>rungent</span>
        <span>{distanceM != null ? `${distanceM.toFixed(0)} m` : rungent ? "—" : "no signal"}</span>
      </div>
    </div>
  );
}
