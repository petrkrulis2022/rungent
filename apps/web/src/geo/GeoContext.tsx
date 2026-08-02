import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { pickGeoProvider, type GeoProvider, type GeoSample } from "./GeoProvider";
import { DeviceGeoProvider } from "./DeviceGeoProvider";
import { MockGeoProvider } from "./MockGeoProvider";

interface GeoContextValue {
  provider: GeoProvider;
  sample: GeoSample | null;
  permissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
  hasHeading: boolean;
}

const GeoContext = createContext<GeoContextValue | null>(null);

export function GeoProviderRoot({ children }: { children: ReactNode }) {
  const provider = useMemo<GeoProvider>(() => {
    const kind = pickGeoProvider();
    return kind === "mock" ? new MockGeoProvider() : new DeviceGeoProvider();
  }, []);

  const [sample, setSample] = useState<GeoSample | null>(provider.getLast());
  const [permissionGranted, setPermissionGranted] = useState(provider.kind === "mock");

  useEffect(() => provider.subscribe(setSample), [provider]);

  const requestPermission = async () => {
    const ok = await provider.requestPermission();
    setPermissionGranted(ok);
    return ok;
  };

  const hasHeading =
    provider.kind === "mock" ? true : ((provider as any).hasHeading ?? false);

  return (
    <GeoContext.Provider value={{ provider, sample, permissionGranted, requestPermission, hasHeading }}>
      {children}
    </GeoContext.Provider>
  );
}

export function useGeo() {
  const ctx = useContext(GeoContext);
  if (!ctx) throw new Error("useGeo must be used within GeoProviderRoot");
  return ctx;
}
