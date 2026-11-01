(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const toast = (message, type = "info") => window.ML?.toast(message, type);
  const runState = () =>
    new URLSearchParams(window.location.search).get("run") ||
    document.body.getAttribute("data-run-state") ||
    "";
  const runActive = () => ["active", "running", "paused"].includes(runState());
  const runPaused = () => runState() === "paused";
  const setText = (selector, value) => {
    $$(selector).forEach((element) => {
      element.textContent = value;
    });
  };

  const setDisabled = (element, disabled, reason) => {
    element.classList.toggle("is-disabled", disabled);
    element.setAttribute("aria-disabled", disabled ? "true" : "false");
    if ("disabled" in element) element.disabled = disabled;
    if (disabled && reason) element.setAttribute("title", reason);
    if (!disabled) element.removeAttribute("title");
  };

  const initRunState = () => {
    if (!runActive()) return;
    const paused = runPaused();

    $$("[data-run-banner]").forEach((banner) => {
      banner.hidden = false;
      const title = $("[data-run-banner-title]", banner);
      if (title) title.textContent = paused ? "Backup paused" : "Backup running";
      const note = $("[data-run-banner-note]", banner);
      if (note) {
        const activeNote =
          note.getAttribute("data-run-note-active") ||
          "Plan changes are locked until you pause.";
        const pausedNote =
          note.getAttribute("data-run-note-paused") ||
          "Plan editing is unlocked. Resume when you are ready.";
        note.textContent = paused ? pausedNote : activeNote;
      }
      $$("[data-run-pause]", banner).forEach((button) => {
        button.innerHTML = paused
          ? '<span class="icon">play_arrow</span> Resume backup'
          : '<span class="icon">pause</span> Pause backup';
        button.setAttribute(
          "data-toast",
          paused
            ? "Prototype only — the run would resume."
            : "Prototype only — the run would pause after the current file.",
        );
      });
    });

    $$("[data-run-progress]").forEach((element) => {
      element.hidden = false;
    });
    $$("[data-run-review]").forEach((element) => element.classList.remove("btn--primary"));
    $$("[data-run-plan-edit]").forEach((element) => {
      element.hidden = !paused;
    });
    $$("[data-run-active-note]").forEach((element) => {
      element.hidden = false;
    });
    $$("[data-run-lock]").forEach((element) => {
      const reason = paused
        ? element.getAttribute("data-run-lock-paused") ||
          "Finish or stop the active run before continuing."
        : element.getAttribute("data-run-lock-reason") ||
          "Pause the backup to change the plan.";
      setDisabled(element, true, reason);
    });
    $$("[data-run-unlock]").forEach((element) => {
      setDisabled(element, !paused, "Pause the backup to change the plan.");
    });
    $$("[data-run-lock-note]").forEach((element) => {
      element.hidden = paused;
    });

    if (paused) {
      const pill = $("[data-run-status-pill]");
      if (pill) {
        pill.className = "pill pill--amber";
        pill.innerHTML = '<span class="icon">pause</span> Paused';
      }
      const eyebrow = $("[data-run-eyebrow]");
      if (eyebrow) {
        eyebrow.innerHTML = 'Run paused <span class="pill pill--amber">Post-v0.1 preview</span>';
      }
      const pause = $("[data-pause-button]");
      if (pause) {
        pause.innerHTML = '<span class="icon">play_arrow</span> Resume backup';
        pause.setAttribute("data-toast", "Prototype only — the run would resume.");
      }
      setText("[data-run-speed]", "0 MB/s");
      setText("[data-run-speed-hint]", "Paused");
      setText("[data-run-eta]", "—");
      setText("[data-run-eta-hint]", "Resume to continue");
      setText("[data-run-order-summary]", "1 paused · 1 pending · 1 offline");
      setText("[data-run-active-label]", "paused");
      setText("[data-run-controls-desc]", "Resume when ready. Verified files stay.");
      setText("[data-run-heading]", "Backup paused");
      if ($("[data-run-status-pill]")) document.title = "Memory Lane — Backup paused";
    }

    const runQuery = paused ? "paused" : "active";
    $$("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || /^(https?:|mailto:)/.test(href)) return;
      if (!/^replication[^/]*\.html/.test(href)) return;
      if (/[?&]run=/.test(href)) return;
      const [base, hash] = href.split("#");
      const separator = base.includes("?") ? "&" : "?";
      link.setAttribute("href", `${base}${separator}run=${runQuery}${hash ? `#${hash}` : ""}`);
    });
  };

  const initAddDrawer = () => {
    const drawer = $("[data-add-drawer]");
    if (!drawer) return;

    let step = 1;
    const panels = $$("[data-add-panel]", drawer);
    const label = $("[data-add-step-label]", drawer);
    const back = $("[data-add-back]", drawer);
    const next = $("[data-add-next]", drawer);
    const submit = $("[data-add-submit]", drawer);

    const showStep = (value) => {
      step = value;
      panels.forEach((panel) => {
        panel.hidden = Number(panel.getAttribute("data-add-panel")) !== step;
      });
      if (label) label.textContent = String(step);
      if (back) back.hidden = step === 1;
      if (next) next.hidden = step === 2;
      if (submit) submit.hidden = step !== 2;
    };

    const open = () => {
      showStep(1);
      drawer.classList.add("is-open");
    };
    const close = () => drawer.classList.remove("is-open");

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-add-destination]")) {
        event.preventDefault();
        open();
        return;
      }
      if (event.target.closest("[data-add-close]")) {
        event.preventDefault();
        close();
        return;
      }
      if (event.target === drawer) {
        close();
      }
    });

    next?.addEventListener("click", () => showStep(2));
    back?.addEventListener("click", () => showStep(1));
    submit?.addEventListener("click", () => {
      close();
      toast(
        runActive()
          ? "Prototype only — Seagate 8TB (I:) would be queued for the next plan."
          : "Prototype only — Seagate 8TB (I:) would be added as a full-copy destination.",
        "success",
      );
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  };

  const initExecuteDrawer = () => {
    const drawer = $("[data-execute-drawer]");
    if (!drawer) return;

    const open = () => drawer.classList.add("is-open");
    const close = () => drawer.classList.remove("is-open");

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-execute-open]")) {
        event.preventDefault();
        if (runActive()) {
          toast("A backup is already active. Open the run screen instead.", "warning");
          return;
        }
        open();
        return;
      }
      if (event.target.closest("[data-execute-close]")) {
        event.preventDefault();
        close();
        return;
      }
      if (event.target === drawer) {
        close();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  };

  const initPromotionWizard = () => {
    const panels = $$("[data-promo-panel]");
    if (panels.length === 0) return;

    const steps = $$("[data-promo-step]");
    let current = 1;

    const show = (value) => {
      current = Math.max(1, Math.min(panels.length, value));
      panels.forEach((panel) => {
        panel.classList.toggle(
          "is-active",
          Number(panel.getAttribute("data-promo-panel")) === current,
        );
      });
      steps.forEach((step) => {
        const number = Number(step.getAttribute("data-promo-step"));
        step.classList.toggle("is-current", number === current);
        step.classList.toggle("is-done", number < current);
      });
    };

    steps.forEach((step) => {
      step.addEventListener("click", () => show(Number(step.getAttribute("data-promo-step"))));
    });

    $$("[data-promo-next]").forEach((button) => {
      button.addEventListener("click", () => {
        if (runActive()) {
          toast("Promotion is blocked while a backup is running or paused.", "warning");
          return;
        }
        show(current + 1);
      });
    });
    $$("[data-promo-back]").forEach((button) => {
      button.addEventListener("click", () => show(current - 1));
    });

    const confirm = $("[data-promotion-confirm]");
    const submit = $("[data-promotion-submit]");
    if (confirm && submit) {
      confirm.addEventListener("change", () => {
        submit.disabled = !confirm.checked || runActive();
      });
      submit.addEventListener("click", () => {
        if (runActive()) {
          toast("Promotion is blocked while a backup is running or paused.", "warning");
          return;
        }
        $("[data-promo-confirm-card]")?.setAttribute("hidden", "");
        $("[data-promo-confirm-actions]")?.setAttribute("hidden", "");
        const complete = $("[data-promotion-complete]");
        if (complete) complete.hidden = false;
        const heading = $(".page-head h1");
        if (heading) heading.textContent = "8TB Archive is now the source";
        const description = $(".page-head p");
        if (description) {
          description.textContent =
            "Promotion is complete. Rollback remains available until the first change on H:.";
        }
        const pagePill = $(".page-head__actions .pill");
        if (pagePill) {
          pagePill.className = "pill pill--green";
          pagePill.innerHTML = '<span class="icon">check_circle</span> Active source';
        }
        document.title = "Memory Lane — 8TB Archive is now the source";
        toast(
          "Prototype only — H: is now the active source. Rollback stays available until the first change.",
          "success",
        );
      });
    }

    const requested = new URLSearchParams(window.location.search).get("step");
    show(requested ? Number(requested) : 1);
  };

  const initDestinationPage = () => {
    const switcher = $("#destination-switcher");
    if (!switcher) return;

    const images = [
      "assets/images/chronological-gallery-02.jpg",
      "assets/images/chronological-gallery-03.jpg",
      "assets/images/chronological-gallery-04.jpg",
      "assets/images/chronological-gallery-05.jpg",
      "assets/images/chronological-gallery-06.jpg",
      "assets/images/chronological-gallery-07.jpg",
    ];

    const destinations = {
      a: {
        name: "Backup A (F:)",
        status: "Connected",
        statusClass: "pill--green",
        statusIcon: "check_circle",
        identity: "Confirmed",
        identityClass: "pill--green",
        identityIcon: "verified",
        volume: "{a8f2-39c1-90be-e092}",
        fs: "NTFS · 1 TB",
        root: "F:\\",
        adoptionRoot: "F:\\",
        goal: "Extend coverage · partial",
        layout: "Dedicated folder",
        reserve: "19 GB",
        last: "Today, 14:32",
        copyPath: "F:\\Memory Lane\\4TB Archive",
        verified: "800 GB",
        available: "161 GB",
        reserveHint: "reserve 19 GB",
        attention: "42",
        attentionHint: "3.2 GB · 35 extras",
        reviewCount: 42,
        reviewFilter: "only",
        range: "2005–2023",
        map: [1, 1, 2, 1, 2, 3, 4, 3, 2, 3, 4, 1, 2, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 4, 1],
        localMap: [1, 1, 2, 1, 2, 3, 4, 3, 2, 3, 4, 1, 2, 3, 2, 1, 3, 3, 4, 5, 4, 3, 2, 5, 2],
        indexPresent: "12,303",
        indexMissing: "3.0 TB",
        indexUpdated: "Today, 14:32",
        overlap: "12 GB on Backup B",
        localLibrary: "12,345 files · cache ready",
        health: "3 source-missing · 0 conflicts · 3 stale",
        localFiles: "12,345",
        onlySummary: "42 files · 3.2 GB",
        missingSummary: "3 files",
        onlyBreakdown: "35 extras · 5 previously · 2 ambiguous",
        promotion: false,
        onlyRows: [
          {
            thumb: images[0],
            name: "IMG_8821.HEIC",
            path: "F:\\Backup\\Phone\\IMG_8821.HEIC",
            date: "2024-06-18",
            size: "4.8 MB",
            badge: "Extra",
            badgeClass: "pill--amber",
          },
          {
            thumb: images[1],
            name: "receipt_2023_11.pdf",
            path: "F:\\Scans\\Receipts\\receipt_2023_11.pdf",
            date: "2023-11-04",
            size: "182 KB",
            badge: "Extra",
            badgeClass: "pill--amber",
          },
          {
            thumb: images[2],
            name: "DSC_1942.JPG",
            path: "F:\\Backup\\Family\\DSC_1942.JPG",
            date: "2019-07-12",
            size: "18.4 MB",
            badge: "Previously in source",
            badgeClass: "pill--blue",
          },
          {
            thumb: images[3],
            name: "IMG_0042.JPG",
            path: "F:\\Backup\\Unsorted\\IMG_0042.JPG",
            date: "2016-12-24",
            size: "3.2 MB",
            badge: "Ambiguous",
            badgeClass: "pill--amber",
          },
        ],
        missingRows: [
          {
            thumb: images[4],
            name: "DSC_1942.JPG",
            path: "E:\\Family\\2019\\DSC_1942.JPG",
            date: "Verified today",
            size: "18.4 MB",
          },
          {
            thumb: images[5],
            name: "SCAN_0088.TIFF",
            path: "E:\\Family_Scans\\1988\\SCAN_0088.TIFF",
            date: "Verified yesterday",
            size: "42.1 MB",
          },
          {
            thumb: images[0],
            name: "CLIP0019.AVI",
            path: "E:\\Camcorder\\2002\\CLIP0019.AVI",
            date: "Verified Oct 28",
            size: "128 MB",
          },
        ],
        history: [
          {
            name: "Coverage refresh",
            detail: "25,717 checked · 0 errors",
            date: "Today, 14:32",
            pill: "OK",
            pillClass: "pill--green",
          },
          {
            name: "Backup B reconnect",
            detail: "Run paused 4 min, then resumed",
            date: "Yesterday, 22:10",
            pill: "Resumed",
            pillClass: "pill--muted",
          },
          {
            name: "Initial adoption",
            detail: "800 GB verified · 42 extras found",
            date: "Oct 20",
            pill: "OK",
            pillClass: "pill--green",
          },
        ],
      },
      b: {
        name: "Backup B (G:)",
        status: "Offline · last seen 3 days ago",
        statusClass: "pill--amber",
        statusIcon: "usb_off",
        identity: "Confirmed",
        identityClass: "pill--green",
        identityIcon: "verified",
        volume: "{b7e1-42d8-11ac-7f20}",
        fs: "NTFS · 1 TB",
        root: "G:\\",
        adoptionRoot: "G:\\",
        goal: "Extend coverage · partial",
        layout: "Dedicated folder",
        reserve: "19 GB",
        last: "3 days ago",
        copyPath: "G:\\Memory Lane\\4TB Archive",
        verified: "700 GB",
        available: "261 GB",
        reserveHint: "last-known · reserve 19 GB",
        attention: "7",
        attentionHint: "0.4 GB · 7 extras",
        reviewCount: 7,
        reviewFilter: "only",
        range: "2008–2024 · last-known",
        map: [0, 1, 1, 2, 1, 2, 2, 3, 4, 3, 2, 3, 4, 2, 1, 2, 3, 2, 4, 5, 3, 2, 4, 5, 3],
        localMap: [0, 1, 1, 2, 1, 2, 2, 3, 4, 3, 2, 3, 4, 2, 1, 2, 4, 2, 4, 5, 3, 2, 5, 5, 4],
        indexPresent: "10,975",
        indexMissing: "3.1 TB",
        indexUpdated: "3 days ago",
        overlap: "12 GB on Backup A",
        localLibrary: "10,982 files · cache ready",
        health: "0 source-missing · 0 conflicts · 0 stale",
        localFiles: "10,982",
        onlySummary: "7 files · 0.4 GB",
        missingSummary: "0 files",
        onlyBreakdown: "7 extras · 0 previously · 0 ambiguous",
        promotion: false,
        onlyRows: [
          {
            thumb: images[4],
            name: "IMG_9901.HEIC",
            path: "G:\\Backup\\Phone\\IMG_9901.HEIC",
            date: "2024-01-12",
            size: "5.1 MB",
            badge: "Extra",
            badgeClass: "pill--amber",
          },
          {
            thumb: images[5],
            name: "scan_2022_05.pdf",
            path: "G:\\Scans\\2022\\scan_2022_05.pdf",
            date: "2022-05-09",
            size: "220 KB",
            badge: "Extra",
            badgeClass: "pill--amber",
          },
          {
            thumb: images[0],
            name: "DSC_7731.JPG",
            path: "G:\\Backup\\Travel\\DSC_7731.JPG",
            date: "2019-08-17",
            size: "6.4 MB",
            badge: "Extra",
            badgeClass: "pill--amber",
          },
          {
            thumb: images[1],
            name: "IMG_4410.JPG",
            path: "G:\\Backup\\Family\\IMG_4410.JPG",
            date: "2016-12-24",
            size: "2.8 MB",
            badge: "Extra",
            badgeClass: "pill--amber",
          },
        ],
        missingRows: [],
        history: [
          {
            name: "Coverage refresh",
            detail: "25,717 checked · 0 errors",
            date: "3 days ago",
            pill: "OK",
            pillClass: "pill--green",
          },
          {
            name: "Last disconnect",
            detail: "Drive went offline; pending range kept",
            date: "3 days ago",
            pill: "Waiting",
            pillClass: "pill--amber",
          },
          {
            name: "Initial adoption",
            detail: "700 GB verified · 7 extras found",
            date: "Oct 20",
            pill: "OK",
            pillClass: "pill--green",
          },
        ],
      },
      h: {
        name: "8TB Archive (H:)",
        status: "Connected · full copy in progress",
        statusClass: "pill--green",
        statusIcon: "check_circle",
        identity: "Confirmed",
        identityClass: "pill--green",
        identityIcon: "verified",
        volume: "{h9c4-77b2-40de-8a11}",
        fs: "NTFS · 8 TB",
        root: "H:\\",
        adoptionRoot: "H:\\",
        goal: "Full copy",
        layout: "Dedicated folder",
        reserve: "160 GB",
        last: "Today, 14:32",
        copyPath: "H:\\Memory Lane\\4TB Archive",
        verified: "1.6 TB",
        available: "5.44 TB",
        reserveHint: "reserve 160 GB · 3.24 TB free after",
        attention: "12",
        attentionHint: "1.4 GB · 12 extras",
        reviewCount: 12,
        reviewFilter: "only",
        range: "2000–2024 · in progress",
        map: [5, 5, 5, 5, 5, 5, 5, 4, 4, 3, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        localMap: [5, 5, 5, 5, 5, 5, 5, 4, 4, 3, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2],
        indexPresent: "10,800",
        indexMissing: "2.2 TB",
        indexUpdated: "Today, 14:32",
        overlap: "3.8 TB target · overlaps A+B by design",
        shortfall: "0",
        localLibrary: "25,729 files · cache ready",
        health: "0 source-missing · 0 conflicts · 0 stale",
        localFiles: "25,729",
        onlySummary: "12 files · 1.4 GB",
        missingSummary: "0 files",
        onlyBreakdown: "10 extras · 0 previously · 2 ambiguous",
        promotion: true,
        onlyRows: [
          {
            thumb: images[0],
            name: "IMG_8821.HEIC",
            path: "H:\\Memory Lane\\4TB Archive\\Backup\\Phone\\IMG_8821.HEIC",
            date: "2024-06-18",
            size: "4.8 MB",
            badge: "Extra",
            badgeClass: "pill--amber",
          },
          {
            thumb: images[1],
            name: "receipt_2023_11.pdf",
            path: "H:\\Memory Lane\\4TB Archive\\Scans\\Receipts\\receipt_2023_11.pdf",
            date: "2023-11-04",
            size: "182 KB",
            badge: "Extra",
            badgeClass: "pill--amber",
          },
          {
            thumb: images[2],
            name: "IMG_0042.JPG",
            path: "H:\\Memory Lane\\4TB Archive\\Backup\\Unsorted\\IMG_0042.JPG",
            date: "2016-12-24",
            size: "3.2 MB",
            badge: "Ambiguous",
            badgeClass: "pill--amber",
          },
        ],
        missingRows: [],
        history: [
          {
            name: "Full copy started",
            detail: "1.6 TB verified · 42% of 3.8 TB",
            date: "Today, 14:32",
            pill: "Running",
            pillClass: "pill--amber",
          },
          {
            name: "Extras found",
            detail: "12 destination-only files inside the copy root",
            date: "Today, 14:10",
            pill: "Review",
            pillClass: "pill--amber",
          },
          {
            name: "Destination added",
            detail: "8 TB · full copy · dedicated folder",
            date: "Yesterday, 18:04",
            pill: "OK",
            pillClass: "pill--green",
          },
        ],
      },
    };

    let mapScope = "backup";

    const esc = (value) =>
      String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

    const renderMap = (data) => {
      const map = $("[data-dest-map]");
      if (!map) return;
      const values = mapScope === "library" ? data.localMap : data.map;
      map.innerHTML = values
        .map(
          (value) =>
            `<span class="coverage-map__cell${value ? ` is-${value}` : ""}"></span>`,
        )
        .join("");
      setText(
        "[data-map-scope-note]",
        mapScope === "library" ? "All local files, including extras" : "Verified replicas only",
      );
    };

    const activateMapScope = (scope) => {
      mapScope = scope === "library" ? "library" : "backup";
      $$("[data-map-scope]").forEach((button) => {
        button.classList.toggle(
          "is-active",
          button.getAttribute("data-map-scope") === mapScope,
        );
      });
      const data = destinations[switcher.value] ?? destinations.a;
      renderMap(data);
    };

    const renderOnlyRows = (rows) => {
      const host = $("[data-dest-only-rows]");
      if (!host) return;
      host.innerHTML = rows
        .map(
          (row) => `
          <div class="file-row">
            <img class="file-thumb" src="${esc(row.thumb)}" alt="">
            <div class="file-name">${esc(row.name)}<span>${esc(row.path)}</span></div>
            <div class="file-meta">${esc(row.date)}<br>${esc(row.size)}</div>
            <div><span class="pill ${esc(row.badgeClass)}">${esc(row.badge)}</span></div>
            <div class="file-actions">
              <button class="btn btn--sm btn--ghost" type="button" data-toast="Prototype only — would reveal the file in Explorer."><span class="icon">folder_open</span></button>
              <button class="btn btn--sm btn--ghost" type="button" data-toast="Prototype only — would open the file with the default app."><span class="icon">open_in_new</span></button>
            </div>
          </div>`,
        )
        .join("");
    };

    const renderMissing = (data) => {
      const host = $("[data-dest-missing-content]");
      if (!host) return;
      if (data.missingRows.length === 0) {
        host.innerHTML = `
          <div class="empty-state">
            <span class="icon">check_circle</span>
            <h3>No source-missing replicas</h3>
            <p>Every file this drive verifies still has its source file on 4TB Archive.</p>
          </div>`;
        return;
      }
      host.innerHTML = `
        <div class="callout callout--amber" style="margin-bottom:12px">
          <span class="icon">visibility</span>
          <div>
            <div class="callout__title">Source missing; backup copy exists</div>
            <div class="callout__body">The source archive stays read-only. Restore is deferred; reveal or open the verified copy instead.</div>
          </div>
        </div>
        ${data.missingRows
          .map(
            (row) => `
          <div class="file-row">
            <img class="file-thumb" src="${esc(row.thumb)}" alt="">
            <div class="file-name">${esc(row.name)}<span>Source path: ${esc(row.path)}</span></div>
            <div class="file-meta">${esc(row.date)}<br>${esc(row.size)}</div>
            <div><span class="pill pill--green">Verified copy</span></div>
            <div class="file-actions">
              <button class="btn btn--sm btn--ghost" type="button" data-toast="Prototype only — would reveal the verified copy in Explorer."><span class="icon">folder_open</span></button>
              <button class="btn btn--sm btn--ghost" type="button" data-toast="Prototype only — would open the verified copy with the default app."><span class="icon">open_in_new</span></button>
            </div>
          </div>`,
          )
          .join("")}`;
    };

    const renderHistory = (rows) => {
      const host = $("[data-dest-history]");
      if (!host) return;
      host.innerHTML = rows
        .map(
          (row) => `
          <div class="mini-row" style="grid-template-columns:1fr 120px 120px">
            <span class="mini-row__name">${esc(row.name)}<span>${esc(row.detail)}</span></span>
            <span class="mini-row__meta">${esc(row.date)}</span>
            <span class="mini-row__action"><span class="pill ${esc(row.pillClass)}">${esc(row.pill)}</span></span>
          </div>`,
        )
        .join("");
    };

    const render = (key) => {
      const data = destinations[key] ?? destinations.a;
      setText("[data-dest-name]", data.name);
      setText("[data-dest-volume]", data.volume);
      setText("[data-dest-fs]", data.fs);
      setText("[data-dest-root]", data.root);
      setText("[data-dest-adoption-root]", data.adoptionRoot);
      setText("[data-dest-goal]", data.goal);
      setText("[data-dest-layout]", data.layout);
      setText("[data-dest-reserve]", data.reserve);
      setText("[data-dest-last]", data.last);
      setText("[data-dest-copy-path]", data.copyPath);
      setText("[data-dest-range]", data.range);
      setText("[data-dest-verified]", data.verified);
      setText("[data-dest-available]", data.available);
      setText("[data-dest-reserve-hint]", data.reserveHint);
      setText("[data-dest-attention]", data.attention);
      setText("[data-dest-attention-hint]", data.attentionHint);
      setText("[data-dest-index-present]", data.indexPresent);
      setText("[data-dest-index-missing]", data.indexMissing);
      setText("[data-dest-index-updated]", data.indexUpdated);
      setText("[data-dest-overlap]", data.overlap);
      setText("[data-dest-shortfall]", data.shortfall ?? "0");
      const fullCopyRow = $("[data-dest-fullcopy-row]");
      if (fullCopyRow) fullCopyRow.hidden = !data.promotion;
      setText("[data-dest-local-library]", data.localLibrary);
      setText("[data-dest-health]", data.health);
      setText("[data-dest-local-files]", data.localFiles);
      setText("[data-dest-only-summary]", data.onlySummary);
      setText("[data-dest-missing-summary]", data.missingSummary);
      setText("[data-dest-only-breakdown]", data.onlyBreakdown);
      setText("[data-dest-only-badge]", data.attention);
      setText("[data-dest-missing-badge]", String(data.missingRows.length));
      setText("[data-dest-file-count]", data.attention);

      const status = $("[data-dest-status]");
      if (status) {
        status.className = `pill ${data.statusClass}`;
        status.innerHTML = `<span class="icon">${data.statusIcon}</span> ${esc(data.status)}`;
      }

      const identity = $("[data-dest-identity]");
      if (identity) {
        identity.className = `pill ${data.identityClass}`;
        identity.innerHTML = `<span class="icon">${data.identityIcon}</span> ${esc(data.identity)}`;
      }

      const review = $("[data-dest-review]");
      if (review) {
        review.hidden = data.reviewCount === 0;
        review.textContent = `${data.reviewCount} only on this drive`;
        const runParam = runState();
        review.href = `replication-destination.html?dest=${key}${
          runParam ? `&run=${runParam}` : ""
        }#files-${data.reviewFilter}`;
      }

      const missingLink = $("[data-dest-missing-link]");
      if (missingLink) {
        const count = data.missingRows.length;
        missingLink.hidden = count === 0;
        missingLink.textContent = `${count} source missing`;
        const runParam = runState();
        missingLink.href = `replication-destination.html?dest=${key}${
          runParam ? `&run=${runParam}` : ""
        }#files-missing`;
      }

      const promotionRow = $("[data-dest-promotion-row]");
      if (promotionRow) {
        promotionRow.hidden = !data.promotion;
        if (data.promotion) {
          setText(
            "[data-dest-promotion-note]",
            `${data.name} is ${data.verified} verified of 3.8 TB. Promotion becomes available at 100%.`,
          );
        }
      }

      renderMap(data);
      renderOnlyRows(data.onlyRows);
      renderMissing(data);
      renderHistory(data.history);
      document.title = `Memory Lane — ${data.name}`;
      switcher.value = key;
    };

    const activateFilter = (filter) => {
      $$("[data-file-filter]").forEach((button) => {
        button.classList.toggle(
          "is-active",
          button.getAttribute("data-file-filter") === filter,
        );
      });
      $$("[data-file-panel]").forEach((panel) => {
        panel.hidden = panel.getAttribute("data-file-panel") !== filter;
      });
      history.replaceState(null, "", `#files-${filter}`);
    };

    switcher.addEventListener("change", () => {
      const key = ["a", "b", "h"].includes(switcher.value) ? switcher.value : "a";
      const params = new URLSearchParams(window.location.search);
      params.set("dest", key);
      history.replaceState(null, "", `?${params.toString()}${location.hash}`);
      render(key);
    });

    $$("[data-file-filter]").forEach((button) => {
      button.addEventListener("click", () =>
        activateFilter(button.getAttribute("data-file-filter")),
      );
    });

    $$("[data-map-scope]").forEach((button) => {
      button.addEventListener("click", () =>
        activateMapScope(button.getAttribute("data-map-scope")),
      );
    });

    const requestedParam = new URLSearchParams(window.location.search).get("dest");
    const requested = ["a", "b", "h"].includes(requestedParam) ? requestedParam : "a";
    render(requested);

    const hash = window.location.hash.replace("#", "");
    if (hash.startsWith("files-")) {
      const filter =
        hash === "files-only" ? "only" : hash === "files-missing" ? "missing" : "library";
      $('[data-tab="files"]')?.click();
      activateFilter(filter);
    }
  };

  const init = () => {
    initRunState();
    initAddDrawer();
    initExecuteDrawer();
    initPromotionWizard();
    initDestinationPage();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
