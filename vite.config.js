import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Atualiza o SW automaticamente quando há nova versão deployada
      registerType: 'autoUpdate',
      // Ícone do app em /public é assumido. Se a pasta não existir, o build ainda passa.
      includeAssets: ['favicon.ico', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Fundepar — Gestão de Workflow',
        short_name: 'Fundepar TI',
        description:
          'Sistema profissional de gestão de chamados, equipamentos e movimentações de patrimônio.',
        theme_color: '#0c4a6e',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'pt-BR',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cacheia HTML/CSS/JS pra funcionar offline depois da primeira visita
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Bibliotecas pesadas (Tesseract, ZXing) vêm do CDN local — não pre-cacheia
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // Navegação fallback para SPAs
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /\/auth\//],
        runtimeCaching: [
          {
            // Fontes do Google: cache de longa duração
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // API do Supabase: stale-while-revalidate — mostra cache antigo enquanto busca novo
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // não habilita PWA no dev pra não confundir
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
})
