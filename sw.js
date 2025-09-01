// Service Worker for Noise Lab PWA
const CACHE_NAME = 'noise-lab-v1.0.0';
const STATIC_CACHE_NAME = 'noise-lab-static-v1.0.0';
const AUDIO_CACHE_NAME = 'noise-lab-audio-v1.0.0';

// キャッシュする静的リソース（必須ファイル）
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json',
  './images/logo.png'
];

// 音声ファイル（大容量のため別キャッシュ）
const AUDIO_FILES = [
  './sounds/voice.mp3',
  './sounds/tv.mp3',
  './sounds/construction.mp3',
  './sounds/laundry.mp3',
  './sounds/rain.mp3',
  './sounds/traffic.mp3'
];

// アイコンファイル
const ICON_FILES = [
  './images/voice.png',
  './images/tv.png',
  './images/construction.png',
  './images/laundry.png',
  './images/rain.png',
  './images/traffic.png'
];

// インストール時の処理
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    Promise.all([
      // 静的ファイルのキャッシュ
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      }),
      
      // アイコンファイルのキャッシュ（エラーを無視）
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('[SW] Caching icon files');
        return Promise.allSettled(
          ICON_FILES.map(url => cache.add(url).catch(err => {
            console.warn(`[SW] Failed to cache icon: ${url}`, err);
          }))
        );
      })
    ]).then(() => {
      console.log('[SW] Installation completed');
      // 新しいService Workerをすぐに有効化
      return self.skipWaiting();
    })
  );
});

// アクティベート時の処理（古いキャッシュの削除）
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 古いバージョンのキャッシュを削除
          if (cacheName !== STATIC_CACHE_NAME && 
              cacheName !== AUDIO_CACHE_NAME &&
              cacheName.startsWith('noise-lab-')) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation completed');
      // 既存のクライアントも即座に制御下に置く
      return self.clients.claim();
    })
  );
});

// リクエストの処理（フェッチイベント）
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // 同一オリジンのリクエストのみ処理
  if (url.origin !== location.origin) {
    return;
  }

  // 音声ファイルのリクエスト処理
  if (url.pathname.startsWith('/sounds/')) {
    event.respondWith(handleAudioRequest(event.request));
    return;
  }

  // 静的ファイルのリクエスト処理
  event.respondWith(handleStaticRequest(event.request));
});

// 静的ファイルのリクエスト処理（Cache First戦略）
async function handleStaticRequest(request) {
  try {
    // まずキャッシュから探す
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log(`[SW] Cache hit: ${request.url}`);
      return cachedResponse;
    }

    // キャッシュになければネットワークから取得
    console.log(`[SW] Cache miss, fetching: ${request.url}`);
    const networkResponse = await fetch(request);
    
    // レスポンスが正常ならキャッシュに保存
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error(`[SW] Failed to fetch: ${request.url}`, error);
    
    // オフライン時のフォールバック
    if (request.url.includes('index.html') || request.url.endsWith('/')) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      return cache.match('./index.html');
    }
    
    throw error;
  }
}

// 音声ファイルのリクエスト処理（Network First戦略）
async function handleAudioRequest(request) {
  try {
    // まずネットワークから取得を試みる（最新の音声ファイル）
    console.log(`[SW] Fetching audio: ${request.url}`);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // 音声キャッシュに保存
      const audioCache = await caches.open(AUDIO_CACHE_NAME);
      audioCache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error(`Network response not ok: ${networkResponse.status}`);
  } catch (error) {
    console.log(`[SW] Network failed, trying cache: ${request.url}`);
    
    // ネットワークが失敗した場合はキャッシュから取得
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log(`[SW] Audio cache hit: ${request.url}`);
      return cachedResponse;
    }
    
    console.error(`[SW] Audio file not available: ${request.url}`, error);
    throw error;
  }
}

// 音声ファイルのプリキャッシュ（オプション）
async function precacheAudioFiles() {
  try {
    const audioCache = await caches.open(AUDIO_CACHE_NAME);
    const cachedUrls = await audioCache.keys();
    const cachedUrlStrings = cachedUrls.map(req => req.url);
    
    const filesToCache = AUDIO_FILES.filter(file => {
      const fullUrl = new URL(file, location.origin).href;
      return !cachedUrlStrings.includes(fullUrl);
    });
    
    if (filesToCache.length > 0) {
      console.log(`[SW] Pre-caching ${filesToCache.length} audio files...`);
      await Promise.allSettled(
        filesToCache.map(async file => {
          try {
            const response = await fetch(file);
            if (response.ok) {
              await audioCache.put(file, response);
              console.log(`[SW] Pre-cached audio: ${file}`);
            }
          } catch (err) {
            console.warn(`[SW] Failed to pre-cache audio: ${file}`, err);
          }
        })
      );
    }
  } catch (error) {
    console.error('[SW] Pre-caching audio files failed:', error);
  }
}

// メッセージイベント（クライアントからのメッセージ処理）
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'PRECACHE_AUDIO') {
    // 音声ファイルのプリキャッシュ要求
    precacheAudioFiles().then(() => {
      event.ports[0].postMessage({ success: true });
    }).catch(error => {
      console.error('[SW] Pre-cache failed:', error);
      event.ports[0].postMessage({ success: false, error: error.message });
    });
  }
});

// エラーハンドリング
self.addEventListener('error', event => {
  console.error('[SW] Error:', event.error);
});

console.log('[SW] Service Worker loaded');