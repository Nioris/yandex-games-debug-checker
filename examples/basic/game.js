// Minimal integration sketch. On the real Yandex platform /sdk.js provides YaGames.
YaGames.init().then(function (ysdk) {
  const lang = ysdk.environment.i18n.lang;
  document.documentElement.lang = lang;

  // Load resources / render your menu here.
  // Call Game Ready when the user can actually interact with the game.
  ysdk.features.LoadingAPI.ready();
});
