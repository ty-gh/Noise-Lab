// Service Worker for Noise Lab PWA
const CACHE_NAME = 'noise-lab-v1.0.3';
const STATIC_CACHE_NAME = 'noise-lab-static-v1.0.3';
const AUDIO_CACHE_NAME = 'noise-lab-audio-v1.0.3';

// キャッシュする静的リソース（必須ファイル）
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json',
  './images/logo.png',
  './app-icon.png'
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

  // 音声ファイルのリクエスト処理（相対パス対応）
  if (url.pathname.includes('/sounds/') || url.pathname.includes('sounds/')) {
    // 緊急時：音声ファイルを完全にService Workerから除外
    // この場合はブラウザが直接処理（コメントアウトを外すことで有効化）
    // return;
    
    // 音声ファイルは専用ハンドラで処理
    console.log(`[SW] Audio request detected, handling: ${event.request.url}`);
    event.respondWith(
      handleAudioRequest(event.request).catch(() => {
        // Service Worker処理が失敗した場合は、ブラウザに直接処理させる
        console.log(`[SW] Fallback to browser native fetch for: ${event.request.url}`);
        return fetch(event.request);
      })
    );
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
      // まず ./index.html を試し、なければ ./ を試す
      let fallbackResponse = await cache.match('./index.html');
      if (!fallbackResponse) {
        fallbackResponse = await cache.match('./');
      }
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }
    
    throw error;
  }
}

// 音声ファイルのリクエスト処理（Cache First戦略でオフライン対応強化）
async function handleAudioRequest(request) {
  try {
    // まずキャッシュから確認（オフライン対応優先）
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log(`[SW] Audio cache hit: ${request.url}`);
      return cachedResponse;
    }

    // キャッシュにない場合はネットワークから取得
    console.log(`[SW] Cache miss, fetching audio from network: ${request.url}`);
    const networkResponse = await fetch(request, { 
      cache: 'no-store',
      // オフライン時のタイムアウトを短く設定
      signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
    });
    
    if (networkResponse.ok) {
      console.log(`[SW] Audio fetch success: ${request.url}`);
      // 成功時はキャッシュに保存
      const audioCache = await caches.open(AUDIO_CACHE_NAME);
      audioCache.put(request, networkResponse.clone()).catch(err => {
        console.warn(`[SW] Failed to cache audio: ${request.url}`, err);
      });
      return networkResponse;
    }
    
    throw new Error(`Network response not ok: ${networkResponse.status}`);
  } catch (error) {
    console.log(`[SW] Network failed for audio: ${request.url}`, error.message);
    
    // ネットワーク失敗後に再度キャッシュを確認
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log(`[SW] Fallback to audio cache: ${request.url}`);
      return cachedResponse;
    }
    
    // 完全に失敗した場合のログ
    console.error(`[SW] Audio file completely unavailable: ${request.url}`);
    throw error;
  }
}

// 音声ファイルのプリキャッシュ（積極的キャッシング）
async function precacheAudioFiles() {
  try {
    const audioCache = await caches.open(AUDIO_CACHE_NAME);
    console.log(`[SW] Starting pre-cache for ${AUDIO_FILES.length} audio files...`);
    
    const results = await Promise.allSettled(
      AUDIO_FILES.map(async file => {
        try {
          // 既にキャッシュされているかチェック
          const cachedResponse = await audioCache.match(file);
          if (cachedResponse) {
            console.log(`[SW] Already cached: ${file}`);
            return { file, status: 'already-cached' };
          }

          // ネットワークから取得してキャッシュ
          const response = await fetch(file, { cache: 'no-store' });
          if (response.ok) {
            await audioCache.put(file, response);
            console.log(`[SW] Successfully pre-cached: ${file}`);
            return { file, status: 'cached' };
          } else {
            console.warn(`[SW] Failed to fetch for pre-cache: ${file} (${response.status})`);
            return { file, status: 'failed', error: `HTTP ${response.status}` };
          }
        } catch (err) {
          console.warn(`[SW] Pre-cache error for ${file}:`, err);
          return { file, status: 'failed', error: err.message };
        }
      })
    );

    // 結果をログ出力
    const successful = results.filter(r => r.value?.status === 'cached' || r.value?.status === 'already-cached').length;
    const failed = results.filter(r => r.value?.status === 'failed').length;
    
    console.log(`[SW] Pre-cache completed: ${successful} successful, ${failed} failed`);
    
    return { successful, failed, results };
  } catch (error) {
    console.error('[SW] Pre-caching audio files failed:', error);
    return { successful: 0, failed: AUDIO_FILES.length, error };
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