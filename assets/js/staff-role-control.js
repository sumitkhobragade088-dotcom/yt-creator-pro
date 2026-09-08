/* Admin sidebar role-control routing. Existing button markup is intentionally untouched. */
(() => {
  const routes = { manager:'manager-control.html', operator:'operator-control.html', support:'support-control.html' };
  const nav = document.querySelector('.yt-premium-nav');
  if (nav) {
    const styleId = 'yt-role-control-fixed-order';
    if (!document.getElementById(styleId)) {
      const s = document.createElement('style');
      s.id = styleId;
      s.textContent = `
        .yt-premium-nav{display:grid!important}
        .yt-premium-nav [data-view="dashboard"]{order:0!important}
        .yt-premium-nav [data-view="control-suite"]{order:1!important}
        .yt-premium-nav [data-role-control="manager"]{order:2!important}
        .yt-premium-nav [data-role-control="operator"]{order:3!important}
        .yt-premium-nav [data-role-control="support"]{order:4!important}
      `;
      document.head.appendChild(s);
    }
  }
  document.querySelectorAll('[data-role-control]').forEach(btn => {
    if (btn.dataset.roleControlBound === '1') return;
    btn.dataset.roleControlBound = '1';
    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const role = btn.dataset.roleControl;
      if (routes[role]) window.location.assign(routes[role]);
    }, true);
  });
})();
