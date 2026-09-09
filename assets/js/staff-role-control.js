/* Shared Admin sidebar behavior: fixed order, persistent active state, no delayed/reflowing menu. */
(() => {
  const routes = {
    manager: "manager-control.html",
    operator: "operator-control.html",
    support: "support-control.html"
  };

  const role = String(document.body?.dataset?.role || "").toLowerCase();

  const setActive = (view) => {
    document.querySelectorAll(".yt-premium-nav-btn").forEach((b) => {
      const active = b.dataset.view === view || b.dataset.roleControl === view;
      b.classList.toggle("active", active);
      if (active) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
  };

  // Do not inject/reorder the sidebar after paint. The existing stylesheet owns
  // the fixed menu order so the sidebar never jumps/reflows for a few seconds.
  if (role && routes[role]) setActive(role);
  else {
    const path = String(location.pathname || "").toLowerCase();
    const file = path.split("/").pop();
    const view = file === "manage-channel.html" ? "manage" : (file === "index.html" ? (sessionStorage.getItem("yt_admin_view") || "dashboard") : "");
    if (view) setActive(view);
  }

  const goAdmin = (view) => {
    try { sessionStorage.setItem("yt_admin_view", view); } catch (_) {}
    location.href = "index.html";
  };

  document.querySelectorAll("[data-role-control]").forEach((button) => {
    if (button.dataset.sidebarRoleBound) return;
    button.dataset.sidebarRoleBound = "1";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = button.dataset.roleControl;
      if (routes[target]) location.href = routes[target];
    }, true);
  });

  document.querySelectorAll(".yt-premium-nav [data-view]").forEach((button) => {
    if (button.dataset.sidebarViewBound) return;
    button.dataset.sidebarViewBound = "1";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const view = button.dataset.view || "dashboard";
      goAdmin(view);
    }, true);
  });

  document.getElementById("ytPremiumSidebarToggle")?.addEventListener("click", () => {
    document.getElementById("ytPremiumSidebar")?.classList.toggle("open");
  });
})();
