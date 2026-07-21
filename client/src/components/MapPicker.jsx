import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Colored dot markers via divIcon — avoids Leaflet's broken default marker-image imports under Vite.
const dot = (color) =>
    L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};box-shadow:0 0 10px ${color};border:2px solid #fff;"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });

const START_ICON = dot("#00FF6A");
const END_ICON = dot("#FF2E9A");

// Clicking the map moves whichever pin is "active" (placeMode: 'start' | 'end').
function ClickToSet({ mode, onSet }) {
    useMapEvents({
        click(e) {
            onSet(mode, e.latlng.lat, e.latlng.lng);
        }
    });
    return null;
}

/**
 * Interactive start/end picker. `value` = { startLat, startLng, endLat, endLng }.
 * onChange receives a partial patch to merge into the admin form.
 */
export default function MapPicker({ value, onChange, placeMode, setPlaceMode }) {
    // Leaflet fixes its center at mount time; center once on the start point.
    const center = useMemo(
        () => [Number(value.startLat) || 0, Number(value.startLng) || 0],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const setPoint = (which, lat, lng) => {
        if (which === "start") onChange({ startLat: lat, startLng: lng });
        else onChange({ endLat: lat, endLng: lng });
    };

    const start = [Number(value.startLat), Number(value.startLng)];
    const end = [Number(value.endLat), Number(value.endLng)];

    return (
        <div style={{ position: "relative" }}>
            <MapContainer
                center={center}
                zoom={15}
                style={{ height: "220px", width: "100%", borderRadius: "6px" }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ClickToSet mode={placeMode} onSet={setPoint} />
                <Polyline positions={[start, end]} pathOptions={{ color: "#00E5FF", weight: 2, dashArray: "6 6", opacity: 0.7 }} />
                <Marker
                    position={start}
                    icon={START_ICON}
                    draggable={true}
                    eventHandlers={{
                        dragend: (e) => {
                            const m = e.target.getLatLng();
                            setPoint("start", m.lat, m.lng);
                        }
                    }}
                />
                <Marker
                    position={end}
                    icon={END_ICON}
                    draggable={true}
                    eventHandlers={{
                        dragend: (e) => {
                            const m = e.target.getLatLng();
                            setPoint("end", m.lat, m.lng);
                        }
                    }}
                />
            </MapContainer>

            {/* Which pin does a map-click move? */}
            <div style={{ position: "absolute", top: 6, right: 6, zIndex: 500, display: "flex", gap: 4 }}>
                <button
                    type="button"
                    onClick={() => setPlaceMode("start")}
                    style={{
                        fontSize: 9,
                        padding: "3px 6px",
                        background: placeMode === "start" ? "#00FF6A" : "rgba(0,0,0,.75)",
                        color: placeMode === "start" ? "#000" : "#00FF6A",
                        border: "1px solid #00FF6A",
                        borderRadius: 3,
                        cursor: "pointer",
                        fontWeight: 700
                    }}
                >
                    SET START
                </button>
                <button
                    type="button"
                    onClick={() => setPlaceMode("end")}
                    style={{
                        fontSize: 9,
                        padding: "3px 6px",
                        background: placeMode === "end" ? "#FF2E9A" : "rgba(0,0,0,.75)",
                        color: placeMode === "end" ? "#000" : "#FF2E9A",
                        border: "1px solid #FF2E9A",
                        borderRadius: 3,
                        cursor: "pointer",
                        fontWeight: 700
                    }}
                >
                    SET END
                </button>
            </div>
        </div>
    );
}
