import React from 'react';

/**
 * Last line of defence. There was no boundary anywhere, so any render-time throw
 * blanked the page with nothing in the UI to explain it — and the most likely
 * source was a corrupt localStorage value read during ThemeProvider's
 * initialisation, which no amount of reloading would clear.
 *
 * Must be a class: there is still no hook equivalent of componentDidCatch.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info?.componentStack);
  }

  handleReset = () => {
    // Preferences are the most likely culprit and the cheapest thing to lose.
    try {
      localStorage.clear();
    } catch {
      /* storage may be denied outright */
    }
    window.location.assign('/');
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Something broke on our end</h1>
          <p className="text-slate-400 mb-8">
            This page hit an error it couldn't recover from. Reloading usually fixes it. If it keeps
            happening, clearing this site's saved settings will.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-white font-bold px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity"
            >
              Reload
            </button>
            <button
              onClick={this.handleReset}
              className="bg-slate-800 text-slate-300 font-medium px-5 py-2.5 rounded-full hover:bg-slate-700 transition-colors"
            >
              Reset settings
            </button>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-8 text-left text-xs text-red-400 bg-slate-900 p-4 rounded-lg overflow-auto max-h-48">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
