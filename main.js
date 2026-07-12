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
  const smallScreen = window.matchMedia("(max-width: 880px)").matches;

  function webglOK() {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) {
      return false;
    }
  }

  const wantFlat =
    reducedMotion || smallScreen || !webglOK() ||
    new URLSearchParams(location.search).get("flat") === "1";

  const loading = document.getElementById("loading");
  const scrollSpace = document.getElementById("scroll-space");
  const dossier = document.getElementById("dossier");
  const dossierBody = document.getElementById("dossier-body");
  const dossierClose = document.getElementById("dossier-close");
  const boardTooltip = document.getElementById("board-tooltip");
  const tipline = document.getElementById("tipline");

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

  dossierClose.addEventListener("click", closeDossier);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dossier.classList.contains("open")) {
      e.preventDefault();
      closeDossier();
      return;
    }

    if (e.key === "Tab" && dossier.classList.contains("open")) {
      const focusable = Array.from(
        dossier.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
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
  });

  /* ---------------- 3D mode ---------------- */

  function initBoard() {
    document.body.classList.add("mode-3d");

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

    Promise.all([Promise.all(imgPromises), Promise.all(fontPromises).catch(() => {})]).then(
      ([pairs]) => {
        const images = Object.fromEntries(pairs);
        const api = window.PMBoard.init({
          canvas: document.getElementById("board-canvas"),
          images,
          onHoverChange: updateBoardTooltip,
          onFocusChange(card) {
            if (card) openDossier(card);
          },
        });

        closeDossierExtra = () => api.unfocus();

        /* scroll → camera */
        const SPACE_VH = 7.2;
        scrollSpace.style.height = SPACE_VH * 100 + "vh";

        function onScroll() {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          const t = max > 0 ? window.scrollY / max : 0;
          api.setScrollT(t);
          /* tip line form appears near the bottom */
          tipline.classList.toggle("visible", t > 0.88);
          /* nav active state */
          updateNav(t);
        }
        window.addEventListener("scroll", onScroll, { passive: true });

        /* nav jumps */
        const TOP = 150 - 26, BOT = -160 + 22;
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

        onScroll();
        loading.classList.add("done");
        setTimeout(() => loading.remove(), 900);
      }
    );
  }

  /* ---------------- flat mode ---------------- */

  function initFlat() {
    document.body.classList.add("mode-flat");
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
    loading.classList.add("done");
    setTimeout(() => loading.remove(), 900);
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
      if (wantFlat) url.searchParams.delete("flat");
      else url.searchParams.set("flat", "1");
      location.href = url.toString();
    });
  });

  if (wantFlat) initFlat();
  else initBoard();
})();
