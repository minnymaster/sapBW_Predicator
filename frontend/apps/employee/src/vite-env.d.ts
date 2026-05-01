/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MANAGE_API_URL: string;
  readonly VITE_LEARNING_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
