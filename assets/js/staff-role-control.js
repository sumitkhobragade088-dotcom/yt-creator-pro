/* Shared Admin sidebar behavior. Keeps role-page navigation isolated from
   the main Admin Dashboard controller and preserves the existing sidebar UI. */
(() => {
  const routes = {
    manager: "manager-control.html",
    operator: "operator-control.html",
    support: "support-control.html"
  };

  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const isDashboard = page === "index.html" || page === "";
  const role = String(document.body?.dataset?.role || "").toLowerCase();

  const readSavedView = () => {
    try {
      return sessionStorage.getItem("yt_admin_view") || "dashboard";
    } catch (_) {
      return "dashboard";
    }
  };

  const setActive = (view) => {
    const normalized = String(view || "dashboard").startsWith("cms-custom:") ? "cms" : String(view || "dashboard");
    document.querySelectorAll(".yt-premium-nav-btn").forEach((button) => {
      const active = button.dataset.view === normalized || button.dataset.roleControl === normalized;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  };

  // Role-control pages use their own fixed page identity. The main dashboard
  // keeps its existing session-based view controller.
  if (role && routes[role]) {
    setActive(role);
  } else if (page === "manage-channel.html") {
    setActive("manage");
  } else if (isDashboard) {
    setActive(readSavedView());
  }

  // Role buttons are navigation links on every Admin page. Use capture only
  // for these buttons so the dashboard's existing view controller remains
  // untouched for normal data-view buttons.
  document.querySelectorAll("[data-role-control]").forEach((button) => {
    if (button.dataset.sidebarRoleBound) return;
    button.dataset.sidebarRoleBound = "1";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const target = button.dataset.roleControl;
      if (routes[target]) location.href = routes[target];
    }, true);
  });

  // On secondary Admin pages, normal sidebar items return to the main
  // dashboard with the selected view persisted. On index.html, admin-auth.js
  // remains the sole controller for these buttons.
  if (!isDashboard) {
    document.querySelectorAll(".yt-premium-nav [data-view]").forEach((button) => {
      if (button.dataset.sidebarViewBound) return;
      button.dataset.sidebarViewBound = "1";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const view = button.dataset.view || "dashboard";
        try {
          sessionStorage.setItem("yt_admin_view", view);
        } catch (_) {}
        location.href = "index.html";
      }, true);
    });

    // admin-auth.js owns this on the main dashboard. Secondary Admin pages
    // need the same body class used by the existing CSS for mobile opening.
    const toggle = document.getElementById("ytPremiumSidebarToggle");
    if (toggle && !toggle.dataset.sidebarToggleBound) {
      toggle.dataset.sidebarToggleBound = "1";
      toggle.addEventListener("click", () => {
        document.body.classList.toggle("yt-premium-sidebar-open");
      });
    }
  }
})();
