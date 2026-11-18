(() => {
  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  // seeded random so a wallpaper looks the same at any resolution
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // blend two #rrggbb colours (t = 0 gives a, t = 1 gives b)
  function mix(a, b, t) {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((x >> sh) & 255) * (1 - t) + ((y >> sh) & 255) * t);
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  }

  // ---------- surfaces ----------
  const PRESETS = {
    white:    { name: 'Blank white',    bg: ['#ecebe6', '#f7f6f2'], stains: ['#9c9a90', '#c9c6b8', '#6e6c63', '#3a3935'], light: '#1a1918' },
    black:    { name: 'Pure black',     bg: ['#050505', '#0f0f0f'], stains: ['#2a2a2a', '#444444', '#111111', '#1c1c1c'], light: '#e6e6e6' },
    rust:     { name: 'Rust belt',      bg: ['#2b2724', '#3b2f27'], stains: ['#8a3b17', '#b5561f', '#4a2312', '#1a1512'], light: '#d8c9a8' },
    mildew:   { name: 'Basement mildew', bg: ['#1f2420', '#2d3328'], stains: ['#5d6b3a', '#7e8a4b', '#1b2118', '#3b3f2c'], light: '#cfd2b4' },
    concrete: { name: 'Wet concrete',   bg: ['#4a4a47', '#5b5a56'], stains: ['#2b2b29', '#7a786f', '#33322f', '#9a9689'], light: '#e8e4d6' },
    bruise:   { name: 'Bruise',         bg: ['#1d1620', '#2b1d2e'], stains: ['#5a2a4f', '#7a3b2e', '#14101a', '#3d2a5a'], light: '#d9c3d6' },
    xerox:    { name: 'Bad photocopy',  bg: ['#d9d3c2', '#c9c2ae'], stains: ['#141312', '#8d8670', '#3a3732', '#a9a28b'], light: '#141312' },
    toxic:    { name: 'Toxic spill',    bg: ['#141612', '#1d2214'], stains: ['#a6c22a', '#6b8f14', '#0b0d08', '#d6e04a'], light: '#e6f08a' }
  };

  // ---------- the wallpaper painter ----------
  function render(ctx, w, h, p, o) {
    const r = rng(o.seed);
    const s = w / 1280;

    // base: the user's picture (cover-fit) or the generated gradient
    if (o.img) {
      const k = Math.max(w / o.img.width, h / o.img.height);
      const iw = o.img.width * k, ih = o.img.height * k;
      ctx.drawImage(o.img, (w - iw) / 2, (h - ih) / 2, iw, ih);
      r(); // keep the random sequence consistent
    } else {
      const g = ctx.createLinearGradient(0, 0, w * r(), h);
      g.addColorStop(0, p.bg[0]);
      g.addColorStop(1, p.bg[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // stains
    for (let i = 0; i < 30; i++) {
      const x = r() * w, y = r() * h, rad = (80 + r() * 320) * s;
      const c = p.stains[Math.floor(r() * p.stains.length)];
      const rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
      rg.addColorStop(0, hexA(c, 0.06 + r() * 0.2));
      rg.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }

    // drips
    const drips = Math.round(o.grime * 45);
    for (let i = 0; i < drips; i++) {
      const x = r() * w, y0 = r() * h * 0.6;
      const len = (60 + r() * 360) * s, wd = (2 + r() * 9) * s;
      const c = p.stains[Math.floor(r() * p.stains.length)];
      const lg = ctx.createLinearGradient(0, y0, 0, y0 + len);
      lg.addColorStop(0, hexA(c, 0.4));
      lg.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = lg;
      ctx.fillRect(x, y0, wd, len);
    }

    // scrawled text
    if (o.text) {
      ctx.save();
      let fs = 190 * s;
      const font = (size) => `${size}px "Permanent Marker", Impact, "Arial Black", sans-serif`;
      ctx.font = font(fs);
      const mw = ctx.measureText(o.text).width;
      if (mw > w * 0.84) { fs *= (w * 0.84) / mw; ctx.font = font(fs); }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(w / 2, h * 0.52);
      ctx.rotate(-0.07 + r() * 0.03);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillText(o.text, 6 * s, 7 * s);
      ctx.fillStyle = hexA(p.light, 0.88);
      ctx.fillText(o.text, 0, 0);
      ctx.restore();
    }

    // grain (on top of text, so the text gets roughed up too)
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data, amt = o.grit * 80;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * amt;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);

    // scratches
    ctx.lineCap = 'round';
    const scratches = Math.round(o.scratch * 260);
    for (let i = 0; i < scratches; i++) {
      let x = r() * w, y = r() * h;
      const a = -0.6 + (r() - 0.5) * 1.2 + (r() < 0.3 ? Math.PI / 2 : 0);
      const len = (20 + r() * r() * 420) * s;
      ctx.strokeStyle = r() < 0.7 ? hexA(p.light, 0.05 + r() * 0.3) : hexA('#000000', 0.2 + r() * 0.4);
      ctx.lineWidth = (0.4 + r() * 1.2) * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        x += Math.cos(a) * len / 3 + (r() - 0.5) * 4 * s;
        y += Math.sin(a) * len / 3 + (r() - 0.5) * 4 * s;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // splatter
    const clusters = Math.round(o.splat * 16);
    for (let k = 0; k < clusters; k++) {
      const cx = r() * w, cy = r() * h;
      const col = r() < 0.5 ? p.light : p.stains[0];
      const m = 8 + Math.floor(r() * 30);
      for (let j = 0; j < m; j++) {
        const ang = r() * Math.PI * 2, dist = r() * r() * 140 * s;
        const rad = (0.8 + r() * r() * 7) * s;
        ctx.fillStyle = hexA(col, 0.45 + r() * 0.5);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // vignette
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.55);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${0.35 + o.grime * 0.45})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  // ---------- state ----------
  const KEY = 'grunge.presets.v1';
  const state = {
    preset: 'rust', seed: 7, grit: 0.5, scratch: 0.55, grime: 0.5, splat: 0.4,
    text: 'stay loud', tool: 'spray', size: 30, color: null, img: null, custom: null
  };

  const base = $('base'), paint = $('paint');
  const bctx = base.getContext('2d');
  const pctx = paint.getContext('2d');

  // the look on screen: the chosen preset, or that preset with the colour pickers applied
  function currentPreset() {
    if (!state.custom) return PRESETS[state.preset];
    const c = state.custom;
    return {
      name: 'Custom',
      bg: [c.bg0, c.bg1],
      stains: [c.stain, mix(c.stain, '#ffffff', 0.3), mix(c.stain, '#000000', 0.5), mix(c.stain, '#000000', 0.8)],
      light: c.light
    };
  }

  function opts() {
    return {
      seed: state.seed, grit: state.grit, scratch: state.scratch,
      grime: state.grime, splat: state.splat, text: state.text.trim(),
      img: state.img
    };
  }

  let queued = false;
  function redraw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render(bctx, base.width, base.height, currentPreset(), opts());
    });
  }

  // ---------- RGB colour pickers ----------
  const PICK = { bg0: 'cBg0', bg1: 'cBg1', stain: 'cStain', light: 'cLight' };

  function showRGB() {
    Object.values(PICK).forEach((id) => {
      const n = parseInt($(id).value.slice(1), 16);
      $('v' + id.slice(1)).textContent = `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
    });
  }

  function setPickers(p) {
    $('cBg0').value = p.bg[0];
    $('cBg1').value = p.bg[1];
    $('cStain').value = p.stains[0];
    $('cLight').value = p.light;
    showRGB();
  }

  Object.values(PICK).forEach((id) => {
    $(id).addEventListener('input', () => {
      state.custom = {
        bg0: $('cBg0').value, bg1: $('cBg1').value,
        stain: $('cStain').value, light: $('cLight').value
      };
      showRGB();
      redraw();
    });
    $(id).addEventListener('change', buildSwatches);
  });

  $('creset').addEventListener('click', () => {
    state.custom = null;
    setPickers(PRESETS[state.preset]);
    buildSwatches();
    redraw();
  });

  // ---------- paint swatches ----------
  function buildSwatches() {
    const p = currentPreset();
    const cols = [p.light, p.stains[0], p.stains[1], '#0d0c0b'];
    state.color = cols[0];
    const box = $('swatches');
    box.innerHTML = '';
    cols.forEach((c, i) => {
      const b = document.createElement('button');
      b.style.background = c;
      b.setAttribute('aria-label', 'Paint colour ' + (i + 1));
      if (i === 0) b.className = 'on';
      b.addEventListener('click', () => {
        state.color = c;
        [...box.children].forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
      });
      box.appendChild(b);
    });
  }

  // ---------- choosing a surface ----------
  function selectPreset(key) {
    state.preset = key;
    state.custom = null;
    state.img = PRESETS[key].img || null;   // picture presets bring their picture
    $('file').value = '';
    setPickers(PRESETS[key]);
    buildSwatches();
    document.querySelectorAll('.thumb').forEach((t) => t.setAttribute('aria-pressed', t.dataset.key === state.preset));
    redraw();
  }

  function buildThumbs() {
    const box = $('thumbs');
    box.innerHTML = '';
    Object.entries(PRESETS).forEach(([key, p], i) => {
      const wrap = document.createElement('div');
      wrap.className = 'tw';

      const b = document.createElement('button');
      b.className = 'thumb';
      b.dataset.key = key;
      b.setAttribute('aria-pressed', key === state.preset);
      const cv = document.createElement('canvas');
      cv.width = 320; cv.height = 180;
      render(cv.getContext('2d'), 320, 180, p, {
        seed: 100 + i * 17, grit: 0.5, scratch: 0.6, grime: 0.5, splat: 0.4, text: '', img: p.img || null
      });
      const label = document.createElement('span');
      label.textContent = p.name;
      b.append(cv, label);
      b.addEventListener('click', () => {
        selectPreset(key);
        $('stage').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      wrap.appendChild(b);

      if (p.user) {
        const d = document.createElement('button');
        d.className = 'del';
        d.textContent = '×';
        d.setAttribute('aria-label', 'Delete preset ' + p.name);
        d.addEventListener('click', () => {
          delete PRESETS[key];
          if (state.preset === key) selectPreset('rust');
          buildThumbs();
          saveAll();
        });
        wrap.appendChild(d);
      }
      box.appendChild(wrap);
    });
  }

  // ---------- saving your own presets (kept in this browser) ----------
  function toData(img) {
    const cv = document.createElement('canvas');
    cv.width = 1280; cv.height = 720;
    const x = cv.getContext('2d');
    const k = Math.max(1280 / img.width, 720 / img.height);
    x.drawImage(img, (1280 - img.width * k) / 2, (720 - img.height * k) / 2, img.width * k, img.height * k);
    return cv.toDataURL('image/jpeg', 0.82);
  }

  function saveAll() {
    const list = Object.entries(PRESETS).filter(([, p]) => p.user).map(([id, p]) => (
      { id, name: p.name, bg: p.bg, stains: p.stains, light: p.light, data: p.data }
    ));
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      alert('Your browser could not store this preset, so it will only last until you close the page.');
    }
  }

  function loadSaved() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { /* ignore */ }
    return Promise.all(list.map((a) => new Promise((done) => {
      const reg = (img) => {
        PRESETS[a.id] = { name: a.name, bg: a.bg, stains: a.stains, light: a.light, img, user: true, data: a.data };
        done();
      };
      if (a.data) {
        const im = new Image();
        im.onload = () => reg(im);
        im.onerror = () => reg(null);
        im.src = a.data;
      } else reg(null);
    })));
  }

  $('psave').addEventListener('click', () => {
    const p = currentPreset();
    const id = 'u' + Date.now();
    PRESETS[id] = {
      name: $('pname').value.trim() || 'My preset',
      bg: [...p.bg], stains: [...p.stains], light: p.light,
      img: state.img, user: true, data: state.img ? toData(state.img) : null
    };
    $('pname').value = '';
    saveAll();
    buildThumbs();
    selectPreset(id);
  });

  // ---------- painting on the wall ----------
  let drawing = false, last = null;

  function pos(e) {
    const rc = paint.getBoundingClientRect();
    return [(e.clientX - rc.left) * paint.width / rc.width, (e.clientY - rc.top) * paint.height / rc.height];
  }

  function stroke(x, y) {
    const sz = state.size * (paint.width / 1280);
    if (state.tool === 'spray') {
      pctx.fillStyle = state.color;
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * Math.random() * sz;
        pctx.globalAlpha = 0.25 + Math.random() * 0.6;
        pctx.beginPath();
        pctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.6 + Math.random() * 1.8, 0, Math.PI * 2);
        pctx.fill();
      }
      pctx.globalAlpha = 1;
    } else {
      if (!last) { last = [x, y]; return; }
      pctx.strokeStyle = 'rgba(235,228,210,.55)';
      pctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const j = (i - 1) * sz * 0.18;
        pctx.lineWidth = 0.7 + Math.random() * 1.1;
        pctx.beginPath();
        pctx.moveTo(last[0] + j, last[1] + j * 0.5);
        pctx.lineTo(x + j + (Math.random() - 0.5) * 3, y + j * 0.5 + (Math.random() - 0.5) * 3);
        pctx.stroke();
      }
    }
    last = [x, y];
  }

  paint.addEventListener('pointerdown', (e) => {
    drawing = true;
    paint.setPointerCapture(e.pointerId);
    last = null;
    const [x, y] = pos(e);
    stroke(x, y);
  });
  paint.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const [x, y] = pos(e);
    stroke(x, y);
  });
  const stop = () => { drawing = false; last = null; };
  paint.addEventListener('pointerup', stop);
  paint.addEventListener('pointercancel', stop);

  // ---------- controls ----------
  ['grit', 'scratch', 'grime', 'splat'].forEach((k) => {
    $(k).addEventListener('input', (e) => { state[k] = parseFloat(e.target.value); redraw(); });
  });
  $('text').addEventListener('input', (e) => { state.text = e.target.value; redraw(); });
  $('size').addEventListener('input', (e) => { state.size = parseInt(e.target.value, 10); });

  function setTool(t) {
    state.tool = t;
    $('tSpray').classList.toggle('on', t === 'spray');
    $('tScratch').classList.toggle('on', t === 'scratch');
    $('tSpray').setAttribute('aria-pressed', t === 'spray');
    $('tScratch').setAttribute('aria-pressed', t === 'scratch');
  }
  $('tSpray').addEventListener('click', () => setTool('spray'));
  $('tScratch').addEventListener('click', () => setTool('scratch'));

  // the user's own picture (stays in the browser, never uploaded)
  $('file').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f || !f.type.startsWith('image/')) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      state.img = im;
      URL.revokeObjectURL(url);
      redraw();
    };
    im.src = url;
  });
  $('rmimg').addEventListener('click', () => {
    state.img = null;
    $('file').value = '';
    redraw();
  });

  function remix() {
    state.seed = Math.floor(Math.random() * 1e9);
    redraw();
  }
  $('remix').addEventListener('click', remix);
  $('clear').addEventListener('click', () => pctx.clearRect(0, 0, paint.width, paint.height));
  $('full').addEventListener('click', () => {
    const st = $('stage');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (st.requestFullscreen) st.requestFullscreen();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) {
      e.preventDefault();
      remix();
    }
  });

  // download at a chosen resolution
  $('download').addEventListener('click', () => {
    const [w, h] = $('res').value.split('x').map(Number);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const octx = out.getContext('2d');
    render(octx, w, h, currentPreset(), opts());
    octx.drawImage(paint, 0, 0, w, h);
    out.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `grunge-${state.preset}-${w}x${h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  });

  // ---------- start (wait for the marker font so the scrawl renders right) ----------
  function start() {
    loadSaved().then(() => {
      setPickers(PRESETS[state.preset]);
      buildSwatches();
      buildThumbs();
      redraw();
    });
  }
  if (document.fonts && document.fonts.load) {
    document.fonts.load('40px "Permanent Marker"').then(start, start);
  } else {
    start();
  }
})();