// Fix: Comment out the reference to "vite/client" to prevent a TypeScript error in environments where type resolution might not be correctly configured. The interfaces below are sufficient for the app's usage of import.meta.env.
// /// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
