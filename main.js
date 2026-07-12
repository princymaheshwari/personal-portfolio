/* ============================================================
   CASE FILE Nº 2026-PM — DOM glue
   Decides 3D board vs flat file, maps scroll to the camera,
   drives the detail dossier panel, renders the flat fallback,
   and wires the tip-line (Formspree) form.
   ============================================================ */

(function () {
  "use strict";

  const D = window.CASE_DATA;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const query = new URLSearchParams(location.search);

  function webglOK() {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) {
      return false;
    }
  }

  const supports3D = webglOK() && !!window.THREE && !!window.PMBoard;
  const wantFlat = reducedMotion || !supports3D || query.get("flat") === "1";
  const compactViewport = window.matchMedia(
    "(max-width: 880px), (max-height: 500px) and (max-width: 1000px)"
  ).matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const coarseCompact = coarsePointer &&
    Math.min(window.innerWidth, window.innerHeight) <= 880;
  const mobile3D = !wantFlat && (compactViewport || coarseCompact);

  const loading = document.getElementById("loading");
  const scrollSpace = document.getElementById("scroll-space");
  const dossier = document.getElementById("dossier");
  const dossierBody = document.getElementById("dossier-body");
  const dossierClose = document.getElementById("dossier-close");
  const dossierPaper = dossier.querySelector(".dossier-paper");
  const boardTooltip = document.getElementById("board-tooltip");
  const boardHint = document.getElementById("board-hint");
  const tipline = document.getElementById("tipline");
  const tiplineClose = document.getElementById("tipline-close");
  let flatInitialized = false;

  function cardById(id) {
    return D.cards.find((c) => c.id === id);
  }

  /* ---------------- dossier panel ---------------- */

  let closeDossierExtra = null;
  let dossierReturnFocus = null;

  function hideBoardTooltip() {
    if (!boardTooltip) return;
    boardTooltip.classList.remove("visible");
    boardTooltip.setAttribute("aria-hidden", "true");
  }

  function updateBoardTooltip(card, point) {
    if (!boardTooltip || !card || !point || dossier.classList.contains("open")) {
      hideBoardTooltip();
      return;
    }

    const tooltipTitle = card.title || cardById(card.detailRef)?.title || card.caption || "CASE FILE";
    boardTooltip.textContent = `OPEN FILE · ${tooltipTitle}`;
    boardTooltip.classList.add("visible");
    boardTooltip.setAttribute("aria-hidden", "false");

    const margin = 12;
    const gap = 18;
    const width = boardTooltip.offsetWidth;
    const height = boardTooltip.offsetHeight;
    let left = point.x + gap;
    let top = point.y + gap;

    if (left + width > window.innerWidth - margin) left = point.x - width - gap;
    if (top + height > window.innerHeight - margin) top = point.y - height - gap;

    boardTooltip.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - width - margin))}px`;
    boardTooltip.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - height - margin))}px`;
  }

  function openDossier(card, returnFocus) {
    let src = card;
    if (card.detailRef) src = cardById(card.detailRef) || card;
    const det = src.detail;
    if (!det) return;
    hideBoardTooltip();
    dossierReturnFocus = returnFocus || (document.activeElement !== document.body ? document.activeElement : null);
    const linksHtml = (det.links || [])
      .map((l) => `<a class="stamp-btn" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`)
      .join("");
    dossierBody.innerHTML = `
      <p class="dossier-case">${D.meta.caseNo} · INTERNAL MEMO</p>
      <h2 id="dossier-heading">${det.heading}</h2>
      ${det.body.map((p) => `<p>${p}</p>`).join("")}
      ${linksHtml ? `<div class="dossier-links">${linksHtml}</div>` : ""}
    `;
    dossierPaper.scrollTop = 0;
    dossier.classList.add("open");
    dossier.setAttribute("aria-hidden", "false");
    document.body.classList.add("dossier-open");
    requestAnimationFrame(() => dossierClose.focus({ preventScroll: true }));
  }

  function closeDossier() {
    if (!dossier.classList.contains("open")) return;
    dossier.classList.remove("open");
    document.body.classList.remove("dossier-open");
    if (closeDossierExtra) closeDossierExtra();
    if (dossierReturnFocus && dossierReturnFocus.isConnected) {
      dossierReturnFocus.focus({ preventScroll: true });
    } else {
      dossierClose.blur();
    }
    dossier.setAttribute("aria-hidden", "true");
    dossierReturnFocus = null;
  }

  function trapFocus(container, e) {
    const focusable = Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  let tiplineReturnFocus = null;

  function openTipline(returnFocus) {
    tiplineReturnFocus = returnFocus || (document.activeElement !== document.body ? document.activeElement : null);
    tipline.classList.add("visible");
    tipline.setAttribute("aria-hidden", "false");
    tipline.setAttribute("role", "dialog");
    tipline.setAttribute("aria-modal", "true");
    tipline.setAttribute("aria-labelledby", "tipline-heading");
    document.body.classList.add("tipline-open");
    tipline.scrollTop = 0;
    requestAnimationFrame(() => tiplineClose.focus({ preventScroll: true }));
  }

  function closeTipline() {
    if (!tipline.classList.contains("visible") || !document.body.classList.contains("tipline-open")) return;
    tipline.classList.remove("visible");
    tipline.setAttribute("aria-hidden", "true");
    tipline.removeAttribute("role");
    tipline.removeAttribute("aria-modal");
    tipline.removeAttribute("aria-labelledby");
    document.body.classList.remove("tipline-open");
    if (tiplineReturnFocus && tiplineReturnFocus.isConnected) {
      tiplineReturnFocus.focus({ preventScroll: true });
    } else {
      tiplineClose.blur();
    }
    tiplineReturnFocus = null;
  }

  dossierClose.addEventListener("click", closeDossier);
  tiplineClose.addEventListener("click", closeTipline);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dossier.classList.contains("open")) {
      e.preventDefault();
      closeDossier();
      return;
    }

    if (e.key === "Escape" && document.body.classList.contains("tipline-open")) {
      e.preventDefault();
      closeTipline();
      return;
    }

    if (e.key === "Tab" && dossier.classList.contains("open")) {
      trapFocus(dossier, e);
    } else if (e.key === "Tab" && document.body.classList.contains("tipline-open")) {
      trapFocus(tipline, e);
    }
  });

  /* ---------------- 3D mode ---------------- */

  function finishLoading() {
    if (!loading || !loading.isConnected) return;
    loading.classList.add("done");
    setTimeout(() => {
      if (loading.isConnected) loading.remove();
    }, 900);
  }

  function setActiveRegion(regionId) {
    document.querySelectorAll(".case-tabs [data-region]").forEach((link) => {
      link.classList.toggle("active", link.dataset.region === regionId);
    });
  }

  function fallbackToFlat(error) {
    console.error("3D evidence board failed; opening text view instead.", error);
    closeDossierExtra = null;
    hideBoardTooltip();
    document.body.classList.remove("mode-3d", "mode-mobile-3d", "dossier-open", "tipline-open");
    tipline.classList.remove("visible");
    initFlat();
  }

  async function initBoard() {
    document.body.classList.add("mode-3d");
    if (mobile3D) document.body.classList.add("mode-mobile-3d");

    try {
      /* preload images + fonts, then build */
      const imgPaths = [...new Set(D.cards.filter((c) => c.img).map((c) => c.img))];
      const imgPromises = imgPaths.map(
        (p) =>
          new Promise((res) => {
            const im = new Image();
            im.onload = () => res([p, im]);
            im.onerror = () => res([p, null]);
            im.src = p;
          })
      );
      const fontPromises = [
        '18px "Special Elite"', '18px "Caveat"', '18px "Courier Prime"',
      ].map((f) => document.fonts.load(f));

      const [pairs] = await Promise.all([
        Promise.all(imgPromises),
        Promise.all(fontPromises).catch(() => []),
      ]);
      const images = Object.fromEntries(pairs);
      let pendingTiplineTrigger = null;
      const api = window.PMBoard.init({
        canvas: document.getElementById("board-canvas"),
        images,
        viewMode: mobile3D ? "mobile-overview" : "desktop-scroll",
        onHoverChange: mobile3D || coarsePointer ? null : updateBoardTooltip,
        onFocusChange(card) {
          if (!mobile3D && card) openDossier(card);
        },
        onFocusSettled(card) {
          if (mobile3D && card) openDossier(card);
        },
        onOverviewSettled(regionId) {
          if (mobile3D && regionId === "tipline" && pendingTiplineTrigger) {
            const trigger = pendingTiplineTrigger;
            pendingTiplineTrigger = null;
            openTipline(trigger);
          }
        },
      });

      closeDossierExtra = () => api.unfocus();

      if (mobile3D) {
        scrollSpace.style.height = "0";
        const caseTitle = document.querySelector(".case-title");
        caseTitle.setAttribute("aria-label", "Show complete evidence board");

        caseTitle.addEventListener("click", (e) => {
          e.preventDefault();
          pendingTiplineTrigger = null;
          closeDossier();
          closeTipline();
          setActiveRegion(null);
          api.showOverview();
        });

        document.querySelectorAll(".case-tabs [data-region]").forEach((link) => {
          link.addEventListener("click", (e) => {
            e.preventDefault();
            closeDossier();
            closeTipline();
            const regionId = link.dataset.region;
            setActiveRegion(regionId);
            if (regionId === "tipline") pendingTiplineTrigger = link;
            else pendingTiplineTrigger = null;
            api.showOverview(regionId);
          });
        });

        if (boardHint) {
          boardHint.setAttribute("aria-hidden", "false");
          requestAnimationFrame(() => boardHint.classList.add("active"));
          setTimeout(() => {
            boardHint.classList.remove("active");
            boardHint.setAttribute("aria-hidden", "true");
          }, 5200);
        }
      } else {
        /* scroll → camera */
        const SPACE_VH = 7.2;
        scrollSpace.style.height = SPACE_VH * 100 + "vh";

        const TOP = 150 - 26, BOT = -160 + 22;

        function updateNav(t) {
          const camY = TOP + (BOT - TOP) * t;
          let best = null, bd = 1e9;
          D.regions.forEach((r) => {
            const d = Math.abs(r.y - camY);
            if (d < bd) { bd = d; best = r.id; }
          });
          document.querySelectorAll("[data-region]").forEach((a) => {
            a.classList.toggle("active", a.dataset.region === best);
          });
        }

        function onScroll() {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          const t = max > 0 ? window.scrollY / max : 0;
          api.setScrollT(t);
          const showTipline = t > 0.88;
          tipline.classList.toggle("visible", showTipline);
          tipline.setAttribute("aria-hidden", String(!showTipline));
          updateNav(t);
        }
        window.addEventListener("scroll", onScroll, { passive: true });

        /* nav jumps */
        document.querySelectorAll("[data-region]").forEach((a) => {
          a.addEventListener("click", (e) => {
            e.preventDefault();
            closeDossier();
            const reg = D.regions.find((r) => r.id === a.dataset.region);
            const t = (reg.y - TOP) / (BOT - TOP);
            const max = document.documentElement.scrollHeight - window.innerHeight;
            window.scrollTo({ top: t * max, behavior: "smooth" });
          });
        });

        onScroll();
      }

      finishLoading();
    } catch (error) {
      fallbackToFlat(error);
    }
  }

  /* ---------------- flat mode ---------------- */

  function initFlat() {
    if (flatInitialized) {
      finishLoading();
      return;
    }
    flatInitialized = true;
    document.body.classList.remove("mode-3d", "mode-mobile-3d", "dossier-open", "tipline-open");
    document.body.classList.add("mode-flat");
    scrollSpace.style.height = "0";
    const root = document.getElementById("flat-root");

    const typeLabel = {
      report: "case report", index: "index card", lead: "new lead",
      photo: "exhibit", polaroid: "photo", banner: "", note: "note",
    };

    function threadInto(id) {
      return D.threads.filter((t) => t.to === id);
    }

    const trailCards = D.cards
      .filter((c) => c.region === "trail" && c.type !== "banner")
      .sort((a, b) => b.pos[1] - a.pos[1]); /* newest first; earliest ends up at the bottom */

    const evidence = D.cards.filter((c) => c.region === "evidence" && c.type === "photo");
    const profile = cardById("profile");
    const mo = cardById("mo-card");

    root.innerHTML = `
      <header class="flat-hero">
        <p class="flat-case">${D.meta.caseNo}</p>
        <h1>${D.meta.codename}</h1>
        <p class="flat-subject">SUBJECT: ${D.meta.subjectName}</p>
        <p class="flat-role">${D.meta.role}</p>
      </header>

      <section class="flat-section" id="flat-subject">
        <h2 class="flat-h2">SUBJECT PROFILE</h2>
        ${profile.detail.body.map((p) => `<p class="flat-p">${p}</p>`).join("")}
        <div class="flat-links">
          ${profile.detail.links.map((l) => `<a class="stamp-btn" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join("")}
        </div>
      </section>

      <section class="flat-section" id="flat-trail">
        <h2 class="flat-h2">THE TRAIL</h2>
        <p class="flat-p flat-note">Read bottom-up — the earliest experience sits at the floor of the board. Red tags name the skill each experience passed forward.</p>
        <ol class="flat-trail">
          ${trailCards
            .map((c) => {
              const inbound = threadInto(c.id);
              const tags = inbound
                .map((t) => `<span class="flat-tag">↑ carried in from <b>${cardById(t.from).title}</b>: ${t.label}</span>`)
                .join("");
              return `<li class="flat-card" data-card="${c.id}">
                <p class="flat-date">${c.date || ""}</p>
                <h3>${c.title}</h3>
                <p class="flat-p">${(c.lines || []).join(" ")}</p>
                ${tags}
                <button class="flat-more" data-open="${c.id}" aria-haspopup="dialog" aria-label="Read the file for ${c.title}">read the file →</button>
              </li>`;
            })
            .join("")}
        </ol>
      </section>

      <section class="flat-section" id="flat-evidence">
        <h2 class="flat-h2">EVIDENCE LOCKER</h2>
        <div class="flat-evidence">
          ${evidence
            .map(
              (c) => `<figure class="flat-exhibit" data-open="${c.id}" role="button" tabindex="0" aria-haspopup="dialog" aria-label="Open ${c.tag}: ${c.caption}">
                <img src="${c.img}" alt="${c.caption}" loading="lazy" />
                <figcaption><span class="flat-extag">${c.tag}</span> ${c.caption}</figcaption>
              </figure>`
            )
            .join("")}
        </div>
      </section>

      <section class="flat-section" id="flat-mo">
        <h2 class="flat-h2">MODUS OPERANDI</h2>
        <pre class="flat-mo">${mo.lines.join("\n")}</pre>
      </section>
    `;

    function activateFlatFile(el) {
        const c = cardById(el.dataset.open);
        if (c) openDossier(c, el);
    }

    root.querySelectorAll("[data-open]").forEach((el) => {
      el.addEventListener("click", () => activateFlatFile(el));
      if (el.getAttribute("role") === "button" && el.tagName !== "BUTTON") {
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activateFlatFile(el);
          }
        });
      }
    });

    hideBoardTooltip();
    tipline.classList.add("visible");
    tipline.setAttribute("aria-hidden", "false");
    tipline.removeAttribute("role");
    tipline.removeAttribute("aria-modal");
    tipline.removeAttribute("aria-labelledby");
    finishLoading();
  }

  /* ---------------- tip line form ---------------- */

  const form = document.getElementById("contactForm");
  if (form) {
    const submitBtn = document.getElementById("submitBtn");
    const submitText = document.getElementById("submitText");
    const submitLoading = document.getElementById("submitLoading");
    const formMessage = document.getElementById("formMessage");

    function showMessage(text, type) {
      formMessage.textContent = text;
      formMessage.className = `form-message ${type}`;
      setTimeout(() => formMessage.classList.add("hidden"), 8000);
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      const msg = document.getElementById("message").value.trim();
      if (msg.replace(/\s+/g, " ").length < 10 || msg.split(/\s+/).length < 3) {
        showMessage("A useful tip needs at least a few words, detective.", "error");
        return;
      }

      submitBtn.disabled = true;
      submitText.classList.add("hidden");
      submitLoading.classList.remove("hidden");

      const fd = new FormData(form);
      const data = {
        firstName: fd.get("firstName"),
        lastName: fd.get("lastName"),
        email: fd.get("email"),
        subject: fd.get("subject"),
        message: fd.get("message"),
      };

      try {
        const res = await fetch("https://formspree.io/f/mykobeky", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("send failed");
        showMessage("Tip received. The subject will be in touch within 48 hours.", "success");
        form.reset();
      } catch (err) {
        console.error(err);
        showMessage("The tip line is down. Please try again in a few minutes.", "error");
      } finally {
        submitBtn.disabled = false;
        submitText.classList.remove("hidden");
        submitLoading.classList.add("hidden");
      }
    });
  }

  /* mode switch links */
  document.querySelectorAll(".mode-switch").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const url = new URL(location.href);
      if (document.body.classList.contains("mode-flat")) url.searchParams.delete("flat");
      else url.searchParams.set("flat", "1");
      location.href = url.toString();
    });
  });

  if (wantFlat) initFlat();
  else initBoard();
})();
