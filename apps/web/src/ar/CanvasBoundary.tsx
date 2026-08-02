import { Component, type ReactNode } from "react";

/**
 * A failure inside the WebGL canvas otherwise unmounts the AR view and leaves
 * the HUD floating over a blank screen, which is indistinguishable from the
 * Rungent being out of sight. On a phone there is no console to check, so the
 * error has to be readable on the device itself.
 */
export class CanvasBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(err: unknown) {
    return { error: (err as Error)?.message ?? String(err) };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "fixed",
            top: 80,
            left: 12,
            right: 12,
            zIndex: 40,
            padding: "10px 12px",
            background: "rgba(7,9,12,0.94)",
            border: "1px solid #FF2E9A",
            borderRadius: 8,
            color: "#FF2E9A",
            font: "11px/1.5 monospace",
          }}
        >
          3D view failed to start:
          <br />
          {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}
