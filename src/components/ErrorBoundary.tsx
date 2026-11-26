import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {hasError: true, message: error.message || 'An unexpected error occurred.'};
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F9F9FB] dark:bg-[#09090B] text-[#09090B] dark:text-zinc-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-8 space-y-4 text-center shadow-sm">
            <h1 className="text-[20px] font-semibold tracking-tight">Something went wrong</h1>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({hasError: false, message: ''});
                window.location.reload();
              }}
              className="h-10 px-5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-[13px] font-semibold cursor-pointer"
            >
              Reload Klyro
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
