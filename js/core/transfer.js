// Save export and import.
//
// With no account, a save lives in one browser and dies with it. This
// writes the whole save — every key the game owns, not just the main
// one — to a single file the player can carry elsewhere.
//
// The file is encrypted, but the key is in this source, so treat this as
// protection against accidental editing and format confusion, not as
// security. Anyone determined can read it; nothing secret goes in.

var Transfer = (function () {
  var SECRET = 'mushroomId-save-v1';
  var SALT = 'mush-salt-2026';

  function te(s) { return new TextEncoder().encode(s); }

  function key() {
    return crypto.subtle.importKey('raw', te(SECRET), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: te(SALT), iterations: 100000, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  /** Base64 in chunks: spreading a large array blows the stack in Safari. */
  function b64(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(out);
  }
  function unb64(s) {
    var bin = atob(s), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }

  /** Everything the game owns, so a move loses nothing. */
  function collect(cfg) {
    var bag = { magic: cfg.transfer.magic, at: new Date().toISOString(), keys: {} };
    var names = [cfg.storageKey].concat(
      Object.keys(cfg.storageKeys).map(function (k) { return cfg.storageKeys[k]; }));
    names.forEach(function (n) {
      var v = null;
      try { v = localStorage.getItem(n); } catch (e) { v = null; }
      if (v !== null) bag.keys[n] = v;
    });
    return bag;
  }

  function exportSave(cfg) {
    var payload = te(JSON.stringify(collect(cfg)));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return key().then(function (k) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, payload);
    }).then(function (buf) {
      var body = new Uint8Array(buf);
      var out = new Uint8Array(iv.length + body.length);
      out.set(iv, 0);
      out.set(body, iv.length);
      var blob = new Blob([cfg.transfer.magic + '\n' + b64(out)], { type: 'text/plain' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'mushroomid-' + new Date().toISOString().slice(0, 10) + cfg.transfer.ext;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return true;
    });
  }

  function importSave(text, cfg) {
    var nl = text.indexOf('\n');
    if (nl < 0 || text.slice(0, nl).trim() !== cfg.transfer.magic) {
      return Promise.reject(new Error('这不是菌菇图鉴的存档文件'));
    }
    var raw;
    try { raw = unb64(text.slice(nl + 1).trim()); }
    catch (e) { return Promise.reject(new Error('文件已损坏')); }
    if (raw.length < 13) return Promise.reject(new Error('文件已损坏'));

    var iv = raw.subarray(0, 12), body = raw.subarray(12);
    return key().then(function (k) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, k, body);
    }).catch(function () {
      throw new Error('文件无法解密，可能已损坏或来自其他版本');
    }).then(function (buf) {
      var bag;
      try { bag = JSON.parse(new TextDecoder().decode(buf)); }
      catch (e) { throw new Error('存档内容无法解析'); }
      if (!bag || bag.magic !== cfg.transfer.magic || !bag.keys) {
        throw new Error('存档格式不对');
      }
      // Refuse a file whose main save is not even the right shape, rather
      // than half-writing it over a good one.
      var main = bag.keys[cfg.storageKey];
      if (!main) throw new Error('存档里没有游戏进度');
      var parsed;
      try { parsed = JSON.parse(main); } catch (e) { throw new Error('游戏进度已损坏'); }
      if (!parsed || !Array.isArray(parsed.collections)) {
        throw new Error('游戏进度已损坏');
      }
      Object.keys(bag.keys).forEach(function (n) {
        try { localStorage.setItem(n, bag.keys[n]); } catch (e) { /* quota */ }
      });
      return { at: bag.at, collected: parsed.collections.length };
    });
  }

  return { exportSave: exportSave, importSave: importSave, _collect: collect };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Transfer;
