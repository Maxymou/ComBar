/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ENABLE_PWA?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_BUILD_TIMESTAMP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
