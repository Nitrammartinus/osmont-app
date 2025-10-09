// FIX: To resolve "Cannot find type definition file for 'vite/client'", the reference
// to vite/client has been removed. Instead, the necessary types for `import.meta.env`
// are defined manually below. This makes the types self-contained and robust
// against environment-specific module resolution issues.

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
