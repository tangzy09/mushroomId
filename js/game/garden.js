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
  var DRAW_SIZE = 140;       // unscaled draw size; depth scales from here

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
      sky.addColorStop(0, '#66755F');
      sky.addColorStop(0.5, '#8A9A80');
      sky.addColorStop(1, '#4B5739');
    } else {
      sky.addColorStop(0, '#8FA85F');
      sky.addColorStop(0.45, '#7B9459');
      sky.addColorStop(1, '#4A5733');
    }
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    var HZ = 0.44;                  // horizon: everything below it is forest floor

    // far trunks, then near trunks — parallax by value, not by motion.
    // Trunks taper and stop at the horizon, so the eye reads depth even
    // though nothing moves.
    function trunks(n, alpha, wid, hue, foot) {
      g.globalAlpha = alpha;
      for (var i = 0; i < n; i++) {
        var x = (i + 0.5) / n * W + (i % 2 ? 18 : -22);
        var top = wid * 0.62, bot = wid;
        // shade across the trunk so it reads as a cylinder, not a stripe
        var tg = g.createLinearGradient(x - bot / 2, 0, x + bot / 2, 0);
        tg.addColorStop(0, 'rgba(0,0,0,0.55)');
        tg.addColorStop(0.38, 'rgba(255,255,255,0.10)');
        tg.addColorStop(1, 'rgba(0,0,0,0.45)');
        g.fillStyle = hue;
        g.beginPath();
        g.moveTo(x - top / 2, 0);
        g.lineTo(x + top / 2, 0);
        g.lineTo(x + bot / 2, H * foot);
        g.lineTo(x - bot / 2, H * foot);
        g.closePath();
        g.fill();
        g.fillStyle = tg;
        g.fill();
      }
      g.globalAlpha = 1;
    }
    trunks(6, night ? 0.30 : 0.24, W * 0.030, night ? '#0A1620' : '#55613F', HZ + 0.02);
    trunks(4, night ? 0.42 : 0.34, W * 0.048, night ? '#091420' : '#47542F', HZ + 0.05);
    trunks(2, night ? 0.62 : 0.52, W * 0.075, night ? '#07111A' : '#39452A', HZ + 0.10);

    // canopy: a leafy mass closing the top, so the upper third carries the
    // forest instead of sitting empty
    var canopy = g.createLinearGradient(0, 0, 0, H * 0.34);
    if (night) {
      canopy.addColorStop(0, '#08131C'); canopy.addColorStop(1, 'rgba(10,22,32,0)');
    } else {
      canopy.addColorStop(0, '#31431F'); canopy.addColorStop(1, 'rgba(70,92,48,0)');
    }
    g.fillStyle = canopy;
    g.fillRect(0, 0, W, H * 0.34);
    // one solid mass with a scalloped underside reads as foliage; scattered
    // ellipses read as lily pads floating in the air
    g.fillStyle = night ? '#0A1620' : '#3B5122';
    g.beginPath();
    g.moveTo(-20, -10);
    g.lineTo(W + 20, -10);
    var lobes = 9, span = (W + 40) / lobes;
    for (var cl = lobes; cl > 0; cl--) {
      var cx2 = -20 + span * cl;
      g.quadraticCurveTo(cx2 - span * 0.5, H * (0.12 + rnd() * 0.09),
                         cx2 - span, H * (0.045 + rnd() * 0.03));
    }
    g.closePath();
    g.fill();
    // a lighter fringe of leaves hanging off it
    g.fillStyle = night ? 'rgba(18,34,26,0.8)' : 'rgba(76,100,44,0.8)';
    for (var lf = 0; lf < 40; lf++) {
      g.beginPath();
      g.ellipse(rnd() * W, H * (0.05 + rnd() * rnd() * 0.13),
                9 + rnd() * 13, 5 + rnd() * 7, rnd(), 0, 6.28);
      g.fill();
    }

    // shafts of light, only when the sun is out
    if (!night && weather === 'sunny') {
      g.globalAlpha = 0.14;
      g.fillStyle = '#FFF6D0';
      for (var s = 0; s < 3; s++) {
        var bx = W * (0.2 + s * 0.3);
        g.beginPath();
        g.moveTo(bx, H * 0.06);
        g.lineTo(bx + W * 0.09, H * 0.06);
        g.lineTo(bx + W * 0.24, H * 0.86);
        g.lineTo(bx - W * 0.04, H * 0.86);
        g.closePath();
        g.fill();
      }
      g.globalAlpha = 1;
    }

    // ground — hazy and pale where it meets the horizon, deep where it meets
    // the viewer, so the floor reads as receding rather than as a green wall
    var gy = H * HZ;
    var gr = g.createLinearGradient(0, gy, 0, H);
    gr.addColorStop(0, night ? '#22321F' : '#6C7C4A');
    gr.addColorStop(0.22, night ? '#1B2A1E' : '#57683A');
    gr.addColorStop(1, night ? '#0D160F' : '#2C391B');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, gy + 10);
    g.quadraticCurveTo(W * 0.5, gy - 14, W, gy + 6);
    g.lineTo(W, H); g.lineTo(0, H);
    g.closePath();
    g.fill();

    // mist gathering at the far end of the floor — the cheapest way to make
    // the trunks read as far away rather than as a flat backdrop
    var mist = g.createLinearGradient(0, gy - H * 0.22, 0, gy + H * 0.05);
    mist.addColorStop(0, night ? 'rgba(120,150,180,0)' : 'rgba(226,236,214,0)');
    mist.addColorStop(0.75, night ? 'rgba(120,150,180,0.18)' : 'rgba(226,236,214,0.40)');
    mist.addColorStop(1, night ? 'rgba(120,150,180,0)' : 'rgba(226,236,214,0)');
    g.fillStyle = mist;
    g.fillRect(0, gy - H * 0.22, W, H * 0.27);

    // undergrowth along the horizon hides the seam between trunks and floor
    g.fillStyle = night ? 'rgba(16,28,20,0.75)' : 'rgba(62,80,42,0.75)';
    for (var u = 0; u < 34; u++) {
      g.beginPath();
      g.ellipse(rnd() * W, gy + 2 + rnd() * H * 0.02,
                12 + rnd() * 22, 5 + rnd() * 8, 0, 0, 6.28);
      g.fill();
    }
    // a few ferns breaking the horizon line
    g.strokeStyle = night ? 'rgba(20,36,24,0.85)' : 'rgba(70,92,44,0.85)';
    g.lineCap = 'round';
    for (var fn = 0; fn < 14; fn++) {
      var fx = rnd() * W, fh = H * (0.025 + rnd() * 0.03);
      g.lineWidth = 2;
      for (var fb = 0; fb < 5; fb++) {
        var ang = -1.9 + fb * 0.48;
        g.beginPath();
        g.moveTo(fx, gy + 6);
        g.quadraticCurveTo(fx + Math.cos(ang) * fh * 0.6, gy + 6 + Math.sin(ang) * fh * 0.8,
                           fx + Math.cos(ang) * fh, gy + 6 + Math.sin(ang) * fh * 0.9);
        g.stroke();
      }
    }

    // leaf litter — smaller and sparser towards the horizon
    for (var l = 0; l < 150; l++) {
      var q = rnd();
      var ly = gy + 6 + q * q * (H - gy - 6);          // bunched near the viewer
      var lx = rnd() * W;
      var k = 0.4 + 0.75 * ((ly - gy) / (H - gy));
      g.fillStyle = night ? 'rgba(40,55,38,0.7)' : ['#6B7A3E', '#7E8B48', '#8E7A3C', '#5E6B33'][l % 4];
      g.save();
      g.translate(lx, ly);
      g.rotate(rnd() * 3.14);
      g.beginPath();
      g.ellipse(0, 0, (7 + rnd() * 5) * k, (3 + rnd() * 2) * k, 0, 0, 6.28);
      g.fill();
      g.restore();
    }

    /**
     * A fallen log whose top surface lands on `top`, sized by depth `k`.
     * Drawn as a lying cylinder: flat top line, elliptical end, bark running
     * lengthways. The earlier blobby outline read as a mound of earth.
     */
    function fallenLog(cx, top, w, k) {
      var lh = H * 0.052 * k;                 // trunk diameter on screen
      var lx0 = cx - w / 2, ly0 = top;        // ly0 is the top of the trunk
      var rx = lh * 0.30;                     // half-width of the end ellipse

      var lg = g.createLinearGradient(0, ly0, 0, ly0 + lh);
      lg.addColorStop(0, night ? '#453A2E' : '#8B7253');
      lg.addColorStop(0.45, night ? '#332B22' : '#6B5740');
      lg.addColorStop(1, night ? '#1E1913' : '#42351F');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(lx0, ly0);
      g.lineTo(lx0 + w, ly0 - lh * 0.10);           // the far end lifts slightly
      g.quadraticCurveTo(lx0 + w + rx, ly0 + lh * 0.45, lx0 + w, ly0 + lh * 0.92);
      g.lineTo(lx0, ly0 + lh);
      g.closePath();
      g.fill();

      // bark running lengthways
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      g.lineWidth = Math.max(1, 1.4 * k);
      for (var bk = 1; bk <= 3; bk++) {
        var byk = ly0 + lh * (bk / 4);
        g.beginPath();
        g.moveTo(lx0 + w * 0.06, byk);
        g.quadraticCurveTo(lx0 + w * 0.5, byk - lh * 0.06, lx0 + w * 0.94, byk - lh * 0.08);
        g.stroke();
      }

      // end grain, facing the viewer
      g.fillStyle = night ? '#4A3E30' : '#9A8060';
      g.beginPath();
      g.ellipse(lx0, ly0 + lh * 0.5, rx, lh * 0.52, 0, 0, 6.28);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.28)';
      g.lineWidth = 1;
      for (var r = 1; r <= 3; r++) {
        g.beginPath();
        g.ellipse(lx0, ly0 + lh * 0.5, rx * r / 3.6, lh * 0.52 * r / 3.6, 0, 0, 6.28);
        g.stroke();
      }

      // moss along the top edge
      g.fillStyle = night ? 'rgba(40,70,45,0.6)' : 'rgba(112,152,68,0.6)';
      for (var m = 0; m < 22; m++) {
        var mt = rnd();
        g.beginPath();
        g.ellipse(lx0 + mt * w, ly0 - lh * 0.10 * mt + rnd() * lh * 0.22,
                  (4 + rnd() * 7) * k, (2 + rnd() * 2) * k, 0, 0, 6.28);
        g.fill();
      }
    }

    /** A standing stump — the perch for bracket fungi. */
    function stump(cx, base, w, k) {
      var h = H * 0.16 * k, x0 = cx - w / 2, y0 = base - h;
      var sg = g.createLinearGradient(x0, 0, x0 + w, 0);
      sg.addColorStop(0, night ? '#231D17' : '#5C4A34');
      sg.addColorStop(0.45, night ? '#3A3027' : '#7B6449');
      sg.addColorStop(1, night ? '#1D1813' : '#4A3B29');
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(x0, base);
      g.lineTo(x0 + w * 0.10, y0);
      g.lineTo(x0 + w * 0.90, y0);
      g.lineTo(x0 + w, base);
      g.closePath();
      g.fill();
      g.fillStyle = night ? '#4A3E30' : '#8E7452';
      g.beginPath();
      g.ellipse(cx, y0, w * 0.40, w * 0.13, 0, 0, 6.28);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.22)';
      g.lineWidth = 1;
      for (var rr = 1; rr <= 3; rr++) {
        g.beginPath();
        g.ellipse(cx, y0, w * 0.40 * rr / 3.6, w * 0.13 * rr / 3.6, 0, 0, 6.28);
        g.stroke();
      }
    }

    // Two logs and a stump, one per slot band, so every wood slot has
    // something under it instead of floating on bare litter.
    fallenLog(W * 0.36, H * 0.545, W * 0.32, 0.62);
    stump(W * 0.66, H * 0.545, W * 0.13, 0.62);
    fallenLog(W * 0.535, H * 0.712, W * 0.46, 1);
    return c;
  }

  // --- items -------------------------------------------------------------

  /** Draw scale for a slot: the further up the slope it sits, the smaller. */
  function depthOf(y) {
    var d = cfg.garden.depth;
    var k = (y - d.yFar) / (d.yNear - d.yFar);
    return d.far + (d.near - d.far) * Math.max(0, Math.min(1, k));
  }

  /** How far above its base a species is drawn, at this garden's draw size. */
  function topOf(sp) {
    return ShroomArt.heightOf(sp) * DRAW_SIZE;
  }

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
        x: slot.x * W, y: slot.y * H, depth: depthOf(slot.y),
        top: topOf(sp), footprint: 44 * (0.58 + 0.42 * (sp.size || 0.7)),
        bruises: [], react: 0, puff: [], bubble: 0, wet: 0
      });
    });
    items.sort(function (a, b) { return a.y - b.y; });
  }

  // --- interaction --------------------------------------------------------

  function hit(px, py) {
    var best = null, bestD = 1e9;
    items.forEach(function (it) {
      // the drawn size is what the finger aims at, so the target follows depth
      var r = Math.max(26, 54 * (0.6 + (it.sp.size || 0.7) * 0.5) * it.depth);
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
    items.forEach(function (it) {
      it.react = 0.6;
      it.wet = 240;                 // watering counts as rain for a while
    });
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
      var depth = it.depth;
      var glow = night && it.sp.art.glowColor ?
        0.75 + 0.25 * Math.sin(t * 2 + it.x) : 0;

      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.scale(depth, depth);

      // contact shadow: without it every mushroom looks pasted onto the
      // background instead of standing on the forest floor
      var gsz = g.drawStage === 'pin' ? 0.34 : g.drawStage === 'young' ? 0.68 : 1;
      ctx.fillStyle = night ? 'rgba(0,0,0,0.34)' : 'rgba(22,32,14,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 2, it.footprint * gsz, it.footprint * gsz * 0.28, 0, 0, 6.28);
      ctx.fill();

      if (it.react > 0) {
        var k = 1 + Math.sin(it.react * 9) * 0.06 * it.react;
        ctx.scale(1, k);
      }
      it.bruises.forEach(function (b) { b.t += dt * 0.18; });
      it.bruises = it.bruises.filter(function (b) { return b.t < 1; });

      ShroomArt.draw(ctx, it.sp, DRAW_SIZE, {
        stage: g.drawStage,
        glow: glow,
        bruises: it.bruises,
        // hygroscopic species read the weather: splayed after rain,
        // curled shut in the sun
        open: it.sp.behavior === 'hygro'
          ? (weather === 'rain' || weather === 'rainAfter' || it.wet > 0 ? 1 : 0.15)
          : 1,
        t: windy ? t * 3 : t
      });

      // A sporulating slot keeps shedding a slow trickle, so the state is
      // legible from across the garden and not only from its badge.
      if (g.sporeReady && rnd() < dt * 6) {
        it.puff.push({
          x: (rnd() - 0.5) * 24, y: -it.top * 0.55,
          vx: (rnd() - 0.5) * 14, vy: -8 - rnd() * 10,
          life: 1.6 + rnd() * 0.8
        });
      }

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
        // ride just above this species' own silhouette; a fixed offset left
        // the badge floating in mid-air over the short ones
        var bx0 = it.x + 26 * depth;
        var by = it.y - it.top * depth + Math.sin(t * 2.2) * 3;
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.arc(bx0, by + 1.5, 8, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = '#E0B400';
        ctx.beginPath();
        ctx.arc(bx0, by, 7, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = '#2A2314';
        ctx.font = 'bold 9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('孢', bx0, by + 3);
      }

      // name bubble after a tap
      if (it.bubble > 0) {
        it.bubble -= dt;
        // Tell the player what this slot is waiting for: the next stage while
        // it grows, the next spore once it is grown, nothing once it is ready
        // because the badge already says so.
        var tail;
        if (g.sporeReady) tail = ' · ' + g.label + ' · 点一下收走';
        else if (!g.mature) tail = ' · ' + g.label +
          (g.minutesLeft != null ? ' · 还差 ' + World.humanMinutes(g.minutesLeft) : '');
        else tail = ' · 下一个孢子还差 ' + World.humanMinutes(g.sporeMinutesLeft);
        var label = it.sp.name + tail;
        ctx.font = '12px system-ui,sans-serif';
        var tw = ctx.measureText(label).width + 16;
        var bx = Math.max(4, Math.min(W - tw - 4, it.x - tw / 2));
        var byy = it.y - (it.top + 30) * depth;
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
      if (it.wet > 0) it.wet -= dt;
    });

    // After dark the backdrop went dark but the mushrooms stayed lit, which
    // read as daytime cut-outs pasted on a night scene. Tint everything, then
    // let the bioluminescent ones burn back through — that contrast is the
    // whole point of the glow species.
    if (night) {
      ctx.fillStyle = 'rgba(10,22,42,0.44)';
      ctx.fillRect(0, 0, W, H);
      items.forEach(function (it) {
        var gc = it.sp.art.glowColor;
        if (!gc) return;
        var cy = it.y - it.top * it.depth * 0.55;
        var r = Math.max(20, it.top * it.depth * 0.95);
        var rg = ctx.createRadialGradient(it.x, cy, 0, it.x, cy, r);
        rg.addColorStop(0, gc);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.30 + 0.22 * Math.sin(t * 2 + it.x);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(it.x, cy, r, 0, 6.28);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

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
    /** A spore was just taken from this slot: give the eye something. */
    harvested: function (it) {
      it.react = 1;
      puff(it);
    },
    onTap: function (fn) { onTap = fn; },
    start: function () { if (!raf) { loop._last = null; loop(); } },
    stop: function () { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  };
})();
