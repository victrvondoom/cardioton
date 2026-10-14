import { Component } from 'react';
import type { ReactNode } from 'react';

// A failed optional UI chunk must not remove numerical outputs or imply 3D success.
export class ModuleBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div role="alert">{this.props.name} unavailable. This section has not loaded successfully.
      <p>Refresh after checking the application installation. Refresh clears the in-memory profile and results.</p>
    </div> : this.props.children;
  }
}
