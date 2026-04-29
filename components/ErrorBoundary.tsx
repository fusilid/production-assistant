"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="bg-gray-900 border border-red-800 rounded-lg p-6 max-w-md text-center">
            <p className="text-red-400 font-semibold mb-2">Display Error</p>
            <p className="text-gray-400 text-sm">{this.state.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, message: "" })}
              className="mt-4 text-xs text-blue-400 underline hover:text-blue-300"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
