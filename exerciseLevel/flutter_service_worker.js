'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"assets/AssetManifest.bin": "b67db5632d57e4b707144445951cb257",
"assets/AssetManifest.json": "caf6120240c019e13453659e259e4476",
"assets/assets/exercise/img/001713.gif": "e4076d7e850b1e4da2615a915d29fe6b",
"assets/assets/exercise/img/002513.gif": "02bf862b89fed610169a0329be7683b5",
"assets/assets/exercise/img/003113.gif": "062f651ea9a657379a2f530d3590d3a3",
"assets/assets/exercise/img/004713.gif": "8a68cd685adfd8b59c192293ae717a8c",
"assets/assets/exercise/img/016213.gif": "f0f000677ebe42bf9f1fd414caadffbf",
"assets/assets/exercise/img/016913.gif": "68ec81bedfae3f890fe5e9dc7353bfb0",
"assets/assets/exercise/img/018013.gif": "874329cc34be373e05bb5fb3fe5e7df5",
"assets/assets/exercise/img/019813.gif": "af6b226b48e09fb7debf8288a7d6bdd9",
"assets/assets/exercise/img/020113.gif": "a01909369af9e347ca846cbee3410f5e",
"assets/assets/exercise/img/021213.gif": "306e4fa7dee793814a5adb243f2d14c5",
"assets/assets/exercise/img/057213.gif": "0043a0ddaa13a1ac7879cc9a362ae0a9",
"assets/assets/exercise/img/057313.gif": "142bdd2afe362570bed1a7e37fc4de5a",
"assets/assets/exercise/img/057913.gif": "8cde6c7cab8d14552f7eb07871f649a4",
"assets/assets/exercise/img/058413.gif": "ed2cd8c1c3b743ace3f02398375853c0",
"assets/assets/exercise/img/059613.gif": "874901d6beb9a4852df4aa8f156b6956",
"assets/assets/exercise/img/059813.gif": "b4bde4a1db414820720282efad338f7e",
"assets/assets/exercise/img/059913.gif": "11c7c7a62b00a78ff07a84b7bf0ea128",
"assets/assets/exercise/img/060713.gif": "a9a53b627a21dfde85cc75f5e8773e90",
"assets/assets/exercise/img/061213.gif": "1e99e37d8079f729a81432fd013a098e",
"assets/assets/exercise/img/065213.gif": "f1336ba7e6b60c1869c1e5056caa81eb",
"assets/assets/exercise/img/068413.gif": "c7a7908a17ab9740f0180cbc56dd6a05",
"assets/assets/exercise/img/075213.gif": "1079132ba9ad25c89e0edffbb447018e",
"assets/assets/exercise/img/075313.gif": "7556081e9741d9bb44583cf27c0255ae",
"assets/assets/exercise/img/076213.gif": "ef406ef560321908454347a9c3162ba4",
"assets/assets/exercise/img/076713.gif": "d53a7b10c67cb64b88a149af9bbba677",
"assets/assets/exercise/img/076913.gif": "267c864e30d14b1d09dfa8ae4ace87ce",
"assets/assets/exercise/img/077013.gif": "8b30c9559acb27ddd22673ba652af1d0",
"assets/assets/exercise/img/078713.gif": "289cd1f993676230fb4d21e7a0645dbe",
"assets/assets/exercise/img/086013.gif": "a81c4fd31b698152f96e2eebc0486e5c",
"assets/assets/exercise/img/086813.gif": "4506dfc5ffa80ac89ab1e2c697c19d92",
"assets/assets/exercise/img/103013.gif": "cdbeedfda3deb0c992907fdae26a2636",
"assets/assets/exercise/img/103113.gif": "b4844bf68d4a9b000ceda39a7668101f",
"assets/assets/exercise/img/103613.gif": "57e7dccf0a17133cd8b4c6131fb2f564",
"assets/assets/exercise/img/116013.gif": "8f5957d0387d6af7ce273a3487c1109e",
"assets/assets/exercise/img/130113.gif": "8bb8fe46902f92ef71d2401fd9950d0d",
"assets/assets/exercise/img/131813.gif": "0dc40ed0ea3f0e9a044afe34044cd324",
"assets/assets/exercise/img/132613.gif": "64ca40c5e3694d624be4cea2a03fc16f",
"assets/assets/exercise/img/135013.gif": "4b800576d8edd2a6cae116c1274e7629",
"assets/assets/exercise/img/135913.gif": "49136b759b0c86ed6af09defb915cd36",
"assets/assets/exercise/img/137513.gif": "b9b9f3ac2d2bf7c9279159017fa43ed1",
"assets/assets/exercise/img/145213.gif": "af3c23e7b3c4434bcf86db2da7d88790",
"assets/assets/exercise/img/145413.gif": "5e337fa6c3b0c423647f3d30a81faff2",
"assets/assets/exercise/img/145513.gif": "d9db1b21eaab58756b0f7ba7b17cc047",
"assets/assets/exercise/img/147913.gif": "d11d79806d81ac5d578439c8116db26b",
"assets/assets/exercise/img/175513.gif": "1520c5fa0d770a1fef59219b69990445",
"assets/assets/exercise/img/213813.gif": "dad9b928ff057bceddd2bd17a2d0dfe0",
"assets/assets/exercise/img/214413.gif": "651de00dc15900e5ac895e248248985b",
"assets/assets/exercise/img/219213.gif": "8bd115d2e62826be175d3c71aa22aa05",
"assets/assets/exercise/img/225913.gif": "698007a0b9638d4c6f3b96fd691419a5",
"assets/assets/exercise/img/227813.gif": "ce57a79788c3770cd8f03aeb81b89e64",
"assets/assets/exercise/img/227913.gif": "379e123185c8f71ad5e00994996c58de",
"assets/assets/exercise/img/266513.gif": "28d858c6e82d12abe9a2eb7120f39953",
"assets/assets/exercise/img/328113.gif": "aac6d000a2497978d81a7b118113d69a",
"assets/assets/exercise/img/335113.gif": "668253b276453021f247592036a271eb",
"assets/assets/exercise/img/338513.gif": "768b493e112f3f0a5ee5881f3ab1a5e2",
"assets/assets/exercise/img/338613.gif": "94c3d02a0918bd4ee3c496d7264a530f",
"assets/assets/exercise/img/385913.gif": "c6742d1136ea9208905f637f67a3bf9b",
"assets/assets/exercise/img/386913.gif": "f00f279e88a85ec941772bba7269b201",
"assets/assets/exercise/img/391413.gif": "993783084c24133f61781de89b72a3ca",
"assets/assets/exercise/img/433613.gif": "08f5692c6fe5ba2e26007305420fd0a1",
"assets/assets/exercise/img/462013.gif": "16437419d59442d154e751974926c630",
"assets/assets/exercise/img/511813.gif": "6a936b3f0ccc540456e77cb6a4f3245c",
"assets/assets/exercise/img/581413.gif": "dc18e8b48c0c83775d994308f31b9a42",
"assets/assets/exercise/img/aerobic.png": "66a4d0de0af9cfe6767547fda3f39dac",
"assets/assets/exercise/img/anaerobic.png": "530999d85f28ed4528c04a056a2108e0",
"assets/assets/fonts/Pretendard-Black.ttf": "15c7d1db3ba3f775e8c48e40f2744c2b",
"assets/assets/fonts/Pretendard-Bold.ttf": "0e31c423b3971eecd79d2866b8ad65ac",
"assets/assets/fonts/Pretendard-ExtraBold.ttf": "2101fb53456d23d685a5172792599214",
"assets/assets/fonts/Pretendard-ExtraLight.ttf": "27cb5c5e9993269e199efb199e24b244",
"assets/assets/fonts/Pretendard-Light.ttf": "1a9b52d0674840d80e8a60dd1270114f",
"assets/assets/fonts/Pretendard-Medium.ttf": "6d045f83b15a4ce0108df8e96e53851e",
"assets/assets/fonts/Pretendard-Regular.ttf": "f9574625d71019a3d7d8417e9ac35e7e",
"assets/assets/fonts/Pretendard-SemiBold.ttf": "52e17b18a3a47c23bcdd626a3d8f163c",
"assets/assets/fonts/Pretendard-Thin.ttf": "1d54880fd193ab9ef9364c48ff968d63",
"assets/FontManifest.json": "fc2ac3061e6e95ebc02b7994c706a9dd",
"assets/fonts/MaterialIcons-Regular.otf": "32fce58e2acb9c420eab0fe7b828b761",
"assets/NOTICES": "47af5c55dd963e2b535d11090a811bb9",
"assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "89ed8f4e49bcdfc0b5bfc9b24591e347",
"assets/shaders/ink_sparkle.frag": "f8b80e740d33eb157090be4e995febdf",
"canvaskit/canvaskit.js": "5caccb235fad20e9b72ea6da5a0094e6",
"canvaskit/canvaskit.wasm": "d9f69e0f428f695dc3d66b3a83a4aa8e",
"canvaskit/chromium/canvaskit.js": "ffb2bb6484d5689d91f393b60664d530",
"canvaskit/chromium/canvaskit.wasm": "393ec8fb05d94036734f8104fa550a67",
"canvaskit/skwasm.js": "95f16c6690f955a45b2317496983dbe9",
"canvaskit/skwasm.wasm": "d1fde2560be92c0b07ad9cf9acb10d05",
"canvaskit/skwasm.worker.js": "51253d3321b11ddb8d73fa8aa87d3b15",
"favicon.png": "5dcef449791fa27946b3d35ad8803796",
"flutter.js": "6b515e434cea20006b3ef1726d2c8894",
"icons/Icon-192.png": "ac9a721a12bbc803b44f645561ecb1e1",
"icons/Icon-512.png": "96e752610906ba2a93c65f8abe1645f1",
"icons/Icon-maskable-192.png": "c457ef57daa1d16f64b27b786ec2ea3c",
"icons/Icon-maskable-512.png": "301a7604d45b3e739efc881eb04896ea",
"index.html": "91d56791957901694f0781eebd25b5f8",
"/": "91d56791957901694f0781eebd25b5f8",
"main.dart.js": "ba08f8f7ed939e782fb3edf0b1dbb7b0",
"manifest.json": "bf6a441337b5b1f326302ff056f811dc",
"version.json": "3ce6e3b5846927c0af707ead9aeb98ca"};
// The application shell files that are downloaded before a service worker can
// start.
const CORE = ["main.dart.js",
"index.html",
"assets/AssetManifest.json",
"assets/FontManifest.json"];

