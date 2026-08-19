(function () {
  "use strict";

  function platformLabel(os) {
    if (os === "win32") return "Windows";
    if (os === "darwin") return "macOS";
    if (os === "linux") return "Linux";
    return os || "Unknown";
  }

  function applyTheme(mode) {
    var resolved = mode;
    if (mode === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    document.documentElement.setAttribute("data-theme", resolved);
    localStorage.setItem("mst-theme", mode);
  }

  function initNav() {
    var buttons = document.querySelectorAll(".nav-btn");
    function showView(id) {
      buttons.forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-view") === id);
      });
      document.querySelectorAll(".view").forEach(function (view) {
        view.classList.toggle("active", view.id === "view-" + id);
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        showView(btn.getAttribute("data-view"));
      });
    });

    document.querySelectorAll("[data-view-target]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showView(btn.getAttribute("data-view-target"));
      });
    });
  }

  function initExternalLinks() {
    document.querySelectorAll('a[href^="http:"], a[href^="https:"], a[href^="mailto:"]').forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        window.open(link.href, "_blank", "noopener,noreferrer");
      });
    });
  }

  function initTheme() {
    var select = document.getElementById("theme-select");
    var saved = localStorage.getItem("mst-theme") || "system";
    applyTheme(saved);
    if (select) {
      select.value = saved;
      select.addEventListener("change", function () {
        applyTheme(select.value);
      });
    }
  }

  function fill(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function initSystem() {
    var error = document.getElementById("sys-error");
    if (!window.maurya || typeof window.maurya.getSystemInfo !== "function") {
      if (error) error.hidden = false;
      fill("os-label", "Unavailable");
      fill("status-label", "Limited");
      return;
    }
    window.maurya.getSystemInfo().then(function (info) {
      var osName = platformLabel(info.os);
      fill("os-label", osName);
      fill("build-label", info.build);
      fill("status-label", info.status);
      fill("card-platform", osName);
      fill("card-version", info.appVersion);
      fill("card-arch", info.arch);
      fill("card-status", info.status);
      fill("info-os", osName);
      fill("info-arch", info.arch);
      fill("info-electron", info.electron);
      fill("info-node", info.node);
      fill("info-app", info.appVersion);
    }).catch(function () {
      if (error) error.hidden = false;
    });
  }

  initNav();
  initTheme();
  initSystem();
  initExternalLinks();
})();
