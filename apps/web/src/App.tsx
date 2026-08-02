import { useEffect, useState } from "react";
import { GeoProviderRoot } from "./geo/GeoContext";
import { MockGeoPanel } from "./geo/MockGeoPanel";
import { DeployerView } from "./views/DeployerView";
import { HunterView } from "./views/HunterView";
import "./app.css";

type Role = "select" | "deployer" | "hunter";

export default function App() {
  const [role, setRole] = useState<Role>("select");
  const [legId, setLegId] = useState<string | null>(null);

  // Deep-link support: the shareable hunt link is /?role=hunter&leg=<uuid>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("role");
    const leg = params.get("leg");
    if (leg) setLegId(leg);
    if (r === "hunter") setRole("hunter");
    if (r === "deployer") setRole("deployer");
  }, []);

  return (
    <GeoProviderRoot>
      <div className="app-shell">
        {role === "select" && (
          <div className="role-select">
            <h1>RUNDOWN</h1>
            <p className="tagline">Hunt the Rungent.</p>
            <div className="role-buttons">
              <button onClick={() => setRole("deployer")}>Deployer (Wallet A)</button>
              <button onClick={() => setRole("hunter")}>Hunter (Wallet B)</button>
            </div>
            <p className="hint">
              Deploy on one wallet, hunt on another. Open the hunt link in a second browser
              profile or on a phone to run the full two-wallet demo.
            </p>
          </div>
        )}
        {role === "deployer" && <DeployerView onBack={() => setRole("select")} />}
        {role === "hunter" && <HunterView onBack={() => setRole("select")} legId={legId} />}
        {role !== "hunter" && <MockGeoPanel />}
      </div>
    </GeoProviderRoot>
  );
}
