// Fix for old non-SPA friendly preact-cli service worker
// Self-deleting service worker
// https://github.com/NekR/self-destroying-sw

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  self.registration
    .unregister()
    .then(function() {
      return self.clients.matchAll();
    })
    .then(function(clients) {
      clients.forEach(client => client.navigate(client.url));
    });
});
