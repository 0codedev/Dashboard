import React, { type ReactNode, type ErrorInfo } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  // Fix: Replaced state class property with a constructor to initialize state.
  // This resolves TypeScript errors where properties like `this.props` and `this.setState`
  // from `React.Component` were not being found on the class instance.
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center space-y-2 bg-red-900/10 rounded-lg border border-red-900/30">
          <span className="text-3xl">⚠️</span>
          <h3 className="text-sm font-bold text-red-300">Widget Error</h3>
          <p className="text-xs text-red-400 max-w-[200px] truncate">{this.state.error?.message}</p>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={this.handleReset}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
