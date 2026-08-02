import { useEffect, useState } from "react";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

let loadPromise: Promise<void> | null = null;

/** Load the Google Maps JS API once, shared across all callers. */
function loadMapsScript(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.maps) {
      resolve();
      return;
    }
    if (!MAPS_KEY) {
      reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not set — copy .env.example to .env"));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=marker&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(
        new Error(
          "Google Maps failed to load. Check the key is valid and that this origin " +
            "is allowed under the key's HTTP referrer restrictions in the GCP console."
        )
      );
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function useGoogleMaps() {
  const [loaded, setLoaded] = useState(!!(window as any).google?.maps);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMapsScript()
      .then(() => !cancelled && setLoaded(true))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return { loaded, error };
}
