/* ============================================================
   CASE FILE Nº 2026-PM — 3D evidence board engine (Three.js r128)
   A corkboard wall in a dark pine-green office. Page scroll
   drives the camera down the wall; a warm lamp follows like a
   flashlight. Cards are canvas-textured paper; threads are
   sagging red tubes tied pin to pin.
   ============================================================ */

window.PMBoard = (function () {
  "use strict";

  const D = window.CASE_DATA;

  /* palette */
  const COL = {
    wall: 0x152119,
    fog: 0x10190f,
    corkA: "#8a6a44",
    corkB: "#a58156",
    corkC: "#77542f",
    frame: 0x4a3220,
    paper: "#f0e7d3",
    paperOld: "#e7dabb",
    ink: "#2b2620",
    inkFaint: "#4b443a",
    red: "#7e1f24",
    blueRule: "#9db4c0",
    kraft: "#b18e5f",
    thread: 0x5f1418,
    pin: 0x7e1f24,
  };

  let BOARD_W = 132;
  let BOARD_TOP = 150;
  let BOARD_BOT = -160;
  const CARD_Z = 1.1;
  let mobileLayout = false; // "mobile-scroll": single-column board, close camera
  let baseZ = 62;           // camera resting distance for the current layout

  let renderer, scene, camera, lamp, lampTarget;
  let cardMeshes = [];
  let flutterers = [];
  let cardGroups = new Map();
  let dust;
  let raycaster, pointer;
  let hovered = null;
  let focus = null; // desktop dossier focus
  let guided = null; // {grp, settled}
  let camY = { cur: BOARD_TOP - 24, target: BOARD_TOP - 24 };
  let camX = { cur: 0, target: 0 };
  let camZ = { cur: 120, target: 62 };
  let lookY = { cur: BOARD_TOP - 24 };
  let clock;
  let viewMode = "desktop-scroll";
  let pointerDown = null;
  let onFocusChange = null;
  let onHoverChange = null;
  let onCardChange = null;
  let onCardSettled = null;
  let onCardActivate = null;
  let onStepRequest = null;
  let getViewportInsets = null;

  /* ---------------- texture helpers ---------------- */

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function tex(c, repeat) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    const maxAnisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
    t.anisotropy = Math.min(viewMode === "desktop-scroll" ? 4 : 8, maxAnisotropy);
    if (viewMode === "mobile-guided" && !repeat) {
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
    }
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    return t;
  }

  function corkTexture() {
    const c = makeCanvas(512, 512);
    const x = c.getContext("2d");
    x.fillStyle = COL.corkA;
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      const r = 1 + Math.random() * 5;
      x.fillStyle = Math.random() < 0.5 ? COL.corkB : COL.corkC;
      x.globalAlpha = 0.1 + Math.random() * 0.25;
      x.beginPath();
      x.ellipse(
        Math.random() * 512, Math.random() * 512,
        r, r * (0.5 + Math.random() * 0.8),
        Math.random() * Math.PI, 0, Math.PI * 2
      );
      x.fill();
    }
    x.globalAlpha = 1;
    return tex(c, [6, 12]);
  }

  function wallTexture() {
    const c = makeCanvas(256, 256);
    const x = c.getContext("2d");
    x.fillStyle = "#152119";
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      x.fillStyle = Math.random() < 0.5 ? "#182620" : "#111c15";
      x.globalAlpha = 0.25;
      x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    x.globalAlpha = 1;
    return tex(c, [8, 8]);
  }

  /* paper base with fibers, edge shading, subtle stains */
  function paperBase(x, W, H, old) {
    x.fillStyle = old ? COL.paperOld : COL.paper;
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H * 0.004; i++) {
      x.fillStyle = Math.random() < 0.5 ? "#d9cdb2" : "#fbf5e6";
      x.globalAlpha = 0.3;
      x.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }
    x.globalAlpha = 1;
    /* coffee-ish stains */
    for (let i = 0; i < 2; i++) {
      const sx = Math.random() * W, sy = Math.random() * H, r = 20 + Math.random() * 50;
      const g = x.createRadialGradient(sx, sy, r * 0.4, sx, sy, r);
      g.addColorStop(0, "rgba(150,110,60,0)");
      g.addColorStop(0.85, "rgba(150,110,60,0.06)");
      g.addColorStop(1, "rgba(150,110,60,0)");
      x.fillStyle = g;
      x.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    /* edge darkening */
    const eg = x.createLinearGradient(0, 0, 0, H);
    eg.addColorStop(0, "rgba(90,70,40,0.10)");
    eg.addColorStop(0.08, "rgba(90,70,40,0)");
    eg.addColorStop(0.92, "rgba(90,70,40,0)");
    eg.addColorStop(1, "rgba(90,70,40,0.14)");
    x.fillStyle = eg;
    x.fillRect(0, 0, W, H);
  }

  function stamp(x, text, cx, cy, ang, size, color) {
    x.save();
    x.translate(cx, cy);
    x.rotate(ang);
    x.globalAlpha = 0.75;
    x.strokeStyle = color || COL.red;
    x.fillStyle = color || COL.red;
    x.lineWidth = size * 0.09;
    x.font = `${size}px "Special Elite", monospace`;
    const w = x.measureText(text).width;
    x.strokeRect(-w / 2 - size * 0.45, -size * 0.85, w + size * 0.9, size * 1.45);
    x.fillText(text, -w / 2, size * 0.28);
    /* grunge holes */
    x.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 26; i++) {
      x.globalAlpha = 0.5;
      x.beginPath();
      x.arc((Math.random() - 0.5) * (w + size), (Math.random() - 0.5) * size * 1.6, Math.random() * 2.2, 0, 7);
      x.fill();
    }
    x.restore();
  }

  function tapeStrip(x, cx, cy, ang, len) {
    x.save();
    x.translate(cx, cy);
    x.rotate(ang);
    x.globalAlpha = 0.5;
    x.fillStyle = "#e8d9a8";
    x.fillRect(-len / 2, -13, len, 26);
    x.globalAlpha = 1;
    x.restore();
  }

  let S = 40; // px per board unit for card textures; raised for mobile guided mode

  function setFittedFont(x, text, preferred, minimum, maxWidth, family, weight) {
    const prefix = weight ? `${weight} ` : "";
    let size = preferred;
    x.font = `${prefix}${size}px ${family}`;
    const measured = x.measureText(text || "").width;
    if (measured > maxWidth) {
      size = Math.max(minimum, preferred * (maxWidth / measured));
      x.font = `${prefix}${size}px ${family}`;
    }
    return size;
  }

  function dateLines(x, text, preferred, maxWidth, family) {
    x.font = `${preferred}px ${family}`;
    if (x.measureText(text).width <= maxWidth) return [text];

    const parts = text.split(/\s*·\s*/).filter(Boolean);
    if (parts.length < 2) return [text];

    let best = [text];
    let bestWidth = Infinity;
    for (let split = 1; split < parts.length; split++) {
      const candidate = [
        parts.slice(0, split).join(" · "),
        parts.slice(split).join(" · "),
      ];
      const widest = Math.max(...candidate.map((line) => x.measureText(line).width));
      if (widest < bestWidth) {
        best = candidate;
        bestWidth = widest;
      }
    }
    return best;
  }

  function cardTexture(card, img) {
    const W = Math.round(card.w * S), H = Math.round(card.h * S);
    const c = makeCanvas(W, H);
    const x = c.getContext("2d");
    const pad = S * 0.9;

    if (card.type === "banner") {
      paperBase(x, W, H, true);
      if (card.variant === "hero") {
        const maxWidth = W - S * 1.7;

        x.fillStyle = COL.red;
        setFittedFont(x, D.meta.caseNo, H * 0.075, H * 0.058, maxWidth, '"Special Elite", monospace');
        let w = x.measureText(D.meta.caseNo).width;
        x.fillText(D.meta.caseNo, (W - w) / 2, H * 0.17);

        x.fillStyle = COL.ink;
        setFittedFont(x, card.title, H * 0.32, H * 0.26, maxWidth, '"Special Elite", monospace');
        w = x.measureText(card.title).width;
        x.fillText(card.title, (W - w) / 2, H * 0.49);

        const subjectLine = `SUBJECT: ${D.meta.subjectName}`;
        setFittedFont(x, subjectLine, H * 0.09, H * 0.068, maxWidth, '"Special Elite", monospace');
        w = x.measureText(subjectLine).width;
        x.fillText(subjectLine, (W - w) / 2, H * 0.7);

        x.fillStyle = COL.red;
        setFittedFont(x, D.meta.role, H * 0.078, H * 0.06, maxWidth, '"Special Elite", monospace');
        w = x.measureText(D.meta.role).width;
        x.fillText(D.meta.role, (W - w) / 2, H * 0.84);
      } else {
        x.fillStyle = COL.ink;
        setFittedFont(x, card.title, H * 0.42, H * 0.34, W - S * 1.6, '"Special Elite", monospace');
        let w = x.measureText(card.title).width;
        x.fillText(card.title, (W - w) / 2, H * 0.5);
        x.fillStyle = COL.red;
        setFittedFont(x, card.sub, H * 0.155, H * 0.09, W - S * 1.7, '"Special Elite", monospace');
        w = x.measureText(card.sub).width;
        x.fillText(card.sub, (W - w) / 2, H * 0.75);
      }
      x.strokeStyle = COL.ink;
      x.globalAlpha = 0.55;
      x.lineWidth = 2;
      x.strokeRect(S * 0.35, S * 0.35, W - S * 0.7, H - S * 0.7);
      x.globalAlpha = 1;
      tapeStrip(x, W * 0.12, S * 0.3, -0.06, S * 2.6);
      tapeStrip(x, W * 0.88, S * 0.3, 0.08, S * 2.6);
    }

    else if (card.type === "report" || card.type === "lead" || card.type === "index") {
      const old = card.type === "lead";
      paperBase(x, W, H, old);
      if (card.type === "index") {
        /* ruled index card */
        x.strokeStyle = COL.blueRule;
        x.globalAlpha = 0.5;
        x.lineWidth = 1.4;
        for (let ly = S * 2.9; ly < H - S * 0.5; ly += S * 0.95) {
          x.beginPath(); x.moveTo(pad * 0.5, ly); x.lineTo(W - pad * 0.5, ly); x.stroke();
        }
        x.strokeStyle = COL.red;
        x.globalAlpha = 0.6;
        x.beginPath(); x.moveTo(pad * 0.5, S * 1.95); x.lineTo(W - pad * 0.5, S * 1.95); x.stroke();
        x.globalAlpha = 1;
      }
      const bodyLines = card.lines || [];
      const longestLine = bodyLines.reduce((longest, line) => line.length > longest.length ? line : longest, "");
      const maxTextWidth = W - pad * 1.1;
      const guidedText = viewMode === "mobile-guided";
      let cy = guidedText ? S * 1.42 : S * 1.45;

      x.fillStyle = card.type === "lead" ? COL.red : (guidedText ? "#211c17" : COL.ink);
      setFittedFont(
        x,
        card.title,
        guidedText ? S * 1.22 : S * 1.12,
        guidedText ? S * 1.02 : S * 1.05,
        maxTextWidth,
        '"Special Elite", monospace'
      );
      x.fillText(card.title, pad * 0.55, cy);
      cy += S * (guidedText ? 1.08 : 1.02);

      if (card.date) {
        x.fillStyle = guidedText ? "#393127" : COL.inkFaint;
        if (guidedText) {
          const lines = dateLines(x, card.date, S * 0.82, maxTextWidth, '"Special Elite", monospace');
          const longestDate = lines.reduce((longest, line) => line.length > longest.length ? line : longest, "");
          setFittedFont(x, longestDate, S * 0.82, S * 0.68, maxTextWidth, '"Special Elite", monospace');
          lines.forEach((line) => {
            x.fillText(line, pad * 0.55, cy);
            cy += S * 0.82;
          });
        } else {
          setFittedFont(x, card.date, S * 0.68, S * 0.61, maxTextWidth, '"Special Elite", monospace');
          x.fillText(card.date, pad * 0.55, cy);
          cy += S * 0.7;
        }
      }

      cy += S * (guidedText ? 0.38 : 0.58);
      x.fillStyle = guidedText ? "#211c17" : COL.ink;
      if (guidedText && bodyLines.length) {
        const bottomReserve = S * (card.stamp ? 2 : 0.55);
        const availableHeight = Math.max(S, H - cy - bottomReserve);
        const lineHeight = Math.min(S * 1.06, availableHeight / bodyLines.length);
        const preferredBody = Math.min(S * 1.1, lineHeight * 1.02);
        setFittedFont(x, longestLine, preferredBody, S * 0.72, maxTextWidth, '"Special Elite", monospace');
        bodyLines.forEach((line) => {
          x.fillText(line, pad * 0.55, cy);
          cy += lineHeight;
        });
      } else {
        setFittedFont(x, longestLine, S * 0.8, S * 0.74, maxTextWidth, '"Special Elite", monospace');
        bodyLines.forEach((line) => {
          x.fillText(line, pad * 0.55, cy);
          cy += S * 0.95;
        });
      }
      if (card.stamp) {
        stamp(x, card.stamp, W * 0.68, guidedText ? H - S * 0.72 : H * 0.84, -0.12, S * 0.72);
      }
      if (card.type === "report") {
        /* punched holes up top */
        x.fillStyle = "rgba(40,30,20,0.35)";
        [0.3, 0.7].forEach((fx) => {
          x.beginPath(); x.arc(W * fx, S * 0.42, S * 0.14, 0, 7); x.fill();
        });
      }
    }

    else if (card.type === "polaroid" || card.type === "photo") {
      /* white polaroid frame */
      x.fillStyle = "#f4efe4";
      x.fillRect(0, 0, W, H);
      const fg = x.createLinearGradient(0, 0, 0, H);
      fg.addColorStop(0, "rgba(120,100,70,0.08)");
      fg.addColorStop(1, "rgba(120,100,70,0.16)");
      x.fillStyle = fg;
      x.fillRect(0, 0, W, H);
      const b = S * 0.55;
      const photoH = H - b * 2 - S * 2.2;
      x.fillStyle = "#1c1a17";
      x.fillRect(b, b, W - b * 2, photoH);
      if (img) {
        const pw = W - b * 2, ph = photoH;
        const ir = img.width / img.height, pr = pw / ph;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (ir > pr) { sw = img.height * pr; sx = (img.width - sw) / 2; }
        else { sh = img.width / pr; sy = (img.height - sh) / 2; }
        x.drawImage(img, sx, sy, sw, sh, b, b, pw, ph);
        x.fillStyle = "rgba(60,45,25,0.08)";
        x.fillRect(b, b, pw, ph);
      }
      x.fillStyle = COL.inkFaint;
      setFittedFont(x, card.caption, S * 0.9, S * 0.8, W - S * 1.2, '"Caveat", cursive');
      const cw = x.measureText(card.caption).width;
      x.fillText(card.caption, (W - cw) / 2, H - S * 0.85);
      if (card.tag) {
        /* red evidence tag corner */
        x.save();
        x.translate(W - S * 2.5, S * 1.6);
        x.rotate(0.12);
        x.fillStyle = COL.red;
        x.fillRect(-S * 1.7, -S * 0.62, S * 3.4, S * 1.15);
        x.fillStyle = "#f0e7d3";
        setFittedFont(x, card.tag, S * 0.68, S * 0.62, S * 2.9, '"Special Elite", monospace');
        const tw = x.measureText(card.tag).width;
        x.fillText(card.tag, -tw / 2, S * 0.2);
        x.restore();
      }
    }

    else if (card.type === "note") {
      /* torn handwritten note */
      x.fillStyle = "#ece0c4";
      x.beginPath();
      x.moveTo(0, S * 0.3);
      for (let fx = 0; fx <= W; fx += W / 14) x.lineTo(fx, Math.random() * S * 0.5);
      x.lineTo(W, H - Math.random() * S * 0.4);
      for (let fx = W; fx >= 0; fx -= W / 14) x.lineTo(fx, H - Math.random() * S * 0.5);
      x.closePath();
      x.fill();
      x.fillStyle = "#3a3129";
      const noteLines = card.hand || [];
      const longestNote = noteLines.reduce((longest, line) => line.length > longest.length ? line : longest, "");
      setFittedFont(x, longestNote, S * 1.05, S * 0.95, W - S * 1.1, '"Caveat", cursive');
      let cy = S * 2.1;
      noteLines.forEach((ln) => {
        const lw = x.measureText(ln).width;
        x.fillText(ln, (W - lw) / 2, cy);
        cy += S * 1.25;
      });
    }

    return tex(c);
  }

  function tagTexture(label) {
    const W = 720, H = 190;
    const c = makeCanvas(W, H);
    const x = c.getContext("2d");
    x.fillStyle = COL.kraft;
    x.beginPath();
    x.moveTo(46, 0); x.lineTo(W, 0); x.lineTo(W, H); x.lineTo(46, H); x.lineTo(0, H / 2);
    x.closePath();
    x.fill();
    /* subtle paper shading so the tag reads as card, not sticker */
    const sg = x.createLinearGradient(0, 0, 0, H);
    sg.addColorStop(0, "rgba(255,245,220,0.16)");
    sg.addColorStop(1, "rgba(60,40,20,0.14)");
    x.fillStyle = sg;
    x.fill();
    x.fillStyle = "rgba(60,40,20,0.3)";
    x.beginPath(); x.arc(52, H / 2, 15, 0, 7); x.fill();
    x.fillStyle = "#f4ecd9";
    x.beginPath(); x.arc(52, H / 2, 8, 0, 7); x.fill();
    x.fillStyle = "#241b10";
    let fs = 92;
    x.font = `600 ${fs}px "Caveat", cursive`;
    let w = x.measureText(label).width;
    const maxW = W - 130;
    if (w > maxW) {
      fs = Math.max(34, Math.floor(fs * maxW / w));
      x.font = `600 ${fs}px "Caveat", cursive`;
      w = x.measureText(label).width;
    }
    x.fillText(label, 90 + (maxW - w) / 2, H / 2 + fs * 0.33);
    return tex(c);
  }

  /* ---------------- scene build ---------------- */

  function buildStatic() {
    /* wall */
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 640),
      new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 1 })
    );
    wall.position.set(0, (BOARD_TOP + BOARD_BOT) / 2, -3.5);
    wall.receiveShadow = true;
    scene.add(wall);

    /* cork board */
    const bh = BOARD_TOP - BOARD_BOT;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_W, bh, 1.6),
      new THREE.MeshStandardMaterial({ map: corkTexture(), roughness: 0.95 })
    );
    board.position.set(0, (BOARD_TOP + BOARD_BOT) / 2, -0.8);
    board.receiveShadow = true;
    scene.add(board);

    /* wood frame */
    const woodMat = new THREE.MeshStandardMaterial({ color: COL.frame, roughness: 0.6, metalness: 0.08 });
    const T = 3.2, DP = 2.6;
    [
      [0, BOARD_TOP + T / 2, BOARD_W + T * 2, T],
      [0, BOARD_BOT - T / 2, BOARD_W + T * 2, T],
      [-(BOARD_W / 2 + T / 2), (BOARD_TOP + BOARD_BOT) / 2, T, bh + T * 2],
      [BOARD_W / 2 + T / 2, (BOARD_TOP + BOARD_BOT) / 2, T, bh + T * 2],
    ].forEach(([px, py, w, h]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, DP), woodMat);
      m.position.set(px, py, -0.6);
      m.castShadow = true;
      scene.add(m);
    });

    /* dust motes */
    const N = viewMode === "desktop-scroll" ? 340 : 160;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 180;
      pos[i * 3 + 1] = BOARD_BOT + Math.random() * (BOARD_TOP - BOARD_BOT);
      pos[i * 3 + 2] = Math.random() * 50;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: 0xd8c49a, size: 0.28, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    scene.add(dust);
  }

  function makePin(colorHex) {
    const grp = new THREE.Group();
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 18, 14),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.15 })
    );
    head.position.z = 0.62;
    head.castShadow = true;
    const needle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.02, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: 0xc9c2b4, roughness: 0.3, metalness: 0.8 })
    );
    needle.rotation.x = Math.PI / 2;
    needle.position.z = 0.2;
    grp.add(needle);
    grp.add(head);
    return grp;
  }

  function buildCards(images) {
    D.cards.forEach((card) => {
      const img = card.img ? images[card.img] : null;
      const t = cardTexture(card, img);
      const grp = new THREE.Group();

      const paper = new THREE.Mesh(
        new THREE.PlaneGeometry(card.w, card.h, 6, 6),
        new THREE.MeshStandardMaterial({
          map: t,
          roughness: 0.85,
          emissive: 0x5a2a16,
          emissiveIntensity: 0,
        })
      );
      paper.castShadow = true;
      paper.receiveShadow = true;
      /* slight paper bow */
      const pa = paper.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const px = pa.getX(i) / card.w, py = pa.getY(i) / card.h;
        pa.setZ(i, Math.sin(px * Math.PI) * Math.sin(py * Math.PI) * 0.12 + (Math.random() - 0.5) * 0.03);
      }
      paper.geometry.computeVertexNormals();
      grp.add(paper);

      /* pin (banners get two tape strips instead — drawn in texture) */
      let pinWorld = null;
      if (card.type !== "banner" && card.type !== "note") {
        const pin = makePin(card.pinColor || COL.pin);
        pin.position.set(0, card.h / 2 - 0.9, 0.14);
        grp.add(pin);
        pinWorld = new THREE.Vector3(0, card.h / 2 - 0.9, 0.7);
      } else if (card.type === "note") {
        const pin = makePin(0x35502e);
        pin.position.set(0, card.h / 2 - 0.6, 0.14);
        grp.add(pin);
      }

      grp.position.set(card.pos[0], card.pos[1], CARD_Z);
      grp.rotation.z = (card.rot || 0) * Math.PI / 180;
      scene.add(grp);

      grp.userData = {
        card,
        baseZ: CARD_Z,
        baseRotZ: grp.rotation.z,
        hover: 0,
        pinWorld,
        paper,
        phase: Math.random() * Math.PI * 2,
      };
      cardGroups.set(card.id, grp);
      paper.userData.root = grp;
      if (card.detail || card.detailRef) cardMeshes.push(paper);
      flutterers.push(grp);
    });
  }

  function pinPosOf(id) {
    const g = flutterers.find((f) => f.userData.card.id === id);
    if (!g) return new THREE.Vector3();
    const c = g.userData.card;
    return new THREE.Vector3(
      c.pos[0], c.pos[1] + c.h / 2 - 0.9, CARD_Z + 0.75
    );
  }

  function buildThreads() {
    const mat = new THREE.MeshStandardMaterial({ color: COL.thread, roughness: 0.6 });
    D.threads.forEach((th) => {
      const a = pinPosOf(th.from);
      const b = pinPosOf(th.to);
      const mid = a.clone().lerp(b, 0.5);
      const dist = a.distanceTo(b);
      mid.y -= dist * 0.13;           /* gravity sag */
      mid.z += 1.1;                    /* string floats off the cork */
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.09, 6), mat);
      tube.castShadow = true;
      scene.add(tube);

      /* kraft tag on the thread naming what transferred */
      const tw = 15, thh = 4;
      const tag = new THREE.Mesh(
        new THREE.PlaneGeometry(tw, thh),
        new THREE.MeshStandardMaterial({ map: tagTexture(th.label), roughness: 0.9, transparent: true })
      );
      let tp;
      if (mobileLayout && th.tagY != null) {
        /* single-column layout: park the tag at a given world-y (a gap
           between stacked cards) by sampling the curve */
        let best = 0.5, bd = Infinity;
        for (let i = 5; i <= 95; i++) {
          const p = curve.getPoint(i / 100);
          const d = Math.abs(p.y - th.tagY);
          if (d < bd) { bd = d; best = i / 100; }
        }
        tp = curve.getPoint(best);
      } else {
        tp = curve.getPoint(th.tagT || 0.5);
      }
      const tagDrop = mobileLayout && th.tagY != null ? 0 : thh * 0.62;
      tag.position.set(tp.x, tp.y - tagDrop, tp.z + 0.35);
      tag.rotation.z = (Math.random() - 0.5) * 0.14;
      tag.castShadow = true;
      scene.add(tag);
    });
  }

  /* ---------------- interaction ---------------- */

  function setPointer(e) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(cardMeshes);
    return hits.length ? hits[0].object.userData.root : null;
  }

  function pickNearest(clientX, clientY, maxDistance) {
    const rect = renderer.domElement.getBoundingClientRect();
    let nearest = null;
    let nearestDistance = maxDistance;
    const projected = new THREE.Vector3();

    cardMeshes.forEach((paper) => {
      const card = paper.userData.root.userData.card;
      const halfW = card.w / 2;
      const halfH = card.h / 2;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      paper.updateWorldMatrix(true, false);
      [
        [-halfW, -halfH], [halfW, -halfH],
        [halfW, halfH], [-halfW, halfH],
      ].forEach(([x, y]) => {
        projected.set(x, y, 0);
        paper.localToWorld(projected);
        projected.project(camera);
        const screenX = rect.left + (projected.x + 1) * rect.width / 2;
        const screenY = rect.top + (1 - projected.y) * rect.height / 2;
        minX = Math.min(minX, screenX);
        maxX = Math.max(maxX, screenX);
        minY = Math.min(minY, screenY);
        maxY = Math.max(maxY, screenY);
      });

      const closestX = Math.max(minX, Math.min(clientX, maxX));
      const closestY = Math.max(minY, Math.min(clientY, maxY));
      const distance = Math.hypot(clientX - closestX, clientY - closestY);
      if (distance <= nearestDistance) {
        nearestDistance = distance;
        nearest = paper.userData.root;
      }
    });

    return nearest;
  }

  function clearHover() {
    hovered = null;
    document.body.classList.remove("board-hover");
    if (onHoverChange) onHoverChange(null, null);
  }

  /* half of the world-height visible at distance z */
  function visHalfAt(z) {
    return z * Math.tan((camera.fov * Math.PI) / 360);
  }

  /* camera distance at which `w` world units span the viewport width */
  function fitZForWidth(w) {
    const halfW = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
    return (w / 2) / halfW;
  }

  function computeBaseZ() {
    return mobileLayout ? Math.min(115, Math.max(45, fitZForWidth(30))) : 62;
  }

  /* camera-y travel range mapped to page scroll */
  function scrollStops() {
    if (mobileLayout) {
      const vh = visHalfAt(baseZ);
      return { top: BOARD_TOP - vh + 4, bot: BOARD_BOT + vh - 4 };
    }
    return { top: BOARD_TOP - 26, bot: BOARD_BOT + 22 };
  }

  function guidedInsets() {
    const supplied = getViewportInsets ? getViewportInsets() : null;
    const inset = supplied || { top: 112, right: 12, bottom: 100, left: 12 };
    return {
      top: Math.max(0, Number(inset.top) || 0),
      right: Math.max(0, Number(inset.right) || 0),
      bottom: Math.max(0, Number(inset.bottom) || 0),
      left: Math.max(0, Number(inset.left) || 0),
    };
  }

  function guidedView(card) {
    const inset = guidedInsets();
    const availableWidth = Math.max(160, window.innerWidth - inset.left - inset.right);
    const availableHeight = Math.max(180, window.innerHeight - inset.top - inset.bottom);
    const pixelsPerUnit = Math.max(1, Math.min(
      availableWidth * 0.94 / card.w,
      availableHeight * 0.96 / card.h
    ));
    const halfFov = camera.fov * Math.PI / 360;
    const desiredX = inset.left + availableWidth / 2;
    const desiredY = inset.top + availableHeight / 2;
    const distance = window.innerHeight / (2 * Math.tan(halfFov) * pixelsPerUnit);
    return {
      x: card.pos[0] - (desiredX - window.innerWidth / 2) / pixelsPerUnit,
      y: card.pos[1] + (desiredY - window.innerHeight / 2) / pixelsPerUnit,
      z: distance + CARD_Z + 2.2,
    };
  }

  function applyView(view, immediate) {
    camX.target = view.x;
    camY.target = view.y;
    camZ.target = view.z;
    if (immediate) {
      camX.cur = view.x;
      camY.cur = view.y;
      camZ.cur = view.z;
      lookY.cur = view.y;
    }
  }

  function selectGuidedCard(cardId, options) {
    const grp = cardGroups.get(cardId);
    if (!grp) return false;
    const immediate = !!(options && options.immediate);
    guided = { grp, settled: immediate };
    clearHover();
    applyView(guidedView(grp.userData.card), immediate);
    if (onCardChange) onCardChange(grp.userData.card);
    if (immediate && onCardSettled) onCardSettled(grp.userData.card);
    return true;
  }

  function focusCard(grp) {
    const card = grp.userData.card;
    focus = { grp };
    clearHover();
    if (mobileLayout) {
      /* fit by width; park the card in the upper part of the screen so the
         bottom-sheet dossier doesn't cover it */
      camZ.target = fitZForWidth(card.w * 1.34) + 3;
      camX.target = card.pos[0];
      camY.target = card.pos[1] - visHalfAt(camZ.target) * 0.42;
    } else {
      const fitH = Math.max(card.h * 1.55, card.w * 1.15 / camera.aspect);
      camZ.target = fitH / (2 * Math.tan((camera.fov * Math.PI) / 360)) + 4;
      camX.target = card.pos[0] * 0.92;
      camY.target = card.pos[1];
    }
    if (onFocusChange) onFocusChange(card);
  }

  function unfocus() {
    if (viewMode === "mobile-guided") return;
    focus = null;
    camZ.target = baseZ;
    camX.target = 0;
    if (onFocusChange) onFocusChange(null);
  }

  /* ---------------- loop ---------------- */

  function animate() {
    requestAnimationFrame(animate);
    if (document.hidden) return;
    const t = clock.getElapsedTime();

    /* camera easing */
    const mobileEase = viewMode === "mobile-guided";
    camY.cur += (camY.target - camY.cur) * (mobileEase ? 0.09 : 0.07);
    camX.cur += (camX.target - camX.cur) * (mobileEase ? 0.09 : 0.06);
    camZ.cur += (camZ.target - camZ.cur) * (mobileEase ? 0.085 : 0.05);
    const allowParallax = viewMode === "desktop-scroll" && !focus;
    const parX = allowParallax ? pointer.x * 3.4 : 0;
    const parY = allowParallax ? pointer.y * 1.8 : 0;
    camera.position.set(camX.cur + parX, camY.cur + parY, camZ.cur);
    lookY.cur += (camY.target - lookY.cur) * (mobileEase ? 0.09 : 0.07);
    camera.lookAt(camX.cur + parX * 0.55, lookY.cur + parY * 0.55, 0);

    const cameraSettled =
      Math.abs(camX.target - camX.cur) < 0.18 &&
      Math.abs(camY.target - camY.cur) < 0.18 &&
      Math.abs(camZ.target - camZ.cur) < 0.35;
    if (guided && !guided.settled && cameraSettled) {
      guided.settled = true;
      if (onCardSettled) onCardSettled(guided.grp.userData.card);
    }

    /* lamp follows like a flashlight, with a slow pendulum */
    if (viewMode === "mobile-guided") {
      lamp.position.set(camX.cur + Math.sin(t * 0.7) * 2.5, camY.cur + 18, 42);
      lampTarget.position.set(camX.cur, camY.cur, 0);
    } else {
      lamp.position.set(Math.sin(t * 0.7) * 5, camY.cur + 26, 46);
      lampTarget.position.set(Math.sin(t * 0.7) * 2.5, camY.cur - 2, 0);
    }

    /* card flutter + hover lift */
    const hoverGrp = hovered;
    flutterers.forEach((g) => {
      const u = g.userData;
      const guidedSelected = !!(guided && guided.grp === g);
      const want = g === hoverGrp || (focus && focus.grp === g) || guidedSelected ? 1 : 0;
      u.hover += (want - u.hover) * 0.12;
      if (viewMode === "mobile-guided") {
        const loose = 1 - u.hover;
        g.position.z = u.baseZ + u.hover * 2.2 + Math.sin(t * 0.9 + u.phase) * 0.035 * loose;
        g.rotation.z = u.baseRotZ * loose + Math.sin(t * 0.7 + u.phase) * 0.003 * loose;
        g.rotation.y = Math.sin(t * 0.5 + u.phase) * 0.004 * loose;
        const selectedScale = 1 + u.hover * 0.015;
        g.scale.set(selectedScale, selectedScale, selectedScale);
        u.paper.material.emissiveIntensity = u.hover * 0.08;
      } else {
        g.position.z = u.baseZ + u.hover * 2 + Math.sin(t * 0.9 + u.phase) * 0.05;
        g.rotation.z = u.baseRotZ * (1 - u.hover * 0.6) + Math.sin(t * 0.7 + u.phase) * 0.004;
        g.rotation.y = u.hover * -0.05 + Math.sin(t * 0.5 + u.phase) * 0.006;
        const hoverScale = 1 + u.hover * 0.028;
        g.scale.set(hoverScale, hoverScale, hoverScale);
        u.paper.material.emissiveIntensity = u.hover * 0.24;
      }
    });

    /* dust drift */
    dust.rotation.y = Math.sin(t * 0.05) * 0.08;
    dust.position.y = Math.sin(t * 0.11) * 1.6;

    renderer.render(scene, camera);
  }

  /* ---------------- public ---------------- */

  function init(opts) {
    viewMode = opts.viewMode || "desktop-scroll";
    S = viewMode === "desktop-scroll" ? 40 : 48;
    mobileLayout = viewMode === "mobile-scroll";
    if (mobileLayout) {
      /* single-column board: swap in mobile positions/sizes from data.js */
      BOARD_W = 40;
      BOARD_TOP = 158;
      BOARD_BOT = -234;
      D.cards.forEach((c) => {
        if (c.m) c.pos = c.m;
        if (c.mw) c.w = c.mw;
        if (c.mh) c.h = c.mh;
      });
    }
    cardMeshes = [];
    flutterers = [];
    cardGroups = new Map();
    hovered = null;
    focus = null;
    guided = null;
    onFocusChange = opts.onFocusChange || null;
    onHoverChange = opts.onHoverChange || null;
    onCardChange = opts.onCardChange || null;
    onCardSettled = opts.onCardSettled || null;
    onCardActivate = opts.onCardActivate || null;
    onStepRequest = opts.onStepRequest || null;
    getViewportInsets = opts.getViewportInsets || null;

    renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(COL.fog);
    scene.fog = new THREE.Fog(COL.fog, 130, 320);

    camera = new THREE.PerspectiveCamera(
      46,
      window.innerWidth / window.innerHeight,
      0.5,
      500
    );
    baseZ = computeBaseZ();
    camZ.cur = baseZ * 1.9;
    camZ.target = baseZ;
    const stops0 = scrollStops();
    camY.cur = camY.target = stops0.top;
    lookY.cur = stops0.top;
    camera.position.set(0, camY.cur, camZ.cur);

    /* lights */
    scene.add(new THREE.AmbientLight(0x51503f, viewMode === "mobile-guided" ? 1 : 0.85));
    lamp = new THREE.SpotLight(0xffd9a3, viewMode === "mobile-guided" ? 1 : 1.2, 320, 0.72, 0.6, 1.1);
    lamp.castShadow = true;
    const shadowSize = viewMode === "mobile-guided" ? 512 : 1024;
    lamp.shadow.mapSize.set(shadowSize, shadowSize);
    lamp.shadow.bias = -0.002;
    lampTarget = new THREE.Object3D();
    scene.add(lampTarget);
    lamp.target = lampTarget;
    scene.add(lamp);
    const fill = new THREE.DirectionalLight(0x9eb8a8, 0.32);
    fill.position.set(-40, 30, 80);
    scene.add(fill);

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2(0, 0);
    clock = new THREE.Clock();

    buildStatic();
    buildCards(opts.images);
    buildThreads();

    if (viewMode === "mobile-guided") selectGuidedCard(opts.initialCardId || "profile", { immediate: true });

    /* events */
    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      baseZ = computeBaseZ();
      if (!focus && viewMode !== "mobile-guided") camZ.target = baseZ;
      if (focus && mobileLayout) focusCard(focus.grp);
      if (viewMode === "mobile-guided" && guided) {
        guided.settled = false;
        applyView(guidedView(guided.grp.userData.card), false);
      }
    });

    if (viewMode === "mobile-guided") {
      opts.canvas.addEventListener("pointerdown", (e) => {
        pointerDown = { x: e.clientX, y: e.clientY };
        try { opts.canvas.setPointerCapture(e.pointerId); } catch (err) { /* unsupported */ }
      });

      opts.canvas.addEventListener("pointerup", (e) => {
        if (!pointerDown) return;
        const dx = e.clientX - pointerDown.x;
        const dy = e.clientY - pointerDown.y;
        const moved = Math.hypot(dx, dy);
        pointerDown = null;
        try { opts.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* unsupported */ }

        if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.15) {
          if (onStepRequest) onStepRequest(dx < 0 ? 1 : -1);
          return;
        }
        if (moved > 10) return;

        setPointer(e);
        const hit = pick() || pickNearest(e.clientX, e.clientY, 32);
        if (!hit) return;
        if (guided && hit === guided.grp) {
          if (onCardActivate) onCardActivate(hit.userData.card);
        } else {
          selectGuidedCard(hit.userData.card.id);
        }
      });

      opts.canvas.addEventListener("pointercancel", () => {
        pointerDown = null;
      });
    } else {
      opts.canvas.addEventListener("pointermove", (e) => {
        setPointer(e);
        if (focus) {
          if (onHoverChange) onHoverChange(null, null);
          return;
        }
        const hit = pick();
        hovered = hit;
        document.body.classList.toggle("board-hover", !!hit);
        if (onHoverChange) {
          onHoverChange(
            hit ? hit.userData.card : null,
            hit ? { x: e.clientX, y: e.clientY } : null
          );
        }
      });

      opts.canvas.addEventListener("pointerleave", clearHover);

      opts.canvas.addEventListener("click", (e) => {
        if (focus) return;
        setPointer(e);
        const hit = pick();
        if (hit) focusCard(hit);
      });
    }

    animate();
    return {
      setScrollT(tt) {
        if (viewMode === "mobile-guided") return;
        if (focus) return;
        if (hovered) {
          hovered = null;
          document.body.classList.remove("board-hover");
          if (onHoverChange) onHoverChange(null, null);
        }
        const stops = scrollStops();
        camY.target = stops.top + (stops.bot - stops.top) * tt;
      },
      scrollStops,
      jumpTo(y) { camY.target = y; lookY.cur = y; camY.cur = y; },
      showCard(cardId, options) {
        if (viewMode !== "mobile-guided") return false;
        return selectGuidedCard(cardId, options);
      },
      unfocus,
      isFocused() { return !!focus; },
      selectedCard() { return guided ? guided.grp.userData.card : null; },
      cameraY() { return camY.cur; },
    };
  }

  return { init };
})();
