/* Shared Admin-shell routing for role control pages. Sidebar layout and working flows stay unchanged. */
(() => {
  const routes = { manager: "manager-control.html", operator: "operator-control.html", support: "support-control.html" };
  const currentRole = String(document.body?.dataset?.role || "").toLowerCase();

  const setActive = (view) => {
    document.querySelectorAll(".yt-premium-nav-btn").forEach(b => {
      const active = (b.dataset.view === view) || (b.dataset.roleControl === view);
      b.classList.toggle("active", active);
      if (active) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
  };

  const goAdmin = (view) => {
    try { sessionStorage.setItem("yt_admin_view", view); } catch (_) {}
    location.href = "index.html";
  };

  const nav = document.querySelector(".yt-premium-nav");
  if (nav && !document.getElementById("yt-role-control-fixed-order")) {
    const s = document.createElement("style");
    s.id = "yt-role-control-fixed-order";
    s.textContent = ".yt-premium-nav{display:grid!important}.yt-premium-nav [data-view=\"dashboard\"]{order:0!important}.yt-premium-nav [data-view=\"control-suite\"]{order:1!important}.yt-premium-nav [data-role-control=\"manager\"]{order:2!important}.yt-premium-nav [data-role-control=\"operator\"]{order:3!important}.yt-premium-nav [data-role-control=\"support\"]{order:4!important}";
    document.head.appendChild(s);
  }

  // Role-control pages must highlight the page currently open.
  if (currentRole && routes[currentRole]) setActive(currentRole);

  document.querySelectorAll("[data-role-control]").forEach(b => {
    if (b.dataset.bound) return;
    b.dataset.bound = "1";
    b.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      const role = b.dataset.roleControl;
      if (routes[role]) {
        setActive(role);
        location.href = routes[role];
      }
    }, true);
  });

  document.querySelectorAll(".yt-premium-nav [data-view]").forEach(b => {
    if (b.dataset.boundView) return;
    b.dataset.boundView = "1";
    b.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      setActive(b.dataset.view || "dashboard");
      goAdmin(b.dataset.view || "dashboard");
    }, true);
  });

  document.getElementById("ytPremiumSidebarToggle")?.addEventListener("click", () => {
    document.getElementById("ytPremiumSidebar")?.classList.toggle("open");
  });
})();
