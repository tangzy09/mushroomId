// Share cards. Rendered at 2x for retina, handed to the native share
// sheet where there is one, downloaded otherwise.
//
// Every card carries the safety footer from config, and nothing draws it
// optionally: the footer is part of the layout, not a decoration.

var Share = (function () {
  var DPR = 2;

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w * DPR;
    c.height = h * DPR;
    var x = c.getContext('2d');
    x.scale(DPR, DPR);
    return { el: c, ctx: x, w: w, h: h };
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

  /** Wrap text to a width, returning the y after the last line. */
  function wrap(c, text, x, y, maxW, lh, align) {
    c.textAlign = align || 'center';
    var line = '', out = [];
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (c.measureText(test).width > maxW && line) {
        out.push(line);
        line = text[i];
      } else line = test;
    }
    if (line) out.push(line);
    out.forEach(function (l, i) { c.fillText(l, x, y + i * lh); });
    return y + out.length * lh;
  }

  function backdrop(c, w, h, cfg) {
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, cfg.share.bg[0]);
    g.addColorStop(1, cfg.share.bg[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }

  function footer(c, w, h, cfg) {
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.font = '11px system-ui,sans-serif';
    c.textAlign = 'center';
    c.fillText(cfg.share.footer, w / 2, h - 26);
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.fillText(cfg.siteUrl.replace(/^https?:\/\//, ''), w / 2, h - 11);
  }

  /**
   * A single entity card.
   * @param entity  the species record
   * @param cfg     GameConfig
   * @param drawArt function(ctx, entity, size) — the renderer
   */
  function entityCard(entity, cfg, drawArt) {
    var W = 480, H = 620;
    var k = canvas(W, H), c = k.ctx;
    backdrop(c, W, H, cfg);

    var rarity = cfg.entity.rarity(entity);
    var edib = cfg.edibility[entity.edibility];
    var deadly = entity.edibility === 'deadly';

    // rarity ribbon
    c.fillStyle = cfg.rarityColors[rarity];
    roundRect(c, W / 2 - 74, 34, 148, 30, 15);
    c.fill();
    c.fillStyle = rarity === 'legend' ? '#3A2E00' : '#fff';
    c.font = 'bold 15px system-ui,sans-serif';
    c.textAlign = 'center';
    c.fillText(cfg.rarityLabels[rarity], W / 2, 54);

    // the specimen
    c.save();
    c.translate(W / 2, 300);
    drawArt(c, entity, 230);
    c.restore();

    c.fillStyle = '#fff';
    c.font = 'bold 30px system-ui,sans-serif';
    c.fillText(entity.name, W / 2, 356);

    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.font = 'italic 15px system-ui,sans-serif';
    c.fillText(entity.latin, W / 2, 380);

    // edibility, always with its note — the label never travels alone
    c.fillStyle = edib.color;
    roundRect(c, W / 2 - 62, 398, 124, 26, 13);
    c.fill();
    c.fillStyle = '#fff';
    c.font = 'bold 13px system-ui,sans-serif';
    c.fillText(edib.label, W / 2, 416);

    c.fillStyle = 'rgba(255,255,255,0.72)';
    c.font = '13px system-ui,sans-serif';
    var y = wrap(c, edib.note, W / 2, 446, W - 90, 20);

    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.font = '14px system-ui,sans-serif';
    wrap(c, deadly ? '记住它的样子，别碰它。' : '「' + entity.quote + '」',
         W / 2, y + 16, W - 80, 22);

    footer(c, W, H, cfg);
    return k.el;
  }

  /** The collection scene, with a count. */
  function sceneCard(sourceCanvas, cfg, caption) {
    var W = 480, H = 420;
    var k = canvas(W, H), c = k.ctx;
    backdrop(c, W, H, cfg);
    if (sourceCanvas) {
      var ih = W * (sourceCanvas.height / sourceCanvas.width);
      c.drawImage(sourceCanvas, 0, 20, W, Math.min(ih, 320));
    }
    c.fillStyle = '#fff';
    c.font = 'bold 17px system-ui,sans-serif';
    c.textAlign = 'center';
    c.fillText(caption, W / 2, 372);
    footer(c, W, H, cfg);
    return k.el;
  }

  /** Milestone card. */
  function milestoneCard(milestone, total, cfg) {
    var W = 480, H = 320;
    var k = canvas(W, H), c = k.ctx;
    backdrop(c, W, H, cfg);
    c.textAlign = 'center';
    c.font = '58px system-ui,sans-serif';
    c.fillText(milestone.icon, W / 2, 108);
    c.fillStyle = '#fff';
    c.font = 'bold 28px system-ui,sans-serif';
    c.fillText(milestone.title, W / 2, 160);
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.font = '16px system-ui,sans-serif';
    c.fillText('已经认识 ' + milestone.n + ' / ' + total + ' 种菌子', W / 2, 194);
    footer(c, W, H, cfg);
    return k.el;
  }

  /**
   * Offer the card to the platform: the native share sheet when it takes
   * files, a download otherwise.
   */
  function offer(cv, cfg, text) {
    return new Promise(function (resolve) {
      cv.toBlob(function (blob) {
        if (!blob) { resolve('failed'); return; }
        var file = new File([blob], cfg.share.fileName, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], text: text })
            .then(function () { resolve('shared'); })
            .catch(function () { resolve('cancelled'); });
          return;
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = cfg.share.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        resolve('downloaded');
      }, 'image/png');
    });
  }

  return {
    entityCard: entityCard,
    sceneCard: sceneCard,
    milestoneCard: milestoneCard,
    offer: offer
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Share;
