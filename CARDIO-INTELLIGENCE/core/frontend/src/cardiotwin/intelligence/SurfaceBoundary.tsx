import { Component, type ReactNode } from "react";

/** Rendering and lazy-module failures cannot remove the underlying evidence controls. */
export default class SurfaceBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
