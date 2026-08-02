import { useEffect, useRef, useState } from "react";

/**
 * Rear-camera video feed rendered behind the WebGL canvas.
 *
 * WebXR is deliberately not used: it is unavailable in iOS Safari, and the
 * demo must run on iPhones. getUserMedia + Geolocation + DeviceOrientation is
 * the portable path.
 */
export function CameraFeed({ onError }: { onError?: (msg: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e: any) {
        const msg =
          e?.name === "NotAllowedError"
            ? "Camera permission denied. Reload and allow camera access."
            : e?.name === "NotFoundError"
              ? "No camera found on this device."
              : `Camera error: ${e?.message ?? e}`;
        onError?.(msg);
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <video
      ref={videoRef}
      playsInline
      muted
      autoPlay
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        zIndex: 0,
        background: "#000",
        opacity: ready ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    />
  );
}
