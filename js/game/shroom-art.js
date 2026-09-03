// Draws a mushroom on a canvas from its own morphology.
//
// Every species carries an "art" block describing cap shape, colours and
// features. Nothing here is a photograph, so the game ships with no
// binary assets and no image licensing to honour, and a species drawn
// from its real characters teaches the characters while it draws.
//
// All drawing happens in a unit box: the mushroom stands on (0,0) and is
// about 1 unit tall. The caller scales and translates.

var ShroomArt = (function () {

  function lighten(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, ((n >> 16) & 255) + amt);
    var g = Math.min(255, ((n >> 8) & 255) + amt);
    var b = Math.min(255, (n & 255) + amt);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function darken(hex, amt) { return lighten(hex, -amt); }

  /** Deterministic pseudo-random from a string, so a species always looks the same. */
  function seeded(id) {
    var h = 2166136261;
    for (var i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function () {
      h ^= h << 13; h >>>= 0;
      h ^= h >> 17;
      h ^= h << 5; h >>>= 0;
      return (h >>> 0) / 4294967296;
    };
  }

  // --- cap silhouettes -------------------------------------------------
  // Each returns after tracing a path; the caller fills it.

  function capPath(ctx, shape, w, h) {
    ctx.beginPath();
    switch (shape) {
      case 'flat':
        ctx.moveTo(-w, 0);
        ctx.quadraticCurveTo(-w * 0.6, -h * 1.15, 0, -h * 1.1);
        ctx.quadraticCurveTo(w * 0.6, -h * 1.15, w, 0);
        ctx.quadraticCurveTo(0, h * 0.18, -w, 0);
        break;
      case 'conical':
        ctx.moveTo(-w, 0);
        ctx.quadraticCurveTo(-w * 0.35, -h * 1.9, 0, -h * 2.1);
        ctx.quadraticCurveTo(w * 0.35, -h * 1.9, w, 0);
        ctx.quadraticCurveTo(0, h * 0.2, -w, 0);
        break;
      case 'bell':
        ctx.moveTo(-w, 0);
        ctx.bezierCurveTo(-w, -h * 1.5, -w * 0.5, -h * 1.7, 0, -h * 1.7);
        ctx.bezierCurveTo(w * 0.5, -h * 1.7, w, -h * 1.5, w, 0);
        ctx.quadraticCurveTo(0, h * 0.2, -w, 0);
        break;
      case 'cylinder':
        ctx.moveTo(-w * 0.75, 0);
        ctx.lineTo(-w * 0.8, -h * 1.9);
        ctx.quadraticCurveTo(0, -h * 2.4, w * 0.8, -h * 1.9);
        ctx.lineTo(w * 0.75, 0);
        ctx.quadraticCurveTo(0, h * 0.2, -w * 0.75, 0);
        break;
      case 'funnel':
        ctx.moveTo(-w, -h * 0.5);
        ctx.quadraticCurveTo(-w * 0.4, -h * 0.1, 0, -h * 0.35);
        ctx.quadraticCurveTo(w * 0.4, -h * 0.1, w, -h * 0.5);
        ctx.quadraticCurveTo(w * 0.5, h * 0.35, 0, h * 0.3);
        ctx.quadraticCurveTo(-w * 0.5, h * 0.35, -w, -h * 0.5);
        break;
      case 'ball':
        ctx.ellipse(0, -h * 0.85, w, h * 0.95, 0, 0, Math.PI * 2);
        break;
      case 'pear':
        ctx.moveTo(-w * 0.55, 0);
        ctx.bezierCurveTo(-w * 0.75, -h * 0.7, -w, -h * 1.1, 0, -h * 1.5);
        ctx.bezierCurveTo(w, -h * 1.1, w * 0.75, -h * 0.7, w * 0.55, 0);
        ctx.quadraticCurveTo(0, h * 0.2, -w * 0.55, 0);
        break;
      default: // convex
        ctx.moveTo(-w, 0);
        ctx.bezierCurveTo(-w, -h * 1.2, -w * 0.55, -h * 1.45, 0, -h * 1.45);
        ctx.bezierCurveTo(w * 0.55, -h * 1.45, w, -h * 1.2, w, 0);
        ctx.quadraticCurveTo(0, h * 0.22, -w, 0);
    }
    ctx.closePath();
  }

  /** Cap shapes whose underside is hidden, so gills must not be drawn. */
  var CLOSED = { ball: 1, pear: 1, tuber: 1, lump: 1, blob: 1 };

  // --- whole-form drawings that ignore the cap/stipe model -------------

  function drawBranching(ctx, a, S, rnd, n, jelly) {
    var col = a.capColor, col2 = a.capColor2 || lighten(col, 24);
    for (var i = 0; i < n; i++) {
      var baseX = (i / (n - 1 || 1) - 0.5) * S * 0.75;
      var hgt = S * (0.5 + rnd() * 0.5);
      ctx.strokeStyle = i % 2 ? col2 : col;
      ctx.lineWidth = S * (jelly ? 0.075 : 0.055);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(baseX * 0.35, 0);
      var midX = baseX * 0.8, midY = -hgt * 0.55;
      ctx.quadraticCurveTo(midX, midY, baseX, -hgt);
      ctx.stroke();
      // a fork near the top reads as "coral" rather than "grass"
      ctx.lineWidth *= 0.7;
      ctx.beginPath();
      ctx.moveTo(baseX * 0.9, -hgt * 0.75);
      ctx.lineTo(baseX * 0.9 - S * 0.09, -hgt * 1.05);
      ctx.moveTo(baseX * 0.9, -hgt * 0.75);
      ctx.lineTo(baseX * 0.9 + S * 0.08, -hgt * 1.02);
      ctx.stroke();
    }
  }

  function drawShelf(ctx, a, S, rnd, tiers) {
    var col = a.capColor, col2 = a.capColor2 || lighten(col, 30);
    for (var i = 0; i < tiers; i++) {
      var y = -S * (0.12 + i * 0.16);
      var w = S * (0.62 - i * 0.05);
      var g = ctx.createLinearGradient(0, y - S * 0.1, 0, y + S * 0.05);
      g.addColorStop(0, col2);
      g.addColorStop(1, col);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-w * 0.2, y);
      ctx.quadraticCurveTo(-w * 0.1, y - S * 0.16, w * 0.75, y - S * 0.1);
      ctx.quadraticCurveTo(w * 0.95, y + S * 0.02, w * 0.7, y + S * 0.04);
      ctx.quadraticCurveTo(w * 0.1, y + S * 0.06, -w * 0.2, y);
      ctx.closePath();
      ctx.fill();
      if (a.zones) {
        ctx.strokeStyle = 'rgba(0,0,0,0.16)';
        ctx.lineWidth = S * 0.012;
        for (var z = 1; z <= 2; z++) {
          ctx.beginPath();
          ctx.moveTo(-w * 0.1, y - S * 0.02 * z);
          ctx.quadraticCurveTo(w * 0.3, y - S * 0.09 - S * 0.02 * z, w * (0.72 - 0.06 * z), y - S * 0.05);
          ctx.stroke();
        }
      }
      if (a.redRim && i === 0) {
        ctx.strokeStyle = a.capColor2 || '#C4442E';
        ctx.lineWidth = S * 0.02;
        ctx.beginPath();
        ctx.moveTo(w * 0.66, y + S * 0.03);
        ctx.quadraticCurveTo(w * 0.92, y + S * 0.01, w * 0.72, y - S * 0.09);
        ctx.stroke();
      }
    }
  }

  function drawCup(ctx, a, S) {
    var col = a.capColor, col2 = a.capColor2 || lighten(col, 30);
    var g = ctx.createLinearGradient(0, -S * 0.5, 0, 0);
    g.addColorStop(0, col2);
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-S * 0.42, -S * 0.5);
    ctx.quadraticCurveTo(-S * 0.3, 0, 0, 0);
    ctx.quadraticCurveTo(S * 0.3, 0, S * 0.42, -S * 0.5);
    ctx.quadraticCurveTo(0, -S * 0.32, -S * 0.42, -S * 0.5);
    ctx.closePath();
    ctx.fill();
    if (a.eggs) {
      ctx.fillStyle = lighten(col, 60);
      for (var i = 0; i < a.eggs; i++) {
        var x = (i / (a.eggs - 1 || 1) - 0.5) * S * 0.5;
        ctx.beginPath();
        ctx.ellipse(x, -S * 0.36, S * 0.055, S * 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawStar(ctx, a, S, rnd, rays) {
    var col = a.capColor, col2 = a.capColor2 || lighten(col, 26);
    ctx.fillStyle = col;
    for (var i = 0; i < rays; i++) {
      var ang = (i / rays) * Math.PI * 2;
      var len = S * (0.4 + rnd() * 0.12);
      ctx.save();
      ctx.translate(0, -S * 0.12);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-S * 0.1, 0);
      ctx.lineTo(0, -len);
      ctx.lineTo(S * 0.1, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = col2;
    ctx.beginPath();
    ctx.arc(0, -S * 0.12, S * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = darken(col, 40);
    ctx.beginPath();
    ctx.arc(0, -S * 0.28, S * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTuber(ctx, a, S, rnd) {
    var col = a.capColor, col2 = a.capColor2 || lighten(col, 22);
    var g = ctx.createRadialGradient(-S * 0.1, -S * 0.35, S * 0.05, 0, -S * 0.25, S * 0.45);
    g.addColorStop(0, col2);
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -S * 0.26, S * 0.38, S * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (a.warts) {
      ctx.fillStyle = darken(col, 22);
      for (var i = 0; i < 14; i++) {
        var ang = rnd() * Math.PI * 2, r = rnd() * S * 0.3;
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * r, -S * 0.26 + Math.sin(ang) * r * 0.8, S * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawTentacles(ctx, a, S, rnd, arms) {
    var col = a.capColor, col2 = a.capColor2 || lighten(col, 30);
    for (var i = 0; i < arms; i++) {
      var ang = -Math.PI / 2 + (i - (arms - 1) / 2) * 0.42;
      ctx.strokeStyle = i % 2 ? col2 : col;
      ctx.lineWidth = S * 0.07;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -S * 0.12);
      ctx.quadraticCurveTo(Math.cos(ang) * S * 0.4, -S * 0.6,
                           Math.cos(ang) * S * 0.55, -S * 0.42 + rnd() * S * 0.1);
      ctx.stroke();
    }
  }

  function drawCage(ctx, a, S) {
    var col = a.capColor;
    ctx.strokeStyle = col;
    ctx.lineWidth = S * 0.055;
    ctx.beginPath();
    ctx.ellipse(0, -S * 0.45, S * 0.33, S * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, -S * 0.45, S * 0.33 * (0.3 + i * 0.3), S * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-S * 0.33, -S * 0.45);
    ctx.lineTo(S * 0.33, -S * 0.45);
    ctx.stroke();
  }

  function drawEar(ctx, a, S) {
    var col = a.capColor, col2 = a.capColor2 || lighten(col, 30);
    var g = ctx.createLinearGradient(-S * 0.3, -S * 0.5, S * 0.3, 0);
    g.addColorStop(0, col2);
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-S * 0.36, -S * 0.08);
    ctx.bezierCurveTo(-S * 0.46, -S * 0.55, S * 0.1, -S * 0.68, S * 0.34, -S * 0.36);
    ctx.bezierCurveTo(S * 0.44, -S * 0.16, S * 0.16, -S * 0.02, -S * 0.36, -S * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = S * 0.014;
    ctx.beginPath();
    ctx.moveTo(-S * 0.22, -S * 0.14);
    ctx.quadraticCurveTo(-S * 0.02, -S * 0.42, S * 0.24, -S * 0.32);
    ctx.stroke();
  }

  function drawFrill(ctx, a, S, rnd, tiers) {
    var col = a.capColor, col2 = a.capColor2 || lighten(col, 28);
    for (var i = 0; i < tiers; i++) {
      var y = -S * (0.08 + i * 0.11);
      var w = S * (0.46 - i * 0.03);
      ctx.fillStyle = i % 2 ? col2 : col;
      ctx.beginPath();
      ctx.moveTo(-w, y);
      for (var x = -w; x <= w; x += S * 0.06) {
        ctx.quadraticCurveTo(x + S * 0.03, y - S * 0.09 - rnd() * S * 0.03, x + S * 0.06, y);
      }
      ctx.lineTo(w, y + S * 0.05);
      ctx.lineTo(-w, y + S * 0.05);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawClub(ctx, a, S, rnd, n) {
    var col = a.capColor, col2 = a.capColor2 || lighten(col, 26);
    n = n || 1;
    for (var i = 0; i < n; i++) {
      var x = (i - (n - 1) / 2) * S * 0.18;
      ctx.strokeStyle = i % 2 ? col2 : col;
      ctx.lineWidth = S * 0.075;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x + S * 0.03, -S * 0.35, x + S * 0.02, -S * 0.62);
      ctx.stroke();
    }
    if (a.larva) {                        // the host, half buried
      ctx.fillStyle = a.stipeColor && a.stipeColor !== 'none' ? a.stipeColor : '#C9A46E';
      ctx.beginPath();
      ctx.ellipse(-S * 0.02, S * 0.05, S * 0.2, S * 0.075, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = S * 0.01;
      for (var s = -2; s <= 2; s++) {
        ctx.beginPath();
        ctx.moveTo(s * S * 0.06, S * 0.01);
        ctx.lineTo(s * S * 0.06, S * 0.09);
        ctx.stroke();
      }
    }
  }

  // --- the main entry point --------------------------------------------

  /**
   * Draw one mushroom.
   * @param ctx    canvas 2d context
   * @param sp     species record
   * @param size   height in pixels for a size-1.0 species
   * @param opts   {stage: 'pin'|'young'|'mature', night: bool, glow: 0..1,
   *                bruises: [{x,y,t}], t: seconds for idle motion}
   */
  function draw(ctx, sp, size, opts) {
    opts = opts || {};
    var a = sp.art || {};
    var rnd = seeded(sp.id);
    var grow = opts.stage === 'pin' ? 0.34 : opts.stage === 'young' ? 0.68 : 1;
    // Compress the size range rather than using it raw: a truffle really is
    // a fraction of a giant puffball, but drawn at true ratio it becomes an
    // unreadable speck. Ordering is preserved, extremes are pulled in.
    var relative = 0.58 + 0.42 * (sp.size || 0.7);
    var S = size * relative * grow;
    var shape = a.cap || 'convex';

    ctx.save();

    // Immature caps are paler and rounder, the way a real button is.
    var fade = opts.stage && opts.stage !== 'mature' ? 0.55 : 1;
    if (fade < 1) ctx.globalAlpha = 0.85;

    // Whole-form species take over completely.
    var whole = {
      branch: function () { drawBranching(ctx, a, S, rnd, a.branches || 5, a.jelly); },
      fan: function () { drawShelf(ctx, a, S, rnd, a.tiers || 3); },
      kidney: function () { drawShelf(ctx, a, S, rnd, 2); },
      hoof: function () { drawShelf(ctx, a, S, rnd, 2); },
      lump: function () { drawShelf(ctx, a, S, rnd, 1); },
      frill: function () { drawFrill(ctx, a, S, rnd, a.tiers || 5); },
      cup: function () { drawCup(ctx, a, S); },
      star: function () { drawStar(ctx, a, S, rnd, a.rays || 6); },
      tuber: function () { drawTuber(ctx, a, S, rnd); },
      tentacles: function () { drawTentacles(ctx, a, S, rnd, a.arms || 5); },
      cage: function () { drawCage(ctx, a, S); },
      ear: function () { drawEar(ctx, a, S); },
      club: function () { drawClub(ctx, a, S, rnd, a.cluster || 1); },
      finger: function () { drawClub(ctx, a, S, rnd, a.fingers || 4); },
      blob: function () { drawTuber(ctx, a, S, rnd); },
      tongue: function () { drawShelf(ctx, a, S, rnd, 1); },
      saddle: function () { drawFrill(ctx, a, S, rnd, 2); },
      spoon: function () { drawShelf(ctx, a, S, rnd, 1); },
      brain: function () { drawFrill(ctx, a, S, rnd, 4); },
      honeycomb: null,   // handled by the cap model with a texture
      trumpet: null, ball: null, pear: null
    };
    if (whole[shape]) {
      whole[shape]();
      if (opts.glow && a.glowColor) drawGlow(ctx, a, S, opts.glow);
      ctx.restore();
      return;
    }

    // --- stipe ---------------------------------------------------------
    var capH = S * 0.3, capW = S * 0.4;
    var stipeH = S * (a.fatStipe ? 0.52 : a.slim ? 0.66 : 0.58);
    var stipeW = S * (a.fatStipe ? 0.13 : a.slim ? 0.045 : 0.075);
    var cluster = a.cluster || 1;
    var lean = a.lateral ? 0.35 : 0;

    for (var c = 0; c < cluster; c++) {
      var offX = cluster > 1 ? (rnd() - 0.5) * S * 0.55 : 0;
      var offY = cluster > 1 ? rnd() * S * 0.06 : 0;
      var scale = cluster > 1 ? 0.7 + rnd() * 0.4 : 1;
      var sway = opts.t ? Math.sin(opts.t * 0.8 + c) * 0.02 : 0;

      ctx.save();
      ctx.translate(offX, offY);
      ctx.rotate(sway + lean);
      ctx.scale(scale, scale);

      if (a.stipeColor && a.stipeColor !== 'none' && shape !== 'ball') {
        var sg = ctx.createLinearGradient(-stipeW, 0, stipeW, 0);
        sg.addColorStop(0, darken(a.stipeColor, 26));
        sg.addColorStop(0.4, a.stipeColor);
        sg.addColorStop(1, darken(a.stipeColor, 14));
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(-stipeW, 0);
        ctx.quadraticCurveTo(-stipeW * 0.8, -stipeH * 0.5, -stipeW * 0.72, -stipeH);
        ctx.lineTo(stipeW * 0.72, -stipeH);
        ctx.quadraticCurveTo(stipeW * 0.8, -stipeH * 0.5, stipeW, 0);
        ctx.closePath();
        ctx.fill();

        if (a.snakeStipe) {
          ctx.fillStyle = 'rgba(90,60,40,0.45)';
          for (var k = 0; k < 7; k++) {
            ctx.beginPath();
            ctx.ellipse((k % 2 ? 1 : -1) * stipeW * 0.35, -stipeH * (0.1 + k * 0.12),
                        stipeW * 0.3, stipeH * 0.03, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (a.volvaColor) {                  // the cup at the base
          ctx.fillStyle = a.volvaColor;
          ctx.beginPath();
          ctx.moveTo(-stipeW * 2, 0);
          ctx.quadraticCurveTo(-stipeW * 1.9, -stipeH * 0.22, 0, -stipeH * 0.2);
          ctx.quadraticCurveTo(stipeW * 1.9, -stipeH * 0.22, stipeW * 2, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.lineWidth = S * 0.008;
          ctx.stroke();
        }
        if (a.ringColor) {                   // the skirt left by the veil
          ctx.fillStyle = a.ringColor;
          ctx.beginPath();
          ctx.ellipse(0, -stipeH * 0.72, stipeW * 2.1, S * 0.035, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          ctx.beginPath();
          ctx.ellipse(0, -stipeH * 0.70, stipeW * 2.1, S * 0.02, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (a.veil) drawVeil(ctx, a, S, stipeH, opts);
        if (a.longRoot) {
          ctx.strokeStyle = darken(a.stipeColor, 40);
          ctx.lineWidth = stipeW * 0.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(stipeW * 0.6, S * 0.09, 0, S * 0.16);
          ctx.stroke();
        }
      }

      // --- gills or pores, seen edge-on under the cap ------------------
      if (!CLOSED[shape] && a.stipeColor !== 'none') {
        var under = a.gillColor || a.poreColor ||
          (sp.hymenium === 'pores' ? lighten(a.capColor, 70) : '#F5F0E2');
        ctx.fillStyle = under;
        ctx.beginPath();
        ctx.moveTo(-capW * 0.98, -stipeH + capH * 0.04);
        ctx.quadraticCurveTo(0, -stipeH + capH * 0.3, capW * 0.98, -stipeH + capH * 0.04);
        ctx.quadraticCurveTo(0, -stipeH - capH * 0.1, -capW * 0.98, -stipeH + capH * 0.04);
        ctx.closePath();
        ctx.fill();
        if (sp.hymenium === 'gills' || sp.hymenium === 'ridges') {
          ctx.strokeStyle = 'rgba(0,0,0,' + (a.sparseGills ? 0.22 : 0.13) + ')';
          ctx.lineWidth = S * 0.006;
          var step = a.sparseGills ? 5 : 3;
          for (var gx = -capW * 0.9; gx <= capW * 0.9; gx += capW / 16 * step) {
            ctx.beginPath();
            ctx.moveTo(gx, -stipeH + capH * 0.02);
            ctx.lineTo(gx * 0.35, -stipeH + capH * 0.16);
            ctx.stroke();
          }
        }
      }

      // --- cap ---------------------------------------------------------
      ctx.save();
      ctx.translate(0, -stipeH);
      var col = a.capColor, col2 = a.capColor2 || lighten(col, 26);
      if (fade < 1) {
        col = lighten(col, 26);
        col2 = lighten(col2, 26);
      }
      var cg = ctx.createLinearGradient(-capW, -capH * 1.4, capW * 0.6, capH * 0.2);
      cg.addColorStop(0, col2);
      cg.addColorStop(0.55, col);
      cg.addColorStop(1, darken(a.capColor, 24));
      ctx.fillStyle = cg;
      capPath(ctx, shape, capW, capH);
      ctx.fill();

      if (a.glossy) {                        // wet-looking caps get a highlight
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.ellipse(-capW * 0.32, -capH * 0.95, capW * 0.24, capH * 0.2, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (a.spots) {
        ctx.fillStyle = a.spots === 'pale' ? 'rgba(240,236,220,0.8)' : 'rgba(255,255,255,0.92)';
        for (var s2 = 0; s2 < 9; s2++) {
          var sx = (rnd() - 0.5) * capW * 1.5;
          var sy = -capH * (0.5 + rnd() * 0.85);
          ctx.beginPath();
          ctx.arc(sx, sy, capW * (0.05 + rnd() * 0.045), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (a.scales) {
        ctx.fillStyle = 'rgba(70,50,35,0.34)';
        for (var s3 = 0; s3 < 12; s3++) {
          var px = (rnd() - 0.5) * capW * 1.6, py = -capH * (0.35 + rnd() * 0.95);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(rnd() * 0.6 - 0.3);
          ctx.fillRect(-capW * 0.07, -capH * 0.05, capW * 0.14, capH * 0.1);
          ctx.restore();
        }
      }
      if (a.texture === 'cracks' || a.cracked) {
        ctx.strokeStyle = 'rgba(0,0,0,0.22)';
        ctx.lineWidth = S * 0.008;
        for (var cr = 0; cr < 7; cr++) {
          var cx = (rnd() - 0.5) * capW * 1.5, cy = -capH * (0.4 + rnd() * 0.8);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + (rnd() - 0.5) * capW * 0.3, cy + (rnd() - 0.5) * capH * 0.3);
          ctx.stroke();
        }
      }
      if (shape === 'honeycomb' || a.wrinkle) {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = S * 0.009;
        for (var r2 = 0; r2 < 5; r2++) {
          ctx.beginPath();
          ctx.moveTo(-capW * 0.85, -capH * (0.25 + r2 * 0.3));
          ctx.quadraticCurveTo(0, -capH * (0.45 + r2 * 0.3), capW * 0.85, -capH * (0.25 + r2 * 0.3));
          ctx.stroke();
        }
        for (var v2 = -2; v2 <= 2; v2++) {
          ctx.beginPath();
          ctx.moveTo(capW * 0.3 * v2, -capH * 0.15);
          ctx.lineTo(capW * 0.34 * v2, -capH * 1.5);
          ctx.stroke();
        }
      }
      if (a.striate) {
        ctx.strokeStyle = 'rgba(0,0,0,0.16)';
        ctx.lineWidth = S * 0.006;
        for (var st = -4; st <= 4; st++) {
          ctx.beginPath();
          ctx.moveTo(capW * 0.22 * st, capH * 0.02);
          ctx.lineTo(capW * 0.18 * st, -capH * 0.65);
          ctx.stroke();
        }
      }
      if (a.shaggy) {
        ctx.strokeStyle = 'rgba(150,130,100,0.5)';
        ctx.lineWidth = S * 0.01;
        for (var sh = 0; sh < 14; sh++) {
          var hx = (rnd() - 0.5) * capW * 1.4, hy = -capH * (0.3 + rnd() * 1.4);
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx - capW * 0.06, hy + capH * 0.14);
          ctx.stroke();
        }
      }
      if (a.inkEdge) {
        ctx.fillStyle = 'rgba(25,20,18,0.72)';
        ctx.beginPath();
        ctx.moveTo(-capW * 0.82, -capH * 0.04);
        ctx.quadraticCurveTo(0, capH * 0.3, capW * 0.82, -capH * 0.04);
        ctx.quadraticCurveTo(0, capH * 0.06, -capW * 0.82, -capH * 0.04);
        ctx.closePath();
        ctx.fill();
      }
      if (a.droplets) {
        ctx.fillStyle = a.droplets;
        for (var d2 = 0; d2 < 5; d2++) {
          ctx.beginPath();
          ctx.arc((rnd() - 0.5) * capW * 1.2, -capH * (0.6 + rnd() * 0.7),
                  capW * 0.045, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (a.spines) {
        ctx.strokeStyle = a.capColor2 ? lighten(a.capColor2, 20) : '#EFE4CC';
        ctx.lineWidth = S * 0.012;
        for (var sp2 = -5; sp2 <= 5; sp2++) {
          ctx.beginPath();
          ctx.moveTo(capW * 0.16 * sp2, capH * 0.02);
          ctx.lineTo(capW * 0.16 * sp2, capH * 0.22);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.restore();
    }

    // Bruise marks sit on top of everything, where the finger touched.
    if (opts.bruises && a.bruiseColor) {
      opts.bruises.forEach(function (b) {
        var age = Math.min(1, b.t || 0);
        ctx.globalAlpha = 0.7 * (1 - age);
        ctx.fillStyle = a.bruiseColor;
        ctx.beginPath();
        ctx.arc(b.x, b.y, S * 0.12 * Math.min(1, (b.t || 0) * 4 + 0.3), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
    if (opts.glow && a.glowColor) drawGlow(ctx, a, S, opts.glow);
    if (a.flies && opts.t != null) drawFlies(ctx, S, a.flies, opts.t);

    ctx.restore();
  }

  function drawGlow(ctx, a, S, strength) {
    var g = ctx.createRadialGradient(0, -S * 0.5, 0, 0, -S * 0.5, S * 0.9);
    g.addColorStop(0, a.glowColor);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.8 * strength;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -S * 0.5, S * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  function drawVeil(ctx, a, S, stipeH, opts) {
    var t = opts.t || 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = S * 0.006;
    for (var i = 0; i < 9; i++) {
      var x0 = (i / 8 - 0.5) * S * 0.42;
      var phase = Math.sin(t * 1.2 + i * 0.5) * S * 0.02;
      ctx.beginPath();
      ctx.moveTo(x0 * 0.5, -stipeH * 0.95);
      ctx.quadraticCurveTo(x0 + phase, -stipeH * 0.5, x0 * 1.3 + phase, -stipeH * 0.12);
      ctx.stroke();
    }
    for (var r = 1; r <= 3; r++) {
      ctx.beginPath();
      ctx.moveTo(-S * 0.2 * r / 2, -stipeH * (0.9 - r * 0.22));
      ctx.quadraticCurveTo(0, -stipeH * (0.84 - r * 0.22), S * 0.2 * r / 2, -stipeH * (0.9 - r * 0.22));
      ctx.stroke();
    }
  }

  function drawFlies(ctx, S, n, t) {
    ctx.fillStyle = 'rgba(30,26,22,0.85)';
    for (var i = 0; i < n; i++) {
      var a1 = t * 1.6 + i * 2.1;
      var x = Math.cos(a1) * S * 0.3;
      var y = -S * 0.75 + Math.sin(a1 * 1.7) * S * 0.12;
      ctx.beginPath();
      ctx.arc(x, y, S * 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Render one species to a data URL, for icons and share cards. */
  function toIcon(sp, px, doc) {
    var cv = (doc || document).createElement('canvas');
    cv.width = cv.height = px;
    var c = cv.getContext('2d');
    c.save();
    c.translate(px / 2, px * 0.92);
    draw(c, sp, px * 0.8, { stage: 'mature' });
    c.restore();
    return cv;
  }

  return { draw: draw, toIcon: toIcon, seeded: seeded };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ShroomArt;
