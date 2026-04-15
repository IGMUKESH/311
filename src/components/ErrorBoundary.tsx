import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as any) {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const { hasError, error } = (this as any).state;
    const { children } = (this as any).props;

    if (hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black p-4 text-center">
          <h1 className="text-2xl font-bold text-#F27D26 mb-4">Something went wrong</h1>
          <p className="text-[#8E9299] mb-8 max-w-md">
            We're sorry for the inconvenience. Please try refreshing the page or contact support if the problem persists.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-#F27D26 text-white px-8 py-3 rounded-full font-bold hover:bg-opacity-90 transition-all"
          >
            Refresh Page
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-8 p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-xs text-left overflow-auto max-w-full">
              {error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return children;
  }
}
