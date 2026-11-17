import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Error boundary around high-risk editor and preview areas.
 * Reports are kept out of rendered error messages so sensitive content
 * never leaks into visible error UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Deliberately no report content in logs: errors must not leak user data.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-800"
        >
          <p className="font-semibold">Something went wrong in {this.props.label ?? "this area"}.</p>
          <p className="mt-1 text-xs leading-relaxed">
            Your in-memory report is untouched. You can retry, or navigate to another section
            without losing entered content.
          </p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
