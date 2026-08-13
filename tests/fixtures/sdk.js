window.YaGames = {
  init: function () {
    const sdk = {
      environment: { i18n: { lang: 'en' } },
      features: {
        LoadingAPI: { ready: function () { window.__readyCalled = true; } },
        GameplayAPI: { start: function(){}, stop: function(){} }
      },
      adv: {
        showFullscreenAdv: function (cfg) { cfg?.callbacks?.onClose?.(); },
        showRewardedVideo: function (cfg) { cfg?.callbacks?.onRewarded?.(); cfg?.callbacks?.onClose?.(); }
      },
      leaderboards: {
        setScore: async function(){},
        getEntries: async function(){ return { entries: [] }; }
      }
    };
    window.ysdk = sdk;
    return Promise.resolve(sdk);
  }
};
