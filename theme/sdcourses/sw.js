// const latest = {
//   cache: 'Offline/v1'
// };

// self.addEventListener('install', event => {
//   event.waitUntil(
//     caches.open(latest.cache).then(cache => {
//       return cache.addAll([
//         '/',
//         'offline.html',
//         video1
//       ]);
//     })
//   );
// });

// self.addEventListener('fetch', event => {
//   // exclude requests that start with chrome-extension://
//   if (event.request.url.startsWith('chrome-extension://')) return;
//   event.respondWith(
//     caches.open(latest.cache).then(cache => {
//       return cache.match(event.request).then(response => {
//         var fetchPromise = fetch(event.request).then(networkResponse => {
//           cache.put(event.request, networkResponse.clone());
//           return networkResponse;
//         })
//         return response || fetchPromise;
//       })
//     })
//   );
// });

// self.addEventListener('activate', event => {
//   event.waitUntil(
//     caches.keys().then(cacheNames => {
//       return Promise.all(
//         cacheNames.filter(cacheName => {
//           if (cacheName === latest.cache) {
//             return false;
//           }

//           return true;
//         }).map(cacheName => {
//           return caches.delete(cacheName)
//         })
//       );
//     })
//   );
// });
// // This is the "Offline copy of pages" service worker

const CACHE = 'pwa-offline'
const assets = [
  "/",
]
//
// TODO: replace the following with the correct offline fallback page i.e.: const offlineFallbackPage = "index.html";
const offlineFallbackPage = 'offline.html'

// Install stage sets up the index page (home page) in the cache and opens a new cache
self.addEventListener('install', function (event) {
  console.log('[PWA] Install Event processing')

  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      console.log('[PWA] Cached offline page during install')

      /*if (offlineFallbackPage === "offline.html") {
        return cache.add(new Response("TODO: Update the value of the offlineFallbackPage constant in the serviceworker."));
      }*/

      return cache.add(offlineFallbackPage, assets)
    })
  )
})

// If any fetch fails, it will look for the request in the cache and serve it from there first
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return
 // exclude requests that start with chrome-extension://
 if (event.request.url.startsWith('chrome-extension://')) return;
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        // console.log("[PWA ] add page to offline cache: " + response.url);

        // If request was success, add or update it in the cache
        event.waitUntil(updateCache(event.request, response.clone()))

        return response
      })
      .catch(function (error) {
        console.log('[PWA] Network request Failed. Serving content from cache: ' + error)
        return fromCache(event.request)
      })
  )
})

function fromCache(request) {
  // Check to see if you have it in the cache
  // Return response
  // If not in the cache, then return error page
  return caches.open(CACHE).then(function (cache) {
    return cache.match(request).then(function (matching) {
      if (!matching || matching.status === 404) {
        return Promise.reject('no-match')
      }

      return matching
    })
  })
}

function updateCache(request, response) {
  return caches.open(CACHE).then(function (cache) {
    return cache.put(request, response)
  })
}
