/* Shared Admin sidebar behavior: fixed order, persistent active state, no delayed/reflowing menu. */
(() => {
  const routes = {
    manager: "manager-control.html",
    operator: "operator-control.html",
    support: "support-control.html"
  };

  const role = String(document.body?.dataset?.role || "").toLowerCase();
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();

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
  else if (page === "manage-channel.html") setActive("manage");
  else if (page === "index.html" || page === "") {
    const saved = (() => { try { return sessionStorage.getItem("yt_admin_view") || "dashboard"; } catch (_) { return "dashboard"; } })();
    setActive(saved.startsWith("cms-custom:") ? "cms" : saved);
  }

  // Navigation is initialized before the admin page is revealed, preventing any legacy/sidebar flash.
  const revealAdminPage = () => document.documentElement.classList.remove("yt-admin-boot");

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

  // The main Admin Dashboard already owns [data-view] navigation through
  // assets/js/admin-auth.js. Binding it here as well causes a capture-phase
  // conflict/reload loop and can briefly expose the legacy flow.
  // Role-control pages are separate documents, so only they need this bridge
  // back to the canonical Admin Dashboard.
  if (page !== "index.html" && page !== "") {
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
  }

  document.getElementById("ytPremiumSidebarToggle")?.addEventListener("click", () => {
    document.body.classList.toggle("yt-premium-sidebar-open");
  });

  // All sidebar state is set synchronously above before paint is allowed.
  revealAdminPage();
})();
