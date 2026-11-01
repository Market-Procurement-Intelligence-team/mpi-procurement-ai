import { Component, ErrorInfo, ReactNode } from "react"
import MaterialIcon from "./MaterialIcon"

interface Props {
  children: ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[MPI ErrorBoundary]", error, errorInfo)
    this.setState({ errorInfo })
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 sm:p-8 rounded-2xl bg-white border border-rose-200/80 shadow-sm max-w-2xl mx-auto my-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <MaterialIcon name="warning" size={24} />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: "Plus Jakarta Sans" }}>
              {this.props.fallbackTitle || "This component encountered an unexpected error"}
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              {this.props.fallbackMessage ||
                "A non-fatal rendering exception occurred. The rest of the platform remains fully functional."}
            </p>
          </div>

          {this.state.error && (
            <div className="text-left bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-600 max-h-32 overflow-y-auto">
              <span className="font-bold text-rose-700">Error:</span> {this.state.error.message}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-[#051F16] hover:bg-[#083A28] text-white cursor-pointer shadow-xs transition-colors"
            >
              <MaterialIcon name="refresh" size={14} className="text-[#A3F65C]" />
              <span>Retry Component</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
