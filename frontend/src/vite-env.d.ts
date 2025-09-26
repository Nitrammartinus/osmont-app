// Fix: Manually define `ImportMeta` to resolve errors with Vite's environment variables.
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
