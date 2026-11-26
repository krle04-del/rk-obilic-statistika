
const CACHE_NAME = "rk-obilic-v0.7";

const APP_FILES = [
    "./index.html",
    "./style.css",
    "./database.js",
    "./app.js",
    "./match.js",
    "./import.js",
    "./settings.js",
    "./import_matches.js",
    "./xlsx.full.min.js",
    "./manifest.json"
];

// Čuvanje fajlova aplikacije

self.addEventListener("install", event => {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );

});

// Uklanjanje prethodnih verzija keša

self.addEventListener("activate", event => {

    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key =>
                        key.startsWith("rk-obilic-") &&
                        key !== CACHE_NAME
                    )
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );

});

// Pokretanje aplikacije sa internetom ili bez njega

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") return;

    if (new URL(event.request.url).origin !== self.location.origin) return;

    event.respondWith(

        fetch(event.request)
            .then(response => {

                if (response.ok) {
                    const copy = response.clone();

                    event.waitUntil(
                        caches.open(CACHE_NAME)
                            .then(cache =>
                                cache.put(event.request, copy)
                            )
                    );
                }

                return response;

            })
            .catch(async () => {

                const cached = await caches.match(event.request);

                if (cached) return cached;

                if (event.request.mode === "navigate") {
                    return caches.match("./index.html");
                }

                return Response.error();

            })
    );

});
