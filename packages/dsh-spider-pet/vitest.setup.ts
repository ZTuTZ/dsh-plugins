// Minimal ModuleLoader stub for the client-half closure-factory shape.
declare global {
  interface Window {
    __ModuleLoader__?: { load(id: string, factory: () => unknown): void }
  }
}

if (typeof window !== 'undefined' && !window.__ModuleLoader__) {
  window.__ModuleLoader__ = { load: () => undefined }
}

export {}
