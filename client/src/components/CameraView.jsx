import React, { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, AlertTriangle } from "lucide-react";

/**
 * CameraView Component
 * Stream of the device camera rendered full-screen in the background.
 */
export default function CameraView({ active = true, onError }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [permissionState, setPermissionState] = useState("prompt"); // 'prompt' | 'granted' | 'denied'
    const [errorText, setErrorText] = useState("");

    useEffect(() => {
        if (!active) {
            stopCamera();
            return;
        }

        startCamera();

        return () => {
            stopCamera();
        };
    }, [active]);

    const startCamera = async () => {
        setErrorText("");
        try {
            if (streamRef.current) {
                stopCamera();
            }

            console.log("📷 Web camera activation requested");
            const constraints = {
                video: {
                    facingMode: { ideal: "environment" }, // Ideal for rear camera
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setPermissionState("granted");
        } catch (error) {
            console.error("❌ Camera activation failed:", error);
            setPermissionState("denied");
            setErrorText(error.message || "Failed to initialize webcam");
            if (onError) onError(error);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 1,
                backgroundColor: "#000",
                overflow: "hidden"
            }}
        >
            {permissionState === "granted" && (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover"
                    }}
                />
            )}

            {permissionState === "denied" && (
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px",
                        color: "#ff5e7e",
                        textAlign: "center"
                    }}
                >
                    <CameraOff size={48} style={{ marginBottom: "16px" }} />
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px" }}>
                        Camera Locked
                    </h3>
                    <p style={{ fontSize: "0.9rem", opacity: 0.8, maxWidth: "280px" }}>
                        Permissions denied or device camera busy. Geolocation AR requires camera sight.
                    </p>
                    <p style={{ fontSize: "0.8rem", color: "#ffa500", marginTop: "12px", fontFamily: "monospace" }}>
                        Details: {errorText}
                    </p>
                </div>
            )}

            {permissionState === "prompt" && (
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#6b7280"
                    }}
                >
                    <Camera size={32} className="animate-pulse" />
                    <p style={{ marginTop: "12px", fontSize: "0.9rem" }}>Powering camera optics...</p>
                </div>
            )}
        </div>
    );
}
