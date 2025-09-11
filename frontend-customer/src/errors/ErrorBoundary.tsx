import React from "react";
import { logClientError } from "@/utils/log";

type State = { hasError: boolean };
export default class ErrorBoundary extends React.Component<{children:React.ReactNode}, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, info: any) {
    logClientError({ message: String(error), stack: info?.componentStack || (error?.stack || "") });
  }
  render(){ return this.state.hasError ? <div className="p-6">Something went wrong.</div> : this.props.children; }
}