// During install, the TEMP cache is populated with the application shell files.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  return event.waitUntil(
    caches.open(TEMP).then((cache) => {
      return cache.addAll(
        CORE.map((value) => new Request(value, {'cache': 'reload'})));
    })
  );
});
// During activate, the cache is populated with the temp files downloaded in
// install. If this service worker is upgrading from one with a saved
// MANIFEST, then use this to retain unchanged resource files.
self.addEventListener("activate", function(event) {
  return event.waitUntil(async function() {
    try {
      var contentCache = await caches.open(CACHE_NAME);
      var tempCache = await caches.open(TEMP);
      var manifestCache = await caches.open(MANIFEST);
      var manifest = await manifestCache.match('manifest');
      // When there is no prior manifest, clear the entire cache.
      if (!manifest) {
        await caches.delete(CACHE_NAME);
        contentCache = await caches.open(CACHE_NAME);
        for (var request of await tempCache.keys()) {
          var response = await tempCache.match(request);
          await contentCache.put(request, response);
        }
        await caches.delete(TEMP);
        // Save the manifest to make future upgrades efficient.
        await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
        // Claim client to enable caching on first launch
        self.clients.claim();
        return;
      }
      var oldManifest = await manifest.json();
      var origin = self.location.origin;
      for (var request of await contentCache.keys()) {
        var key = request.url.substring(origin.length + 1);
        if (key == "") {
          key = "/";
        }
        // If a resource from the old manifest is not in the new cache, or if
        // the MD5 sum has changed, delete it. Otherwise the resource is left
        // in the cache and can be reused by the new service worker.
        if (!RESOURCES[key] || RESOURCES[key] != oldManifest[key]) {
          await contentCache.delete(request);
        }
      }
      // Populate the cache with the app shell TEMP files, potentially overwriting
      // cache files preserved above.
      for (var request of await tempCache.keys()) {
        var response = await tempCache.match(request);
        await contentCache.put(request, response);
      }
      await caches.delete(TEMP);
      // Save the manifest to make future upgrades efficient.
      await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
      // Claim client to enable caching on first launch
      self.clients.claim();
      return;
    } catch (err) {
      // On an unhandled exception the state of the cache cannot be guaranteed.
      console.error('Failed to upgrade service worker: ' + err);
      await caches.delete(CACHE_NAME);
      await caches.delete(TEMP);
      await caches.delete(MANIFEST);
    }
  }());
});
// The fetch handler redirects requests for RESOURCE files to the service
// worker cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  var origin = self.location.origin;
  var key = event.request.url.substring(origin.length + 1);
  // Redirect URLs to the index.html
  if (key.indexOf('?v=') != -1) {
    key = key.split('?v=')[0];
  }
  if (event.request.url == origin || event.request.url.startsWith(origin + '/#') || key == '') {
    key = '/';
  }
  // If the URL is not the RESOURCE list then return to signal that the
  // browser should take over.
  if (!RESOURCES[key]) {
    return;
  }
  // If the URL is the index.html, perform an online-first request.
  if (key == '/') {
    return onlineFirst(event);
  }
  event.respondWith(caches.open(CACHE_NAME)
    .then((cache) =>  {
      return cache.match(event.request).then((response) => {
        // Either respond with the cached resource, or perform a fetch and
        // lazily populate the cache only if the resource was successfully fetched.
        return response || fetch(event.request).then((response) => {
          if (response && Boolean(response.ok)) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    })
  );
});
self.addEventListener('message', (event) => {
  // SkipWaiting can be used to immediately activate a waiting service worker.
  // This will also require a page refresh triggered by the main worker.
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'downloadOffline') {
    downloadOffline();
    return;
  }
});
// Download offline will check the RESOURCES for all files not in the cache
// and populate them.
async function downloadOffline() {
  var resources = [];
  var contentCache = await caches.open(CACHE_NAME);
  var currentContent = {};
  for (var request of await contentCache.keys()) {
    var key = request.url.substring(origin.length + 1);
    if (key == "") {
      key = "/";
    }
    currentContent[key] = true;
  }
  for (var resourceKey of Object.keys(RESOURCES)) {
    if (!currentContent[resourceKey]) {
      resources.push(resourceKey);
    }
  }
  return contentCache.addAll(resources);
}
// Attempt to download the resource online before falling back to
// the offline cache.
function onlineFirst(event) {
  return event.respondWith(
    fetch(event.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response != null) {
            return response;
          }
          throw error;
        });
      });
    })
  );
}
