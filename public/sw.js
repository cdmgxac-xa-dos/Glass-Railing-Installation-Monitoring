const CACHE_NAME = 'xa-dos-shell-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Passthrough fetch handler — required by browsers for "installable" PWA
// criteria. No offline caching logic yet; just lets the app be added to
// the home screen and launched without browser chrome.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
