/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ENABLE_PWA?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_BUILD_TIMESTAMP?: string;
  readonly VITE_SYNC_INTERVAL_MS?: string;
  readonly VITE_SYNC_MAX_AUTO_RETRIES?: string;
  readonly VITE_CACHE_BUST?: string;
  readonly VITE_DEBUG_ADMIN_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
