window.addEventListener('DOMContentLoaded', async function () {
  const ysdk = await YaGames.init();
  const lang = ysdk.environment.i18n.lang;
  document.documentElement.lang = lang;
  document.getElementById('game').textContent = lang === 'en' ? 'Play' : 'Играть';
  ysdk.features.LoadingAPI.ready();
  window.YGDebugChecker.open();
});
