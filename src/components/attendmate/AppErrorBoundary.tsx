"use client";
// App-level error boundary: a render crash shows a recovery card instead of a
// blank page. User data is untouched — it lives in localStorage, not in the
// crashed React tree.
import { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { BrandMark } from "./bits";

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // console keeps it on-device for debugging; nothing is reported anywhere
    console.error("AttendMate crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="clay-card w-full max-w-sm p-8 text-center">
          <BrandMark size={44} />
          <h1 className="mt-4 text-lg font-bold">Something broke on this screen</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Your data is safe on this device. Reload to recover — if it keeps happening, use Settings → Erase stored data.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="clay-btn clay-primary clay-lg mt-6 w-full justify-center"
          >
            <RefreshCw className="h-4 w-4" /> Reload AttendMate
          </button>
        </div>
      </div>
    );
  }
}
