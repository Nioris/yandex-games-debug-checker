/* Mock Yandex Games SDK for the GitHub Pages demo only.
 * It never runs in the production example unless this file is explicitly included.
 */
(function(){
  'use strict';
  if (typeof window === 'undefined' || window.YaGames) return;
  const params = new URLSearchParams(window.location.search || '');
  const requested = params.get('lang') || 'ru';
  const events = window.__mockYandexEvents = [];
  const record = (name) => events.push({name, time: performance.now()});
  const sdk = {
    environment: { i18n: { lang: requested } },
    features: {
      LoadingAPI: { ready(){ record('LoadingAPI.ready'); } },
      GameplayAPI: {
        start(){ record('GameplayAPI.start'); },
        stop(){ record('GameplayAPI.stop'); }
      }
    },
    on(){}, off(){},
    adv: {}
  };
  window.YaGames = {
    init(){ record('YaGames.init'); return Promise.resolve(sdk); }
  };
})();
