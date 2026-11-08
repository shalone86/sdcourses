// "Game" template: each download card's big button points at the version
// for the visitor's computer (the a[data-os] links in the card). Phones and
// tablets get no big button: they play in the browser instead.
(function () {
  var ua = navigator.userAgent;
  var touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // iPad
  var os = /Android|iPhone|iPad|iPod|CrOS/.test(ua) || touchMac ? null
    : /Windows/.test(ua) ? 'windows'
    : /Macintosh|Mac OS X/.test(ua) ? 'mac'
    : /Raspbian|armv7l|aarch64/.test(ua) ? 'raspi'
    : /Linux/.test(ua) ? 'linux' : null;
  var names = {windows: 'Windows', mac: 'Mac', linux: 'Linux', raspi: 'Raspberry Pi'};
  var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';

  document.querySelectorAll('.game-dl').forEach(function (card) {
    var link = os && card.querySelector('.game-dl-all a[data-os="' + os + '"]');
    if (!link) return;
    var main = card.querySelector('.game-dl-main');
    if (!main) {
      main = document.createElement('a');
      main.className = 'game-dl-main';
      card.insertBefore(main, card.querySelector('.game-dl-all'));
    }
    main.href = link.href;
    main.setAttribute('download', '');
    main.innerHTML = icon + '<span>Download for ' + names[os] + '</span>';
    card.classList.add('is-ready');
  });
})();
