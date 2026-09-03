// The garden: a side-on slice of forest with a fallen log in the middle.
//
// fishId's tank draws motion; mushrooms barely move, so this draws time
// instead — growth stages, weather, day and night, and reactions that
// only happen when you touch something.

var Garden = (function () {
  var cv, ctx, raf = null, W = 0, H = 0, dpr = 1;
  var cfg, species = {}, state = null;
  var t = 0, night = false, manualNight = false, weather = 'sunny';
  var items = [];            // one per planted slot
  var leaves = [], rain = [], fireflies = [], bugs = [], drops = [];
  var windUntil = 0;
  var onTap = null;
  var bg = null;             // cached static backdrop

  function rnd() { return Math.random(); }

  function resize() {
    if (!cv) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    var r = cv.getBoundingClientRect();
    W = Math.max(320, r.width);
    H = Math.max(220, r.height);
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bg = null;
    seedAmbience();
  }

  function seedAmbience() {
    leaves = [];
    fireflies = [];
    for (var i = 0; i < 22; i++) {
      fireflies.push({ x: rnd() * W, y: H * (0.3 + rnd() * 0.55), p: rnd() * 6.28, s: 0.3 + rnd() * 0.5 });
    }
    rain = [];
    for (var j = 0; j < 110; j++) {
      rain.push({ x: rnd() * W, y: rnd() * H, v: 480 + rnd() * 260, l: 10 + rnd() * 10 });
    }
  }

  // --- backdrop ---------------------------------------------------------

  function paintBackdrop() {
    var c = document.createElement('canvas');
    c.width = W * dpr; c.height = H * dpr;
    var g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    var sky = g.createLinearGradient(0, 0, 0, H);
    if (night) {
      sky.addColorStop(0, '#0B1B2B');
      sky.addColorStop(0.55, '#12293D');
      sky.addColorStop(1, '#16241C');
    } else if (weather === 'rain' || weather === 'cloudy') {
      sky.addColorStop(0, '#8FA08C');
      sky.addColorStop(0.5, '#A8B79E');
      sky.addColorStop(1, '#5E6B4A');
    } else {
      sky.addColorStop(0, '#BBD08F');
      sky.addColorStop(0.45, '#93AE73');
      sky.addColorStop(1, '#59683F');
    }
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    // far trunks, then near trunks — parallax by value, not by motion
    function trunks(n, alpha, wid, hue) {
      g.fillStyle = hue;
      g.globalAlpha = alpha;
      for (var i = 0; i < n; i++) {
        var x = (i + 0.5) / n * W + (i % 2 ? 18 : -22);
        g.fillRect(x - wid / 2, 0, wid, H * 0.78);
      }
      g.globalAlpha = 1;
    }
    trunks(5, night ? 0.35 : 0.28, W * 0.035, night ? '#0A1620' : '#4E5B3A');
    trunks(3, night ? 0.5 : 0.42, W * 0.055, night ? '#08111A' : '#3D4A2C');

    // shafts of light, only when the sun is out
    if (!night && weather === 'sunny') {
      g.globalAlpha = 0.14;
      g.fillStyle = '#FFF6D0';
      for (var s = 0; s < 3; s++) {
        var bx = W * (0.2 + s * 0.3);
        g.beginPath();
        g.moveTo(bx, 0);
        g.lineTo(bx + W * 0.09, 0);
        g.lineTo(bx + W * 0.20, H * 0.8);
        g.lineTo(bx - W * 0.02, H * 0.8);
        g.closePath();
        g.fill();
      }
      g.globalAlpha = 1;
    }

    // ground
    var gy = H * 0.66;
    var gr = g.createLinearGradient(0, gy, 0, H);
    gr.addColorStop(0, night ? '#1B2A1E' : '#4E6136');
    gr.addColorStop(1, night ? '#101A12' : '#33421F');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, gy + 10);
    g.quadraticCurveTo(W * 0.5, gy - 14, W, gy + 6);
    g.lineTo(W, H); g.lineTo(0, H);
    g.closePath();
    g.fill();

    // leaf litter
    for (var l = 0; l < 70; l++) {
      var lx = rnd() * W, ly = gy + 8 + rnd() * (H - gy - 8);
      g.fillStyle = night ? 'rgba(40,55,38,0.7)' : ['#6B7A3E', '#7E8B48', '#8E7A3C', '#5E6B33'][l % 4];
      g.save();
      g.translate(lx, ly);
      g.rotate(rnd() * 3.14);
      g.beginPath();
      g.ellipse(0, 0, 7 + rnd() * 5, 3 + rnd() * 2, 0, 0, 6.28);
      g.fill();
      g.restore();
    }

    // the fallen log, centre stage
    var lw = W * 0.34, lh = H * 0.085, lx0 = W * 0.33, ly0 = H * 0.60;
    var lg = g.createLinearGradient(0, ly0, 0, ly0 + lh);
    lg.addColorStop(0, night ? '#3A3128' : '#7A6449');
    lg.addColorStop(1, night ? '#241E18' : '#4E3F2C');
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(lx0, ly0 + lh);
    g.quadraticCurveTo(lx0 + lw * 0.5, ly0 - lh * 0.35, lx0 + lw, ly0 + lh * 0.85);
    g.lineTo(lx0 + lw, ly0 + lh * 1.5);
    g.quadraticCurveTo(lx0 + lw * 0.5, ly0 + lh * 1.9, lx0, ly0 + lh * 1.6);
    g.closePath();
    g.fill();
    // end grain
    g.fillStyle = night ? '#4A3E30' : '#8E7452';
    g.beginPath();
    g.ellipse(lx0 + 2, ly0 + lh * 1.15, lh * 0.34, lh * 0.62, 0, 0, 6.28);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1;
    for (var r = 1; r <= 3; r++) {
      g.beginPath();
      g.ellipse(lx0 + 2, ly0 + lh * 1.15, lh * 0.34 * r / 3.4, lh * 0.62 * r / 3.4, 0, 0, 6.28);
      g.stroke();
    }
    // moss on top of the log
    g.fillStyle = night ? 'rgba(40,70,45,0.55)' : 'rgba(110,150,70,0.55)';
    for (var m = 0; m < 26; m++) {
      var mx = lx0 + rnd() * lw;
      g.beginPath();
      g.ellipse(mx, ly0 + lh * 0.15 + rnd() * 6, 5 + rnd() * 7, 2.5 + rnd() * 2, 0, 0, 6.28);
      g.fill();
    }
    return c;
  }

  // --- items -------------------------------------------------------------

  function rebuild() {
    items = [];
    var placed = state.slots || [];
    placed.forEach(function (rec) {
      var sp = species[rec.id];
      if (!sp) return;
      var slot = null;
      cfg.garden.slots.forEach(function (s) { if (s.id === rec.slot) slot = s; });
      if (!slot) slot = cfg.garden.slots[0];
      items.push({
        rec: rec, sp: sp, slot: slot,
        x: slot.x * W, y: slot.y * H,
        bruises: [], react: 0, puff: [], bubble: 0
      });
    });
    items.sort(function (a, b) { return a.y - b.y; });
  }

  // --- interaction --------------------------------------------------------

  function hit(px, py) {
    var best = null, bestD = 1e9;
    items.forEach(function (it) {
      var r = 54 * (0.6 + (it.sp.size || 0.7) * 0.5);
      var dx = px - it.x, dy = py - (it.y - r * 0.5);
      var d = dx * dx + dy * dy;
      if (d < r * r && d < bestD) { bestD = d; best = it; }
    });
    return best;
  }

  function tap(px, py) {
    var it = hit(px, py);
    if (!it) {
      // nothing there: startle a few small things out of the litter
      for (var i = 0; i < 3 + Math.floor(rnd() * 2); i++) {
        bugs.push({ x: px, y: py, vx: (rnd() - 0.5) * 90, vy: -60 - rnd() * 70, life: 0.7 });
      }
      return null;
    }
    it.react = 1;
    it.bubble = 2.6;
    var b = it.sp.behavior;
    if (b === 'puff') puff(it);
    if (b === 'bruise' && it.sp.art.bruiseColor) {
      it.bruises.push({ x: px - it.x, y: py - it.y, t: 0 });
      if (it.bruises.length > 6) it.bruises.shift();
    }
    if (b === 'ink') {
      for (var d = 0; d < 4; d++) {
        drops.push({ x: it.x + (rnd() - 0.5) * 26, y: it.y - 30, vy: 40 + rnd() * 40, life: 1.4 });
      }
    }
    if (b === 'splash') puff(it, 1);
    if (onTap) onTap(it.sp, it);
    return it;
  }

  function puff(it, few) {
    var n = few ? 6 : 40 + Math.floor(rnd() * 30);
    for (var i = 0; i < n; i++) {
      var ang = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
      var sp = 60 + rnd() * 90;
      it.puff.push({
        x: 0, y: -34, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 1.2 + rnd() * 0.5
      });
    }
  }

  /** Wind: leaves fly, puffballs release, everything sways. */
  function gust() {
    windUntil = t + 2.2;
    for (var i = 0; i < 70; i++) {
      leaves.push({
        x: W + rnd() * W * 0.4, y: rnd() * H * 0.5,
        vx: -(120 + rnd() * 120), vy: 30 + rnd() * 50,
        r: rnd() * 6.28, vr: (rnd() - 0.5) * 4, life: 3
      });
    }
    items.forEach(function (it) {
      if (it.sp.behavior === 'puff') puff(it);
    });
  }

  function water() {
    for (var i = 0; i < 60; i++) {
      drops.push({ x: rnd() * W, y: -rnd() * 40, vy: 260 + rnd() * 160, life: 1.6, water: true });
    }
    items.forEach(function (it) { it.react = 0.6; });
  }

  // --- draw ---------------------------------------------------------------

  function frame(dt) {
    if (!bg) bg = paintBackdrop();
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bg, 0, 0, W, H);

    var windy = t < windUntil;

    // rain
    if (weather === 'rain' || weather === 'rainAfter') {
      ctx.strokeStyle = night ? 'rgba(150,180,210,0.30)' : 'rgba(230,240,255,0.35)';
      ctx.lineWidth = 1;
      var n = weather === 'rain' ? rain.length : Math.floor(rain.length * 0.25);
      for (var i = 0; i < n; i++) {
        var d = rain[i];
        d.y += d.v * dt;
        if (d.y > H) { d.y = -20; d.x = rnd() * W; }
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 2, d.y + d.l);
        ctx.stroke();
      }
    }

    // mushrooms, far to near
    items.forEach(function (it) {
      var g = World.growth(it.rec, cfg.garden);
      var depth = 0.85 + 0.35 * ((it.slot.y - 0.6) / 0.3);
      var glow = night && it.sp.art.glowColor ?
        0.75 + 0.25 * Math.sin(t * 2 + it.x) : 0;

      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.scale(depth, depth);
      if (it.react > 0) {
        var k = 1 + Math.sin(it.react * 9) * 0.06 * it.react;
        ctx.scale(1, k);
      }
      it.bruises.forEach(function (b) { b.t += dt * 0.18; });
      it.bruises = it.bruises.filter(function (b) { return b.t < 1; });

      ShroomArt.draw(ctx, it.sp, 140, {
        stage: g.stage,
        glow: glow,
        bruises: it.bruises,
        t: windy ? t * 3 : t
      });

      // spore particles rising off this mushroom
      it.puff = it.puff.filter(function (p) { return p.life > 0; });
      ctx.fillStyle = night ? 'rgba(200,210,190,0.6)' : 'rgba(120,100,70,0.55)';
      it.puff.forEach(function (p) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 46 * dt;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, 6.28);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.restore();

      // a ready spore is the reason to come back, so it has to be visible
      if (g.sporeReady) {
        var by = it.y - 96 * depth + Math.sin(t * 2.2) * 3;
        ctx.fillStyle = '#E0B400';
        ctx.beginPath();
        ctx.arc(it.x + 24, by, 7, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = '#2A2314';
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('孢', it.x + 24, by + 3);
      }

      // name bubble after a tap
      if (it.bubble > 0) {
        it.bubble -= dt;
        var label = it.sp.name + (g.mature ? '' : ' · ' + g.label +
          (g.minutesLeft != null ? ' · 还差 ' + World.humanMinutes(g.minutesLeft) : ''));
        ctx.font = '12px system-ui,sans-serif';
        var tw = ctx.measureText(label).width + 16;
        var bx = Math.max(4, Math.min(W - tw - 4, it.x - tw / 2));
        var byy = it.y - 120 * depth;
        ctx.globalAlpha = Math.min(1, it.bubble);
        ctx.fillStyle = 'rgba(20,26,18,0.82)';
        roundRect(ctx, bx, byy, tw, 22, 6);
        ctx.fill();
        ctx.fillStyle = '#F3F4EC';
        ctx.textAlign = 'left';
        ctx.fillText(label, bx + 8, byy + 15);
        ctx.globalAlpha = 1;
      }
      if (it.react > 0) it.react = Math.max(0, it.react - dt * 1.6);
    });

    // falling leaves
    leaves = leaves.filter(function (l) { return l.life > 0 && l.x > -40; });
    leaves.forEach(function (l) {
      l.life -= dt;
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      l.r += l.vr * dt;
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.r);
      ctx.fillStyle = night ? 'rgba(90,110,70,0.7)' : 'rgba(190,160,60,0.85)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 3.2, 0, 0, 6.28);
      ctx.fill();
      ctx.restore();
    });

    // water and ink drops
    drops = drops.filter(function (d) { return d.life > 0; });
    drops.forEach(function (d) {
      d.life -= dt;
      d.y += d.vy * dt;
      ctx.fillStyle = d.water ? 'rgba(170,215,240,0.75)' : 'rgba(25,20,18,0.8)';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.water ? 1.6 : 2.4, d.water ? 5 : 3.4, 0, 0, 6.28);
      ctx.fill();
    });

    // startled small things
    bugs = bugs.filter(function (b) { return b.life > 0; });
    ctx.fillStyle = 'rgba(30,26,22,0.85)';
    bugs.forEach(function (b) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 260 * dt;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.4, 0, 6.28);
      ctx.fill();
    });

    // fireflies, only after dark
    if (night) {
      fireflies.forEach(function (f) {
        f.p += dt * f.s;
        var a = (Math.sin(f.p) + 1) / 2;
        f.x += Math.sin(f.p * 0.7) * 12 * dt;
        f.y += Math.cos(f.p * 0.5) * 8 * dt;
        ctx.globalAlpha = 0.15 + a * 0.6;
        ctx.fillStyle = '#D8FF9A';
        ctx.beginPath();
        ctx.arc(f.x, f.y, 2.2, 0, 6.28);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function loop() {
    var now = performance.now() / 1000;
    var dt = Math.min(0.05, now - (loop._last || now));
    loop._last = now;
    t += dt;
    frame(dt);
    raf = requestAnimationFrame(loop);
  }

  return {
    init: function (canvas, config, speciesById, gameState) {
      cv = canvas;
      ctx = cv.getContext('2d');
      cfg = config;
      species = speciesById;
      state = gameState;
      window.addEventListener('resize', function () { resize(); rebuild(); });
      resize();
      rebuild();
      this.autoNight();
      return this;
    },
    refresh: function (gameState) {
      if (gameState) state = gameState;
      rebuild();
    },
    setWeather: function (w) { weather = w; bg = null; },
    autoNight: function () {
      if (manualNight) return;
      var h = new Date().getHours();
      var n = h >= 19 || h < 6;
      if (n !== night) { night = n; bg = null; }
    },
    toggleNight: function () {
      manualNight = true;
      night = !night;
      bg = null;
      return night;
    },
    isNight: function () { return night; },
    tap: tap,
    gust: gust,
    water: water,
    onTap: function (fn) { onTap = fn; },
    start: function () { if (!raf) { loop._last = null; loop(); } },
    stop: function () { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  };
})();
