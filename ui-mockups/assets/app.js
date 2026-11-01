(() => {
  "use strict";

  const NAV = [
    { id: "memory", label: "Memory Lane", href: "chronological-gallery.html", icon: "photo_library" },
    { id: "undated", label: "Date unavailable", href: "date-unavailable.html", icon: "event_busy", badge: "142" },
    { id: "other", label: "Other files", href: "other-files.html", icon: "folder_open" },
    { id: "health", label: "Library health", href: "library-health.html", icon: "health_and_safety", badge: "15" },
    { id: "replication", label: "Backup & replication", href: "replication.html", icon: "backup" },
    { id: "scan", label: "Scan & processing", href: "scan-processing-dashboard.html", icon: "radar", pulse: true, divider: true },
    { id: "settings", label: "Settings", href: "settings.html", icon: "settings" },
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const icon = (name, cls = "") => `<span class="icon ${cls}">${name}</span>`;

  const ML = (window.ML = {});

  ML.toast = (message, type = "info") => {
    let root = $(".toast-root");
    if (!root) {
      root = document.createElement("div");
      root.className = "toast-root";
      document.body.appendChild(root);
    }
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    const glyph = type === "success" ? "check_circle" : type === "warning" ? "warning" : "info";
    el.innerHTML = `${icon(glyph)}<span>${message}</span>`;
    root.appendChild(el);
    window.setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(4px)";
      el.style.transition = "opacity 160ms ease, transform 160ms ease";
      window.setTimeout(() => el.remove(), 220);
    }, 3200);
  };

  ML.openModal = (id) => {
    const el = document.querySelector(`[data-modal="${id}"]`);
    if (!el) return;
    el.classList.add("is-open");
    const focusable = el.querySelector("select, input, button, a");
    if (focusable) window.setTimeout(() => focusable.focus(), 40);
  };

  ML.closeModal = (el) => {
    if (typeof el === "string") {
      const found = document.querySelector(`[data-modal="${el}"]`);
      if (found) found.classList.remove("is-open");
      return;
    }
    if (el && el.classList) el.classList.remove("is-open");
  };

  ML.openDrawer = () => {
    const drawer = $("#drive-drawer");
    if (drawer) drawer.classList.add("is-open");
  };

  ML.closeDrawer = () => {
    const drawer = $("#drive-drawer");
    if (drawer) drawer.classList.remove("is-open");
  };

  const renderSidebar = (active) => {
    const host = $("#sidebar");
    if (!host) return;

    const scanStatus = document.body.getAttribute("data-scan-status") || "active";
    const runState =
      new URLSearchParams(window.location.search).get("run") ||
      document.body.getAttribute("data-run-state") ||
      "";
    const runActive = runState === "active" || runState === "running" || runState === "paused";
    const driveName = document.body.getAttribute("data-drive-name") || "WD My Passport 2TB (E:)";
    const driveState = document.body.getAttribute("data-drive-state") || "Connected · Read-only";
    const driveMeta = document.body.getAttribute("data-drive-meta") || "1.42 TB / 2.0 TB";
    const drivePercent = document.body.getAttribute("data-drive-percent") || "71%";
    const driveBar = document.body.getAttribute("data-drive-bar") || "71%";
    const items = NAV.map((item) => {
      const isActive = item.id === active;
      return `
        ${item.divider ? '<div class="nav-divider"></div><div class="nav-label">System</div>' : ""}
        <a class="nav-item${isActive ? " is-active" : ""}" href="${item.href}" ${isActive ? 'aria-current="page"' : ""} title="${item.label}">
          ${icon(item.icon)}
          <span>${item.label}</span>
          ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ""}
          ${item.pulse && scanStatus === "active" ? `<span class="nav-pulse" title="Background processing active"></span>` : ""}
          ${item.id === "replication" && runActive ? `<span class="nav-pulse ${runState === "paused" ? "nav-pulse--blue" : "nav-pulse--amber"}" title="Backup ${runState === "paused" ? "paused" : "running"}"></span>` : ""}
        </a>`;
    }).join("");

    host.outerHTML = `
      <aside class="sidebar">
        <div class="sidebar__brand">
          <div class="brand-mark">${icon("photo_library")}</div>
          <div class="brand-text">
            <div class="brand-name">Memory Lane</div>
            <div class="brand-sub">Local archive</div>
          </div>
        </div>
        <nav class="sidebar__nav" aria-label="Main navigation">
          <div class="nav-label">Library</div>
          ${items}
        </nav>
        <div class="sidebar__bottom">
          <button class="drive-card" type="button" data-open-drawer aria-label="Open drive details">
            <div class="drive-card__top">
              <div class="drive-card__icon">${icon("hard_drive")}</div>
              <div style="min-width:0">
                <div class="drive-card__name">${driveName}</div>
                <div class="drive-card__state">${driveState}</div>
              </div>
            </div>
            <div class="drive-card__meta"><span>${driveMeta}</span><span>${drivePercent}</span></div>
            <div class="drive-card__bar"><span style="width:${driveBar}"></span></div>
          </button>
          <div class="sidebar__footnote">Catalog v0.1 · no telemetry</div>
        </div>
      </aside>`;
  };

  const renderTopbar = (crumb, scanChip) => {
    const host = $("#topbar");
    if (!host) return;
    const parts = String(crumb || "Library").split("/").map((p) => p.trim()).filter(Boolean);
    const crumbs = parts
      .map((part, index) => {
        const last = index === parts.length - 1;
        return `${index > 0 ? icon("chevron_right") : ""}${last ? `<strong>${part}</strong>` : `<span>${part}</span>`}`;
      })
      .join("");

    const runState =
      new URLSearchParams(window.location.search).get("run") ||
      document.body.getAttribute("data-run-state") ||
      "";
    const runPaused = runState === "paused";
    const runActive = runState === "active" || runState === "running" || runPaused;
    const runLabel = document.body.getAttribute("data-run-label") || "8TB Archive (H:)";
    const runPercent = document.body.getAttribute("data-run-percent") || "42%";
    const runHref = runPaused ? "replication-run.html?run=paused" : "replication-run.html";
    const runChip = runActive
      ? `<a class="run-chip${runPaused ? " run-chip--paused" : ""}" href="${runHref}" title="Open backup progress">
          <span class="run-chip__dot"></span>
          <span>${runPaused ? "Backup paused" : "Backup running"}</span>
          <span class="run-chip__meta">${runPercent} · ${runLabel}</span>
        </a>`
      : "";

    host.outerHTML = `
      <header class="topbar">
        <div class="crumbs">${crumbs}</div>
        <div class="topbar__right">
          ${runChip}
          ${
            scanChip
              ? `<a class="scan-chip" href="scan-processing-dashboard.html" title="Open scan progress"><span class="dot"></span>Cataloging · 78%</a>`
              : ""
          }
          <span class="readonly-pill">${icon("lock")} Read-only</span>
        </div>
      </header>`;
  };

  const renderDriveDrawer = () => {
    if ($("#drive-drawer")) return;
    const driveTitle = document.body.getAttribute("data-drive-title") || "WD My Passport 2TB";
    const driveSubtitle = document.body.getAttribute("data-drive-subtitle") || "E: · Connected and verified";
    const driveLabel = document.body.getAttribute("data-drive-label") || "MY_PASSPORT";
    const driveSerial = document.body.getAttribute("data-drive-serial") || "WDBYFT0020BBK-0A · NTFS";
    const driveVolume = document.body.getAttribute("data-drive-volume") || "{a8f2-39c1-90be-e092}";
    const driveLetter = document.body.getAttribute("data-drive-letter") || "E:";
    const driveFs = document.body.getAttribute("data-drive-fs") || "NTFS 3.1";
    const driveStorage = document.body.getAttribute("data-drive-storage") || "1.42 TB indexed · 580 GB free";
    const drivePercent = document.body.getAttribute("data-drive-percent") || "71%";
    const driveBar = document.body.getAttribute("data-drive-bar") || "71%";
    const driveSchema = document.body.getAttribute("data-drive-schema") || "v0.1 · 97,902 records";
    const wrap = document.createElement("div");
    wrap.id = "drive-drawer";
    wrap.className = "drawer-backdrop";
    wrap.setAttribute("data-drawer", "drive");
    wrap.innerHTML = `
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drive-drawer-title">
        <div class="drawer__head">
          <div>
            <h2 id="drive-drawer-title">${driveTitle}</h2>
            <p>${driveSubtitle}</p>
          </div>
          <button class="btn btn--icon btn--ghost" type="button" data-drawer-close aria-label="Close drive details">${icon("close")}</button>
        </div>
        <div class="drawer__body">
          <div class="drawer-drive">
            <div class="drive-card__icon" style="width:38px;height:38px">${icon("hard_drive")}</div>
            <div style="min-width:0;flex:1">
              <div style="font-size:12px;font-weight:600">${driveLabel}</div>
              <div class="mono" style="color:var(--muted);margin-top:2px">${driveSerial}</div>
            </div>
            <span class="pill pill--green">${icon("check_circle")} Healthy</span>
          </div>

          <div class="drawer-section">
            <div class="drawer-section__label">Identity</div>
            <div class="kv"><span>Volume ID</span><span class="mono">${driveVolume}</span></div>
            <div class="kv"><span>Assigned letter</span><span>${driveLetter}</span></div>
            <div class="kv"><span>Filesystem</span><span>${driveFs}</span></div>
            <div class="kv"><span>Last seen</span><span>Today, 14:32</span></div>
          </div>

          <div class="drawer-section">
            <div class="drawer-section__label">Storage</div>
            <div class="progress-row"><span>${driveStorage}</span><span>${drivePercent}</span></div>
            <div class="progress"><span style="width:${driveBar}"></span></div>
          </div>

          <div class="drawer-section">
            <div class="drawer-section__label">Catalog</div>
            <div class="path-box">E:\\.memorylane\\catalog.db</div>
            <div class="kv"><span>Schema</span><span>${driveSchema}</span></div>
            <div class="kv"><span>Last scan</span><span>Today, 14:32</span></div>
            <div class="kv"><span>PC backup</span><span class="green">Today, 14:15</span></div>
          </div>

          <div class="callout callout--green">
            ${icon("verified_user")}
            <div>
              <div class="callout__title">Read-only archive</div>
              <div class="callout__body">Memory Lane can reveal or open original files, but never moves, renames, edits, or deletes them.</div>
            </div>
          </div>
        </div>
        <div class="drawer__foot">
          <a class="btn" href="drive-selection.html">${icon("swap_horiz")} Switch drive</a>
          <button class="btn btn--primary" type="button" data-toast="Prototype only — would open E:\\ in Windows Explorer." data-toast-type="info">${icon("folder_open")} Open in Explorer</button>
        </div>
      </aside>`;
    document.body.appendChild(wrap);
  };

  const bindGlobalActions = () => {
    document.addEventListener("click", (event) => {
      const openDrawer = event.target.closest("[data-open-drawer]");
      if (openDrawer) {
        event.preventDefault();
        ML.openDrawer();
        return;
      }

      const closeDrawer = event.target.closest("[data-drawer-close]");
      if (closeDrawer) {
        event.preventDefault();
        ML.closeDrawer();
        return;
      }

      const drawerBackdrop = event.target.closest("[data-drawer]");
      if (drawerBackdrop && event.target === drawerBackdrop) {
        ML.closeDrawer();
        return;
      }

      const openModal = event.target.closest("[data-modal-open]");
      if (openModal) {
        event.preventDefault();
        ML.openModal(openModal.getAttribute("data-modal-open"));
        return;
      }

      const closeModal = event.target.closest("[data-modal-close]");
      if (closeModal) {
        event.preventDefault();
        const backdrop = closeModal.closest(".modal-backdrop");
        if (backdrop) backdrop.classList.remove("is-open");
        return;
      }

      const backdrop = event.target.closest(".modal-backdrop");
      if (backdrop && event.target === backdrop) {
        backdrop.classList.remove("is-open");
        return;
      }

      const toastBtn = event.target.closest("[data-toast]");
      if (toastBtn) {
        event.preventDefault();
        ML.toast(toastBtn.getAttribute("data-toast"), toastBtn.getAttribute("data-toast-type") || "info");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      ML.closeDrawer();
      $$(".modal-backdrop.is-open").forEach((el) => el.classList.remove("is-open"));
    });
  };

  const initTabs = () => {
    $$("[data-tabs]").forEach((tabs) => {
      const group = tabs.closest("[data-tab-container]") || document;
      const buttons = $$("[data-tab]", tabs);
      const panels = $$("[data-panel]", group);
      const syncHash = tabs.hasAttribute("data-sync-hash");

      const activate = (id, updateHash) => {
        buttons.forEach((b) => {
          const on = b.getAttribute("data-tab") === id;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach((p) => p.classList.toggle("is-active", p.getAttribute("data-panel") === id));
        if (syncHash && updateHash) history.replaceState(null, "", `#${id}`);
      };

      buttons.forEach((button) => {
        button.addEventListener("click", () => activate(button.getAttribute("data-tab"), true));
      });

      const hash = location.hash.replace("#", "");
      const initial = hash && buttons.some((b) => b.getAttribute("data-tab") === hash) ? hash : buttons[0]?.getAttribute("data-tab");
      if (initial) activate(initial, false);

      window.addEventListener("hashchange", () => {
        const next = location.hash.replace("#", "");
        if (buttons.some((b) => b.getAttribute("data-tab") === next)) activate(next, false);
      });
    });
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  ML.openDateModal = ({ count = 1, defaultYear = 2024, defaultMonth = 8, onApply } = {}) => {
    let root = $("#modal-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "modal-root";
      document.body.appendChild(root);
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [];
    for (let y = currentYear; y >= 1900; y -= 1) years.push(y);

    const yearOptions = years
      .map((y) => `<option value="${y}" ${y === defaultYear ? "selected" : ""}>${y}</option>`)
      .join("");
    const monthOptions = monthNames
      .map((m, i) => `<option value="${i + 1}" ${i + 1 === defaultMonth ? "selected" : ""}>${String(i + 1).padStart(2, "0")} — ${m}</option>`)
      .join("");

    root.innerHTML = `
      <div class="modal-backdrop is-open" data-modal="date">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="date-modal-title">
          <div class="modal__head">
            <div>
              <h2 id="date-modal-title">Set catalog date</h2>
              <p>${count === 1 ? "Assign a date to this item." : `Assign one date to ${count} selected items.`} Only the catalog changes.</p>
            </div>
            <button class="btn btn--icon btn--ghost" type="button" data-modal-close aria-label="Close">${icon("close")}</button>
          </div>
          <div class="modal__body">
            <div class="field-row">
              <div class="field">
                <label for="date-year">Year</label>
                <select id="date-year">${yearOptions}</select>
              </div>
              <div class="field">
                <label for="date-month">Month</label>
                <select id="date-month">
                  <option value="">Not specified</option>
                  ${monthOptions}
                </select>
              </div>
            </div>
            <div class="result-preview">
              <div class="result-preview__label">Catalog value</div>
              <div class="result-preview__value" id="date-preview">August 2024</div>
              <div class="result-preview__hint" id="date-preview-hint">Year &amp; month precision</div>
            </div>
            <div class="callout">
              ${icon("info")}
              <div>
                <div class="callout__title">Catalog-only change</div>
                <div class="callout__body">Original EXIF and filesystem timestamps are never modified. The extracted date is preserved so this override can be audited.</div>
              </div>
            </div>
          </div>
          <div class="modal__foot">
            <button class="btn" type="button" data-modal-close>Cancel</button>
            <button class="btn btn--primary" type="button" id="date-apply">${icon("event_available")} Apply date</button>
          </div>
        </div>
      </div>`;

    const yearEl = $("#date-year", root);
    const monthEl = $("#date-month", root);
    const preview = $("#date-preview", root);
    const hint = $("#date-preview-hint", root);

    const update = () => {
      const year = yearEl.value;
      const month = monthEl.value;
      if (month) {
        preview.textContent = `${monthNames[Number(month) - 1]} ${year}`;
        hint.textContent = "Year & month precision";
      } else {
        preview.textContent = year;
        hint.textContent = "Year precision";
      }
    };

    yearEl.addEventListener("change", update);
    monthEl.addEventListener("change", update);
    update();

    $("#date-apply", root).addEventListener("click", () => {
      const year = Number(yearEl.value);
      const month = monthEl.value ? Number(monthEl.value) : null;
      const label = month ? `${monthNames[month - 1]} ${year}` : String(year);
      root.innerHTML = "";
      ML.toast(`${count === 1 ? "Item" : `${count} items`} dated ${label}. Catalog only; originals unchanged.`, "success");
      if (typeof onApply === "function") onApply({ year, month, label });
    });
  };

  const initShell = () => {
    const page = document.body.getAttribute("data-page") || "";
    if ($("#sidebar")) {
      renderSidebar(page);
      renderTopbar(document.body.getAttribute("data-crumb") || "Library", document.body.getAttribute("data-scan-chip") !== "off");
      renderDriveDrawer();
      if (new URLSearchParams(window.location.search).get("drawer") === "1") {
        window.setTimeout(() => ML.openDrawer(), 120);
      }
    }
    bindGlobalActions();
    initTabs();
  };

  ML.monthNames = monthNames;
  ML.icon = icon;
  ML.$ = $;
  ML.$$ = $$;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShell);
  } else {
    initShell();
  }
})();
