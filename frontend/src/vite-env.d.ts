// FIX: Removed the triple-slash directive `/// <reference types="vite/client" />`
// which was causing a "Cannot find type definition file" error in the build environment.
// The interfaces below augment the global types for import.meta.env,
// providing the necessary type information for the application to compile correctly.

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
