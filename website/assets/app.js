(function () {
  "use strict";

  var CONFIG = {
    GITHUB_REPOSITORY: "dm2123/maurya-software-technologies",
    VERSION: "1.0.1",
    APP_NAME: "Maurya Desktop"
  };

  var ASSETS = {
    windows: "Maurya-Desktop-Setup.exe",
    appimage: "Maurya-Desktop.AppImage",
    deb: "Maurya-Desktop.deb",
    rpm: "Maurya-Desktop.rpm",
    dmg: "Maurya-Desktop.dmg"
  };

  function repoReady() {
    return CONFIG.GITHUB_REPOSITORY && CONFIG.GITHUB_REPOSITORY.indexOf("YOUR_USERNAME") === -1;
  }

  function releaseUrl(fileName) {
    return "https://github.com/" + CONFIG.GITHUB_REPOSITORY + "/releases/latest/download/" + fileName;
  }

  function sourceUrl() {
    return "https://github.com/" + CONFIG.GITHUB_REPOSITORY;
  }

  function releasesUrl() {
    return "https://github.com/" + CONFIG.GITHUB_REPOSITORY + "/releases";
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function setTheme(mode) {
    var resolved = mode;
    if (mode === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    document.documentElement.setAttribute("data-theme", resolved);
    localStorage.setItem("mst-theme", mode);
    qsa("[data-theme-label]").forEach(function (el) {
      el.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    });
  }

  function initTheme() {
    var saved = localStorage.getItem("mst-theme") || "system";
    setTheme(saved);
    qsa("[data-theme-cycle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var order = ["system", "dark", "light"];
        var current = localStorage.getItem("mst-theme") || "system";
        var next = order[(order.indexOf(current) + 1) % order.length];
        setTheme(next);
      });
    });
  }

  function initNav() {
    var toggle = qs("[data-menu-toggle]");
    var links = qs("[data-nav-links]");
    if (toggle && links) {
      toggle.addEventListener("click", function () {
        var open = links.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    var page = document.body.getAttribute("data-page");
    qsa(".nav-links a[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav") === page) a.classList.add("active");
    });
  }

  function applyDownloadLinks() {
    var ready = repoReady();
    qsa("[data-download]").forEach(function (el) {
      var key = el.getAttribute("data-download");
      var file = ASSETS[key];
      if (!file) return;
      if (ready) {
        el.setAttribute("href", releaseUrl(file));
        el.classList.remove("is-disabled");
        el.removeAttribute("aria-disabled");
      } else {
        el.setAttribute("href", "#download-config");
        el.classList.add("is-disabled");
        el.setAttribute("aria-disabled", "true");
      }
    });
    qsa("[data-github-source]").forEach(function (el) {
      el.setAttribute("href", ready ? sourceUrl() : "#download-config");
    });
    qsa("[data-github-releases]").forEach(function (el) {
      el.setAttribute("href", ready ? releasesUrl() : "#download-config");
    });
    qsa("[data-repo-value]").forEach(function (el) {
      el.textContent = CONFIG.GITHUB_REPOSITORY;
    });
    qsa("[data-app-version]").forEach(function (el) {
      el.textContent = CONFIG.VERSION;
    });
    var banner = qs("[data-download-banner]");
    if (banner) {
      if (ready) {
        banner.className = "notice";
        banner.textContent = "Download buttons point to GitHub Releases for " + CONFIG.GITHUB_REPOSITORY + ".";
      } else {
        banner.className = "notice";
        banner.innerHTML = "Set <code>GITHUB_REPOSITORY</code> in <code>website/assets/app.js</code> to your GitHub repo (example: <code>your-user/maurya-software-technologies</code>). Until then, download buttons stay disabled so they never point to fake files.";
      }
    }
  }

  function initContactForm() {
    var form = qs("#contact-form");
    if (!form) return;
    var status = qs("#contact-status");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = qs("#name", form).value.trim();
      var email = qs("#email", form).value.trim();
      var subject = qs("#subject", form).value.trim();
      var message = qs("#message", form).value.trim();
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!name || !emailOk || !subject || message.length < 10) {
        status.className = "alert error";
        status.textContent = "Please enter a valid name, email, subject, and a message of at least 10 characters. Nothing was sent.";
        return;
      }
      var subjectLine = "Project inquiry: " + subject;
      var body = "Name: " + name + "\nEmail: " + email + "\n\n" + message;
      var mailto = "mailto:dm7178072@gmail.com?subject=" + encodeURIComponent(subjectLine) + "&body=" + encodeURIComponent(body);
      status.className = "notice";
      status.textContent = "Your email application is opening with your project inquiry. If it does not open, contact Dinesh on WhatsApp.";
      form.reset();
      window.location.href = mailto;
    });
  }

  function initProjectLinks() {
    qsa("[data-whatsapp-project]").forEach(function (link) {
      link.addEventListener("click", function () {
        var message = "Hello Dinesh, I want to discuss a software or automation project.";
        link.href = "https://wa.me/917808658872?text=" + encodeURIComponent(message);
      });
    });
  }

  function initYear() {
    qsa("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  initTheme();
  initNav();
  applyDownloadLinks();
  initContactForm();
  initProjectLinks();
  initYear();
})();
