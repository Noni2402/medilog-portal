(() => {
  const G = window.GAME, VT = window.VAULT, KEY = 'medilog-portal-v3';
  if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (e) { document.body.innerHTML = ''; } }
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  let S = load();

  function fresh() { return { ck: {}, vals: {}, team: '', start: 0, step: 0, mails: ['m1'], arrived: {}, docs: [], seen: {}, solved: {}, last: null, decision: null, bonus: false, bonusOpen: false, timeUpShown: false, extra: 0, finished: 0 }; }
  function load() { try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return fresh(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const chf = n => "CHF " + Math.round(n).toLocaleString('de-CH');
  const k = n => n >= 1e6 ? (n / 1e6).toFixed(2) + ' Mio.' : Math.round(n / 1000) + "'000";

  // Codeprüfung: PBKDF2 + AES-GCM. Ein Code ist richtig, wenn er den Schlüssel des Schritts entschlüsselt.
  const enc = new TextEncoder(), ub = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)), tb = b => btoa(String.fromCharCode(...new Uint8Array(b)));
  async function kek(name, v) {
    const base = await crypto.subtle.importKey('raw', enc.encode(v), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('medilog|' + name), iterations: VT.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }
  async function unwrap(k, w) { try { return await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub(w.iv) }, k, ub(w.ct)); } catch (e) { return null; } }
  function variants(raw, norm) {
    if (norm === 'raw') return [String(raw)];
    const n = parseFloat(String(raw).replace(',', '.').replace(/[^\d.\-]/g, ''));
    if (isNaN(n)) return [];
    if (norm === 'fix2') return [n.toFixed(2)];
    if (norm === 'int') return [String(Math.round(n))];
    if (norm === 'fix12') return [n.toFixed(1), n.toFixed(2)];
    return [String(n)];
  }
  async function check(key, raw, norm) {
    if (!window.crypto || !crypto.subtle) { alert('Diese Seite braucht https oder localhost.'); return null; }
    for (const v of variants(raw, norm)) {
      const k = await kek(key, v);
      for (const w of (VT.keys[key] || [])) { const ck = await unwrap(k, w); if (ck) return ck; }
    }
    return null;
  }
  // Gesperrte Unterlagen entschlüsseln (Mail-Bilder und PDFs)
  const blobs = {};
  async function asset(item, type) {
    if (item.file) return item.file;
    if (blobs[item.enc]) return blobs[item.enc];
    const ckB = (S.ck || {})[item.k]; if (!ckB) return null;
    const ck = await crypto.subtle.importKey('raw', ub(ckB), 'AES-GCM', false, ['decrypt']);
    const buf = new Uint8Array(await (await fetch('assets/x/' + item.enc + '.bin')).arrayBuffer());
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, ck, buf.slice(12));
    return blobs[item.enc] = URL.createObjectURL(new Blob([plain], { type }));
  }
  let fails = 0, lockUntil = 0;

  // ---------- screens
  function show(id) {
    $$('.screen').forEach(s => s.classList.add('hidden'));
    const el = $('#' + id); el.classList.remove('hidden'); el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
  }
  function boot() {
    if (!S.team) { show('login'); return; }
    if (S.showDossier) { renderDossier(); show('dossier'); return; }
    show('app'); $('#teamChip').textContent = S.team; go('overview'); tick();
  }

  // ---------- login
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const team = $('#teamName').value.trim(), pw = $('#teamPw').value.trim().toLowerCase().replace(/\s+/g, '');
    if (!team) return;
    if (!(await check('login', pw, 'raw'))) { const f = $('#loginForm'); $('#loginErr').textContent = 'Das Passwort stimmt nicht. Schaut euch die Notiz auf der Folie nochmals an.'; f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); return; }
    S = fresh(); S.team = team; S.start = Date.now(); S.arrived = { m1: S.start }; save();
    boot(); setTimeout(() => toast('m1'), 700);
  });
  $('#teamPw').addEventListener('input', () => $('#loginErr').textContent = '');

  // ---------- navigation
  $$('.sidebar a').forEach(a => a.addEventListener('click', () => go(a.dataset.view)));
  function go(view) {
    if (view === 'decision' && !decisionOpen()) { toast(null, 'Der Entscheid öffnet sich nach der Oktober-Akte.'); return; }
    $$('.sidebar a').forEach(a => a.classList.toggle('on', a.dataset.view === view));
    $$('.view').forEach(v => v.classList.add('hidden'));
    const v = $('#v-' + view); v.classList.remove('hidden'); v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
    ({ overview: rOverview, inbox: rInbox, docs: rDocs, downloads: rDownloads, decision: rDecision })[view]();
    S.view = view; save(); chrome(); window.scrollTo(0, 0);
  }
  function decisionOpen() { return S.step >= 4 || S.forceDecision; }
  function chrome() {
    const unread = S.mails.filter(m => !S.seen[m]).length, newDocs = S.docs.filter(d => !S.seen[d]).length;
    $('#mailBadge').textContent = unread || ''; $('#mailBadge').classList.toggle('on', !!unread);
    $('#docBadge').textContent = newDocs || ''; $('#docBadge').classList.toggle('on', !!newDocs);
    $('#navDecision').classList.toggle('locked', !decisionOpen());
    const done = Math.min(S.step + (S.decision ? 1 : 0), 5);
    $('#progTxt').textContent = S.decision ? 'Alle Schritte gelöst' : `Schritt ${Math.min(S.step + 1, 5)} von 5`;
    $('#progBar').style.width = (done / 5 * 100) + '%';
  }

  // ---------- overview
  function fieldHTML(f) {
    return `<div class="field"><label for="f-${f.key}">${esc(f.label)}</label><div class="inp"><input id="f-${f.key}" type="number" inputmode="decimal" step="${f.step}"><span class="unit">${esc(f.unit)}</span></div></div>`;
  }
  function actionBtn(a) {
    if (a.mail) { const unread = !S.seen[a.mail]; return `<button class="act ${unread ? 'new' : ''}" data-open-mail="${a.mail}"><i class="ic ic-mail"></i>${esc(a.t)}<span class="arrow">→</span></button>`; }
    return `<button class="act" data-go="${a.go}"><i class="ic ic-${a.go === 'docs' ? 'folder' : a.go === 'downloads' ? 'down' : 'check'}"></i>${esc(a.t)}<span class="arrow">→</span></button>`;
  }
  function taskCard(step, n) {
    return `<article class="card task" id="task">
      <div class="task-head"><span class="step-no">Schritt ${n} von 5</span><span class="sheet-chip">Excel · Blatt «${esc(step.sheet)}»</span></div>
      <h2>${esc(step.title)}</h2><p class="lead">${esc(step.lead)}</p>
      <div class="acts">${step.todo.map(actionBtn).join('')}</div>
      ${step.how ? `<ol class="how">${step.how.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
      ${step.formulas ? `<div class="fbox"><b>Formeln und Hinweise</b><ul>${step.formulas.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${step.fields ? `<form class="code-form" data-key="${step.fields[0].key}" data-norm="${step.fields[0].norm}">${step.fields.map(fieldHTML).join('')}<button class="btn primary" type="submit">Prüfen</button></form><div class="err" id="codeErr" role="alert"></div>` : ''}
    </article>`;
  }
  function rOverview() {
    const st = G.steps[S.step];
    const greeting = `<div class="hello"><div class="eyebrow">Beraterteam ${esc(S.team)}</div><h1>${S.decision ? 'Euer Dossier ist bereit.' : 'Guten Morgen, die GL wartet.'}</h1></div>`;
    const isDone = i => i < S.step || (i === 4 && S.decision);
    const track = `<div class="track">${G.steps.map((s, i) => `<div class="tk ${isDone(i) ? 'done' : i === S.step ? 'now' : ''}"><span class="dot">${isDone(i) ? '✓' : i + 1}</span><span class="tl">${esc(s.title)}</span></div>`).join('')}</div>`;
    let main;
    if (S.decision) main = `<article class="card task"><h2>Alles erledigt</h2><p class="lead">Ihr könnt die Sitzung jetzt betreten.</p><button class="btn primary" id="toDossier">Sitzung beitreten <span class="arrow">→</span></button></article>`;
    else main = taskCard(st, S.step + 1);
    let bonus = '';
    if (S.bonus) bonus = `<article class="card bonus solved"><h3>Bonus gelöst</h3><p class="lead">Rund 12 Störungen pro Jahr, nicht «alle paar Jahre einmal».</p></article>`;
    else if (S.bonusOpen) bonus = `<article class="card bonus"><div class="task-head"><span class="step-no">Bonus</span></div><h3>${esc(G.bonus.title)}</h3><p class="lead">${esc(G.bonus.lead)}</p><form class="code-form" data-key="bonus" data-norm="fix12">${G.bonus.fields.map(fieldHTML).join('')}<button class="btn ghost" type="submit">Prüfen</button></form><div class="err" id="bonusErr"></div></article>`;
    const recent = S.mails.slice().reverse().slice(0, 4).map(mailRow).join('');
    $('#v-overview').innerHTML = `${greeting}${track}<div class="ov-grid"><div>${main}${bonus}</div><aside class="card inbox-mini"><div class="mini-head"><h3>Posteingang</h3><a class="link" data-go="inbox">Alle</a></div>${recent}</aside></div>`;
    bindCodeForms(); bindActions($('#v-overview'));
    $('#toDossier')?.addEventListener('click', openDossier);
  }
  function mailRow(id) {
    const m = G.mails[id];
    return `<button class="mail-row ${S.seen[id] ? '' : 'unread'}" data-open-mail="${id}"><span class="av">${m.init}</span><span class="mr-body"><span class="mr-top"><b>${esc(m.from)}</b><span class="mr-time">${mailTime(id)}</span></span><span class="mr-sub">${esc(m.subject)}</span></span></button>`;
  }
  function mailTime(id) {
    const m = G.mails[id]; if (m.time) return m.time;
    const t = (S.arrived || {})[id] || (id === 'm1' ? S.start : 0);
    return t ? new Date(t).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) : '';
  }
  function bindActions(root) {
    root.querySelectorAll('[data-open-mail]').forEach(b => b.addEventListener('click', () => openMail(b.dataset.openMail)));
    root.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
    root.querySelectorAll('[data-open-doc]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openDoc(b.dataset.openDoc); }));
  }
  function bindCodeForms() {
    $$('.code-form').forEach(f => f.addEventListener('submit', async e => {
      e.preventDefault();
      const key = f.dataset.key, inp = f.querySelector('input'), errEl = key === 'bonus' ? $('#bonusErr') : $('#codeErr');
      if (!inp.value) { errEl.textContent = 'Gebt zuerst einen Wert ein.'; return; }
      const wait = Math.ceil((lockUntil - Date.now()) / 1000);
      if (wait > 0) { errEl.textContent = `Zu viele Versuche. Wartet noch ${wait} Sekunden.`; return; }
      const btn = f.querySelector('button'); btn.disabled = true;
      const ck = await check(key, inp.value, f.dataset.norm); btn.disabled = false;
      if (ck) { fails = 0; S.ck = S.ck || {}; S.ck[key] = tb(ck); S.vals = S.vals || {}; S.vals[key] = String(inp.value).slice(0, 20); solve(key, f.closest('.card')); }
      else {
        fails++; if (fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; }
        const card = f.closest('.card'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
        errEl.textContent = key === 'bonus' ? 'Noch nicht. Zählt die Störungen im Störungslog.' : 'Das stimmt noch nicht. Schaut auf die Prüfung im Excel.';
      }
      inp.addEventListener('input', () => errEl.textContent = '', { once: true });
    }));
  }
  function solve(key, card) {
    S.solved[key] = true;
    let unlock;
    if (key === 'bonus') { S.bonus = true; }
    else { const i = G.steps.findIndex(s => (s.fields || [])[0]?.key === key); S.step = i + 1; unlock = G.steps[i].unlock; }
    save();
    card.classList.add('success');
    setTimeout(() => {
      if (unlock) {
        S.last = { key, mails: unlock.mails || [], docs: unlock.docs || [] };
        (unlock.mails || []).forEach((m, i) => { if (!S.mails.includes(m)) { S.mails.push(m); S.arrived[m] = Date.now(); setTimeout(() => toast(m), 400 + i * 900); } });
        (unlock.docs || []).forEach(d => { if (!S.docs.includes(d)) S.docs.push(d); });
        save();
      }
      rOverview(); chrome();
    }, 800);
  }

  // ---------- inbox, docs, downloads
  function rInbox() {
    $('#v-inbox').innerHTML = `<div class="hello"><div class="eyebrow">Posteingang</div><h1>Nachrichten</h1></div><div class="card list">${S.mails.slice().reverse().map(mailRow).join('')}</div>`;
    bindActions($('#v-inbox'));
  }
  function docCard(d) {
    const x = G.docs[d];
    return `<button class="doc ${S.seen[d] ? '' : 'new'}" data-open-doc="${d}"><span class="pdf">PDF</span><span><b>${esc(x.title)}</b><small>${esc(x.meta)}</small></span><span class="open">Öffnen</span></button>`;
  }
  function rDocs() {
    const list = S.docs.length ? S.docs.map(docCard).join('') : `<div class="empty"><b>Noch keine Dokumente</b><span>Unterlagen kommen mit den nächsten Schritten.</span></div>`;
    $('#v-docs').innerHTML = `<div class="hello"><div class="eyebrow">Dokumente</div><h1>Unterlagen</h1></div><div class="docs">${list}</div>`;
    bindActions($('#v-docs'));
  }
  function rDownloads() {
    $('#v-downloads').innerHTML = `<div class="hello"><div class="eyebrow">Downloads</div><h1>Arbeitsdatei</h1></div>
    <a class="doc xl" href="assets/files/MediLog_Verfuegbarkeitsmodell.xlsx" download="MediLog_Verfügbarkeitsmodell.xlsx"><span class="pdf xls">XLSX</span><span><b>Verfügbarkeits- und Ausfallkostenmodell</b><small>Excel · jedes Team arbeitet in einer eigenen Kopie</small></span><span class="open">Herunterladen ↓</span></a>
    <p class="hint">Öffnet die Datei in der Excel-App, nicht in Excel Online.</p>`;
  }

  // ---------- viewer (Mail und PDF)
  let viewerMail = null;
  function openMail(id) {
    S.seen[id] = true; save(); chrome(); viewerMail = id;
    const m = G.mails[id];
    $('#vwTitle').textContent = m.from + ' · ' + m.subject;
    $('#vwBody').innerHTML = `<img alt="${esc(m.subject)}">`;
    asset({ file: m.file && 'assets/mails/' + m.file, enc: m.enc, k: m.k }, 'image/png').then(u => { const im = $('#vwBody img'); if (im && u && viewerMail === id) im.src = u; });
    $('#vwBody').className = 'vw-body img'; $('.vw').classList.add('mail');
    $('#vwBack').classList.add('hidden'); $('#vwTab').classList.add('hidden');
    const rel = (m.rel || []).filter(d => S.docs.includes(d));
    $('#vwRel').innerHTML = rel.length ? `<span>Unterlagen zum Ausfall</span>${rel.map(d => `<button class="rel" data-open-doc="${d}"><span class="pdf sm">PDF</span>${esc(G.docs[d].short)}</button>`).join('')}` : '';
    $('#vwRel').classList.toggle('hidden', !rel.length);
    bindActions($('#vwRel'));
    openOverlay('#viewer');
    $$('[data-open-mail="' + id + '"]').forEach(b => b.classList.remove('unread', 'new'));
    $$('.solved-bar [data-open-mail="' + id + '"]').forEach(b => { b.className = 'btn ghost sm'; b.textContent = 'Mail nochmals öffnen: ' + m.from; });
  }
  function openDoc(d) {
    S.seen[d] = true; save(); chrome();
    const x = G.docs[d];
    $('#vwTitle').textContent = x.title;
    $('#vwBody').innerHTML = `<iframe title="${esc(x.title)}"></iframe>`;
    asset(x, 'application/pdf').then(src => { if (!src) return; const fr = $('#vwBody iframe'); if (fr) fr.src = src + '#view=FitH'; $('#vwTab').href = src; });
    $('#vwBody').className = 'vw-body pdfv'; $('.vw').classList.remove('mail');
    $('#vwTab').classList.remove('hidden');
    $('#vwBack').classList.toggle('hidden', !viewerMail);
    $('#vwRel').classList.add('hidden');
    if ($('#viewer').classList.contains('hidden')) openOverlay('#viewer');
    $$('[data-open-doc="' + d + '"]').forEach(b => b.classList.remove('new'));
  }
  function closeViewer() { closeOverlay('#viewer'); viewerMail = null; setTimeout(() => { $('#vwBody').innerHTML = ''; }, 260); }
  $('#vwBack').addEventListener('click', () => { if (viewerMail) openMail(viewerMail); });
  $('#vwClose').addEventListener('click', closeViewer);
  $('#viewer').addEventListener('click', e => { if (e.target.id === 'viewer') closeViewer(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#viewer').classList.contains('hidden')) closeViewer(); });

  // ---------- decision
  function rDecision() {
    const d = S.decision || {};
    const opt = (name, vals) => vals.map(v => `<label class="pill"><input type="radio" name="${name}" value="${esc(v)}" ${d[name] === v ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('');
    const sel = (name, vals) => `<select name="${name}"><option value="">Bitte wählen</option>${vals.map(v => `<option ${d[name] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    const num = (name, label, unit, step) => `<div class="field"><label>${label}</label><div class="inp"><input name="${name}" type="number" step="${step}" value="${esc(d[name] ?? '')}"><span class="unit">${unit}</span></div></div>`;
    $('#v-decision').innerHTML = `<div class="hello"><div class="eyebrow">Schritt 5 · Entscheid</div><h1>Eure Empfehlung an die GL</h1></div>
    ${S.step < 4 ? '<div class="note">Noch nicht alle Schritte gelöst. Die GL wartet trotzdem: Tragt ein, was ihr habt.</div>' : ''}
    <form id="decForm" class="dec">
      <div class="dec-grid">
        <section class="card dc"><div class="dc-no">1</div><h3>Massnahmen</h3><p class="muted">Was setzt MediLog um?</p>
          <div class="pills">${G.measures.map(m => `<label class="pill"><input type="checkbox" name="mass" value="${esc(m)}" ${(d.mass || []).includes(m) ? 'checked' : ''}><span>${esc(m)}</span></label>`).join('')}</div>
          <h4>Hosting-Offerte</h4><div class="pills">${opt('host', ['Annehmen', 'Nur nachverhandelt', 'Ablehnen'])}</div></section>
        <section class="card dc"><div class="dc-no">2</div><h3>Zahlen aus dem Excel</h3><p class="muted">Blatt «Massnahmen»</p>
          ${num('h1', 'Kundenverlust pro Jahr im Ist-Zustand', 'CHF', '1000')}
          ${num('h2', 'Verlorene Bestellungen im Vergleich zum Case', '%', '10')}
          ${num('r1', 'Verfügbarkeit, eure Konfiguration', '%', '0.01')}
          ${num('r2', 'Summe über fünf Jahre, eure Konfiguration', 'CHF', '1')}
          ${num('s0', 'Summe über fünf Jahre, Ist-Zustand (Zeile S0)', 'CHF', '1')}</section>
        <section class="card dc"><div class="dc-no">3</div><h3>Zusage und Erkenntnisse</h3><p class="muted">Was sagt ihr dem Spital zu?</p>
          <div class="pills col">${opt('spital', ['RTO 4 h und kein Datenverlust', 'RTO 4 h, Datenverlust erst nach Klärung', 'Noch keine Zusage'])}</div>
          <div class="field"><label>Grösster Hebel (Komponente)</label>${sel('e1', G.components)}</div>
          <div class="field"><label>Bringt pro Franken am meisten</label>${sel('e2', G.measures)}</div>
          <div class="field"><label>Lässt sich nicht in Franken ausdrücken</label><input name="e3" maxlength="60" value="${esc(d.e3 || '')}" placeholder="Stichwort"></div></section>
      </div>
      <div class="dec-actions"><div class="err" id="decErr"></div><button class="btn primary" type="submit">GL-Dossier erstellen <span class="arrow">→</span></button></div>
    </form>`;
    $('#decForm').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target), o = {};
      o.mass = fd.getAll('mass'); ['h1', 'h2', 'r1', 'r2', 's0', 'host', 'spital', 'e1', 'e2', 'e3'].forEach(k => o[k] = (fd.get(k) || '').toString().trim());
      const miss = [];
      if (!o.mass.length) miss.push('Massnahmen'); if (!o.host) miss.push('Hosting'); if (!o.r1 || !o.r2 || !o.s0) miss.push('Zahlen'); if (!o.spital) miss.push('Spital'); if (!o.e1 || !o.e2) miss.push('Erkenntnisse');
      if (miss.length) { $('#decErr').textContent = 'Noch offen: ' + miss.join(', ') + '.'; return; }
      S.decision = o; S.finished = S.finished || Date.now(); save(); openDossier();
    });
  }

  // ---------- dossier
  function openDossier() {
    if (!S.decision) { S.forceDecision = true; save(); show('app'); go('decision'); return; }
    S.showDossier = true; save(); renderDossier(); show('dossier'); window.scrollTo(0, 0);
  }
  function bars(rows, max, fmt) {
    return `<div class="bars">${rows.map((r, i) => `<div class="br ${r.me ? 'me' : ''} ${r.muted ? 'mut' : ''}"><span class="bl">${esc(r.l)}</span><span class="bt"><i style="--w:${Math.max(1.5, r.v / max * 100)}%;--d:${i * 80}ms"></i></span><b>${fmt(r.v)}</b></div>`).join('')}</div>`;
  }
  function renderDossier() {
    const d = S.decision || {}, sv = S.solved, used = Math.max(0, Math.round(((S.finished || Date.now()) - S.start) / 60000));
    const mass = d.mass || [], has = m => mass.includes(m);
    const r1 = parseFloat(d.r1), r2 = parseFloat(d.r2), s0 = parseFloat(d.s0);
    const hNow = 39.9, hNew = isNaN(r1) ? null : Math.max(0, (1 - r1 / 100) * 8760);
    const fmtH = h => h.toFixed(1) + ' h';
    const list = a => a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1];
    const diff = (!isNaN(r2) && !isNaN(s0)) ? s0 - r2 : null;

    // Ampeln
    const amp = [];
    amp.push(isNaN(r1) ? { c: 'grey', h: 'Ziel 99.9 %', v: '–', t: 'Keine Verfügbarkeit erfasst.' }
      : r1 >= 99.9 ? { c: 'green', h: 'Ziel 99.9 %', v: r1.toFixed(2) + ' %', t: 'Erreicht.' }
      : r1 >= 99.7 ? { c: 'yellow', h: 'Ziel 99.9 %', v: r1.toFixed(2) + ' %', t: 'Knapp verfehlt.' }
      : { c: 'red', h: 'Ziel 99.9 %', v: r1.toFixed(2) + ' %', t: 'Klar verfehlt.' });
    const rtoOk = has('ERP-Cluster') || has('Zweitstandort Rotkreuz');
    amp.push(rtoOk ? { c: 'green', h: 'RTO ≤ 4 h fürs Spital', v: 'machbar', t: has('ERP-Cluster') ? 'Der Cluster schaltet in Minuten um.' : 'Rotkreuz übernimmt in 30 Minuten.' }
      : has('Hosting ERP, DB und WMS') ? { c: 'yellow', h: 'RTO ≤ 4 h fürs Spital', v: 'unklar', t: 'Das Hosting-SLA regelt kein RTO.' }
      : { c: 'red', h: 'RTO ≤ 4 h fürs Spital', v: 'nicht machbar', t: 'Fällt der Server aus, dauert es wie im Oktober Stunden.' });
    amp.push(diff == null ? { c: 'grey', h: 'Günstiger als heute', v: '–', t: 'Zahlen fehlen.' }
      : diff > 0.05 * s0 ? { c: 'green', h: 'Günstiger als heute', v: '− ' + chf(diff), t: 'Über fünf Jahre gespart.' }
      : diff >= 0 ? { c: 'yellow', h: 'Günstiger als heute', v: '− ' + chf(diff), t: 'Kaum Unterschied zu nichts tun.' }
      : { c: 'red', h: 'Günstiger als heute', v: '+ ' + chf(-diff), t: 'Teurer als nichts tun.' });
    const greens = amp.filter(a => a.c === 'green').length, reds = amp.filter(a => a.c === 'red').length;
    const verdict = (!reds && greens >= 2) ? { c: 'green', t: 'Überzeugende Empfehlung' } : (reds <= 1 && greens >= 1) ? { c: 'yellow', t: 'Gute Richtung, mit Lücken' } : { c: 'red', t: 'Nochmals überdenken' };

    // Rückmeldungen
    const fb = [];
    const base = ['Zweite Internetleitung', 'WLAN doppelt', 'USV und Notstrom'], miss = base.filter(m => !has(m));
    fb.push(!miss.length ? { c: 'green', t: 'Basis-Redundanz komplett: Internet, WLAN und USV kosten wenig und bringen am meisten.' }
      : { c: 'red', t: `${list(miss)} fehlt. Das ist günstig und senkt den Ausfall stark (Szenario S1).` });
    const promise = d.spital || '';
    if (promise.startsWith('RTO') && !rtoOk) fb.push({ c: 'red', t: 'Ihr sagt dem Spital 4 h zu, ohne Massnahme, die das möglich macht. Diese Zusage könnt ihr nicht halten.' });
    else if (promise === 'RTO 4 h und kein Datenverlust') fb.push({ c: 'yellow', t: '«Kein Datenverlust» heisst RPO 0. Das verlangt eine laufende Datenspiegelung und ist im Modell nicht berechnet. Vorsichtig zusagen.' });
    else if (promise === 'RTO 4 h, Datenverlust erst nach Klärung') fb.push({ c: 'green', t: 'Zusage ans Spital passt: RTO ist machbar, RPO 0 wird zuerst geklärt.' });
    else if (rtoOk) fb.push({ c: 'yellow', t: 'Ihr könntet dem Spital RTO 4 h zusagen, tut es aber nicht. Der Vertrag ab 2027 hängt daran.' });
    else fb.push({ c: 'green', t: 'Keine Zusage ans Spital ist ehrlich, aber der Vertrag ab 2027 ist so gefährdet.' });
    if (d.host === 'Annehmen') fb.push({ c: 'red', t: 'Hosting-Offerte angenommen: Das SLA deckt die Internetleitung nicht, regelt kein RTO/RPO und hätte im Oktober nur 1.3 % des Schadens bezahlt.' });
    else if (d.host) fb.push({ c: 'green', t: 'Hosting kritisch beurteilt: Die 99.9 % gelten nur bis zum Rechenzentrum, die Gutschrift ist klein.' });
    if (has('Zweitstandort Rotkreuz')) fb.push({ c: 'yellow', t: 'Rotkreuz ist die teuerste Massnahme. Sie lohnt sich nur, wenn ihr einen hohen Kundenverlust annehmt.' });
    if (d.e1) fb.push(d.e1 === 'Internetleitung' ? { c: 'green', t: 'Grösster Hebel richtig erkannt: Die Internetleitung fällt am längsten aus (rund 12 h pro Jahr).' } : { c: 'yellow', t: `Grösster Hebel: Ihr nennt ${d.e1}. Am längsten fällt die Internetleitung aus (rund 12 h pro Jahr).` });
    if (d.e2) fb.push(d.e2 === 'Zweite Internetleitung' ? { c: 'green', t: 'Pro Franken am wirksamsten: richtig, die zweite Internetleitung.' } : { c: 'yellow', t: `Pro Franken am wirksamsten ist die zweite Internetleitung, nicht ${d.e2}.` });

    // Satz
    const promiseTxt = { 'RTO 4 h und kein Datenverlust': 'sagen dem Spital RTO 4 h und keinen Datenverlust zu', 'RTO 4 h, Datenverlust erst nach Klärung': 'sagen dem Spital RTO 4 h zu und klären den Datenverlust', 'Noch keine Zusage': 'machen dem Spital noch keine Zusage' }[promise] || 'lassen die Zusage ans Spital offen';
    const sentence = `Wir empfehlen ${list(mass) || 'keine Massnahme'}. `
      + (hNew != null ? `Der Ausfall sinkt von ${fmtH(hNow)} auf ${fmtH(hNew)} pro Jahr. ` : '')
      + (diff != null ? `Über fünf Jahre kostet das ${chf(r2)}, ${diff >= 0 ? chf(diff) + ' weniger' : chf(-diff) + ' mehr'} als nichts zu tun. ` : '')
      + `Wir ${promiseTxt}.`;

    const maxV = Math.max(s0 || 0, r2 || 0, 1);
    const cmp = diff == null ? '<p class="nodata">Zahlen fehlen.</p>' : bars([{ l: 'Nichts tun (S0)', v: s0 }, { l: 'Unsere Empfehlung', v: r2, me: true }], maxV, chf);
    const V = S.vals || {}, pv = k => { const n = parseFloat(String(V[k] || '').replace(',', '.')); return isNaN(n) ? null : n; };
    const fact = (k, label, unit) => { const n = pv(k); return `<div class="fact ${sv[k] && n != null ? '' : 'miss'}"><span>${label}</span><b>${sv[k] && n != null ? (unit === '%' ? n.toFixed(2) + ' %' : chf(n)) : '–'}</b></div>`; };
    $('#dossier').innerHTML = `<div class="dos-band"><span><b>MediLog Zentral AG</b> · GL-Sitzung</span><span>Intern</span></div>
    <div class="dos">
      <div class="dos-head"><div><div class="eyebrow">Auswertung eurer Empfehlung</div><h1>${esc(S.team)}</h1><p class="muted">${used} ${used === 1 ? 'Minute' : 'Minuten'}${S.bonus ? ' · <span class="star">Bonus gelöst</span>' : ''}</p></div>
      <div class="dos-actions"><button class="btn ghost" id="dosBack">Zurück ins Portal</button><button class="btn ghost" id="dosPrint">Drucken</button></div></div>
      <section class="verdict v-${verdict.c}"><div class="vd-badge"><i></i>${verdict.t}</div><p class="vd-text">${esc(sentence)}</p>
        <div class="chips">${mass.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div></section>
      <section class="amps">${amp.map(a => `<div class="amp a-${a.c}"><span class="dot"></span><div><span class="ah">${a.h}</span><b>${a.v}</b><small>${a.t}</small></div></div>`).join('')}</section>
      <section class="dos-two">
        <div class="panel"><h2>Rückmeldung</h2><ul class="fb">${fb.map(f => `<li class="f-${f.c}"><span class="dot"></span>${esc(f.t)}</li>`).join('')}</ul></div>
        <div class="panel"><h2>Fünf Jahre im Vergleich</h2>${cmp}<p class="cap">Beide Werte mit euren Annahmen: Kundenverlust ${d.h1 ? chf(+d.h1) : '–'} pro Jahr, verlorene Bestellungen ${esc(d.h2 || '–')} %.</p>
          <h2 class="mt">Zahlen zur Diskussion</h2><div class="facts">${fact('s1', 'Verfügbarkeit heute', '%')}${fact('s3', 'Teuerster 4-h-Ausfall', 'CHF')}${fact('s4a', 'Schaden Oktober', 'CHF')}<div class="fact"><span>SLA-Gutschrift dafür</span><b>CHF 1'200</b></div></div>
          ${d.e3 ? `<p class="cap">Nicht in Franken: <b>${esc(d.e3)}</b></p>` : ''}</div>
      </section>
    </div>`;
    $('#dosBack').addEventListener('click', () => { S.showDossier = false; save(); show('app'); $('#teamChip').textContent = S.team; go('overview'); tick(); });
    $('#dosPrint').addEventListener('click', () => window.print());
    requestAnimationFrame(() => setTimeout(() => $$('#dossier .bars').forEach(b => b.classList.add('go')), 150));
  }
  $('#joinBtn').addEventListener('click', openDossier);

  // ---------- timer
  let timerInt;
  function tick() {
    clearInterval(timerInt);
    const run = () => {
      const total = (G.durationMin + S.extra) * 60000, left = Math.max(0, S.start + total - Date.now());
      const m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000);
      $('#timerTxt').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      const c = 2 * Math.PI * 15; $('#timerRing').style.strokeDasharray = c; $('#timerRing').style.strokeDashoffset = c * (1 - left / total);
      $('#timer').classList.toggle('warn', left < 5 * 60000 && left > 0); $('#timer').classList.toggle('over', left === 0);
      if (left === 0 && !S.timeUpShown && !S.showDossier) { S.timeUpShown = true; save(); openOverlay('#timeUp'); }
    };
    run(); timerInt = setInterval(run, 1000);
  }
  $('#keepGoing').addEventListener('click', () => closeOverlay('#timeUp'));
  $('#joinNow').addEventListener('click', () => { closeOverlay('#timeUp'); openDossier(); });

  // ---------- overlays, toasts
  function openOverlay(sel) { const o = $(sel); o.classList.remove('hidden'); requestAnimationFrame(() => o.classList.add('open')); }
  function closeOverlay(sel) { const o = $(sel); o.classList.remove('open'); setTimeout(() => o.classList.add('hidden'), 250); }
  function toast(mailId, text) {
    const t = document.createElement('div'); t.className = 'toast';
    if (mailId) { const m = G.mails[mailId]; t.innerHTML = `<span class="av">${m.init}</span><span><b>${esc(m.from)}</b><small>${esc(m.subject)}</small></span>`; t.addEventListener('click', () => openMail(mailId)); }
    else t.innerHTML = `<span class="av sys">i</span><span><b>MediLog Portal</b><small>${esc(text)}</small></span>`;
    $('#toastWrap').appendChild(t); requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, 5200);
    chrome();
  }

  // ---------- Spielleitung: Logo 5x klicken
  let clicks = 0, ct, adminKey = null;
  $('#logoMark').addEventListener('click', () => { clicks++; clearTimeout(ct); ct = setTimeout(() => clicks = 0, 1500); if (clicks >= 5) { clicks = 0; adminOpen(); } });
  function adminOpen() { $('#adminLock').classList.remove('hidden'); $('#adminPanel').classList.add('hidden'); $('#adminPw').value = ''; $('#adminErr').textContent = ''; openOverlay('#admin'); }
  $('#adminGo').addEventListener('click', async () => {
    adminKey = (await check('admin', $('#adminPw').value.trim(), 'raw')) ? await kek('admin', $('#adminPw').value.trim()) : null;
    if (adminKey) { $('#adminLock').classList.add('hidden'); $('#adminPanel').classList.remove('hidden'); $('#adminState').textContent = `Team ${S.team} · Schritt ${Math.min(S.step + 1, 5)}${S.bonusOpen ? ' · Bonus offen' : ''}`; }
    else $('#adminErr').textContent = 'Falscher Code.';
  });
  $('#adminSkip').addEventListener('click', () => {
    const key = ((G.steps[S.step] || {}).fields || [])[0]?.key;
    closeOverlay('#admin'); if (!S.showDossier) go('overview');
    if (key && adminKey) unwrap(adminKey, VT.admin[key] || { iv: '', ct: '' }).then(ck => { if (ck) { S.ck = S.ck || {}; S.ck[key] = tb(ck); } solve(key, $('#task') || document.body); });
  });
  $('#adminBonus').addEventListener('click', () => { S.bonusOpen = true; save(); closeOverlay('#admin'); if (!S.showDossier) go('overview'); });
  $('#adminTime').addEventListener('click', () => { S.extra += 5; S.timeUpShown = false; save(); tick(); closeOverlay('#admin'); });
  $('#adminReset').addEventListener('click', () => { localStorage.removeItem(KEY); location.reload(); });
  $('#adminClose').addEventListener('click', () => closeOverlay('#admin'));

  boot();
})();
