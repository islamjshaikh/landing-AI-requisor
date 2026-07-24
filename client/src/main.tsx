import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Extend Window interface for TypeScript
declare global {
  interface Window {
    __authErrorLogged?: boolean;
  }
}

// Comprehensive unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  
  // Catch all authentication and network-related errors
  const shouldSuppressError = error && (
    // Network fetch errors
    (error.name === 'TypeError' && error.message?.includes('Failed to fetch')) ||
    (typeof error === 'string' && error.includes('Failed to fetch')) ||
    (typeof error.message === 'string' && error.message.includes('Failed to fetch')) ||
    // HTTP errors
    (error.status === 401) || (error.status === 302) || (error.status === 500) ||
    // Network codes
    (error.code === 'NETWORK_ERROR') || (error.name === 'NetworkError') ||
    // Abort errors
    (error.name === 'AbortError') ||
    // Auth-related URLs
    (typeof error.message === 'string' && error.message.includes('/api/auth')) ||
    // Generic connection errors
    (typeof error.message === 'string' && error.message.toLowerCase().includes('connection')) ||
    (typeof error.message === 'string' && error.message.toLowerCase().includes('network'))
  );
  
  if (shouldSuppressError) {
    event.preventDefault();
    // Silent suppression - useAuth already logs what's needed
    return;
  }
  
  // Log unexpected errors for debugging
  console.error('Unhandled promise rejection:', error);
});

createRoot(document.getElementById("root")!).render(<App />);
