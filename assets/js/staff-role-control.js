/* Admin sidebar role-control routing. Existing button markup is intentionally untouched. */
(() => {
  const routes = { manager:'manager-control.html', operator:'operator-control.html', support:'support-control.html' };
  // Ordering is defined statically in style.css so there is no first-paint
  // jump. This file only handles the existing button routing.
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
