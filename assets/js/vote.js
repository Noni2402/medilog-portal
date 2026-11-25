// Gemeinsame Liste und Abstimmung für die Nachbesprechung (Beamer)
(() => {
  const KEY = 'medilog-vote-v1';
  const COMP = ['Internetleitung', 'Firewall', 'ERP-Server', 'ERP-Datenbank', 'WMS', 'Lager-WLAN', 'Stromversorgung'];
  const MEAS = ['Zweite Internetleitung', 'WLAN doppelt', 'USV und Notstrom', 'ERP-Cluster', 'Zweitstandort Rotkreuz', 'Notfallprozess', 'Hosting ERP, DB und WMS'];
  const STEPS = [
    { id: 'hebel', no: 1, short: 'Grösster Hebel', q: 'Welche Komponente ist der grösste Hebel?', sub: 'Welche Komponente verursacht pro Jahr am meisten Ausfallstunden?', kind: 'count', items: COMP,
      ours: ['Internetleitung'], note: 'Die Internetleitung fällt rund 12 h pro Jahr aus, danach folgt der ERP-Server mit 9 h.' },
    { id: 'franken', no: 2, short: 'Pro Franken', q: 'Welche Massnahme bringt pro Franken am meisten?', sub: 'Welche Massnahme senkt den Ausfall pro investiertem Franken am stärksten?', kind: 'count', items: MEAS,
      ours: ['Zweite Internetleitung'], note: "Die zweite Internetleitung kostet CHF 5'000 einmalig und CHF 7'200 pro Jahr und spart rund 10.7 Ausfallstunden pro Jahr." },
    { id: 'nichtchf', no: 3, short: 'Nicht in Franken', q: 'Was lässt sich nicht in Franken ausdrücken?', sub: 'Was ist wichtig, fehlt aber in jeder Rechnung?', kind: 'text',
      ours: ['Vertrauen der Spitäler', 'Patientensicherheit', 'Ruf von MediLog', 'Belastung der Mitarbeitenden'], note: 'Diese Punkte gehören in die Entscheidung, auch wenn sie in keiner Tabelle stehen.' },
    { id: 'orga', no: 4, short: 'Ohne Technik', q: 'Was hätte im Oktober ohne neue Technik geholfen?', sub: 'Verfügbarkeit ist auch eine organisatorische Aufgabe.', kind: 'text',
      ours: ['Supportvertrag mit garantierter Reaktionszeit (Ersatzteil kam erst um 15:30)', 'Geübter Notfallprozess (Papier-Kommissionierung)', 'Restore-Tests', 'Klare Verantwortlichkeiten', 'Kunden früh informieren'], note: 'Der Wiederanlauf dauerte 8.6 statt 2 Stunden, weil das Ersatzteil fehlte, nicht weil Technik fehlte.' },
    { id: 'vote', no: 5, short: 'Abstimmung', q: 'Welche Massnahmen setzt MediLog um?', sub: 'Jedes Team nennt die Massnahmen aus seinem Entscheid.', kind: 'count', items: MEAS,
      ours: ['Zweite Internetleitung', 'WLAN doppelt', 'USV und Notstrom', 'ERP-Cluster', 'Notfallprozess'], note: "Unsere Empfehlung: Basis + ERP-Cluster + Notfallprozess, rund 99.87 %, CHF 240'000 einmalig. Hosting nur nachverhandelt, Rotkreuz zurückstellen." },
  ];
  const $ = s => document.querySelector(s);
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fresh = () => ({ step: 0, counts: {}, texts: {}, reveal: {} });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { S = fresh(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  function nav() {
    $('#vtSteps').innerHTML = STEPS.map((st, i) => `<button class="vt-dot ${i === S.step ? 'on' : ''}" data-i="${i}">${i === S.step ? `<span>${st.no}</span>${esc(st.short)}` : st.no}</button>`).join('');
    document.querySelectorAll('.vt-dot').forEach(b => b.addEventListener('click', () => go(+b.dataset.i)));
    $('#vtPrev').disabled = S.step === 0; $('#vtNext').disabled = S.step === STEPS.length - 1;
  }
  function render() {
    const st = STEPS[S.step], rev = !!S.reveal[st.id];
    let body = '';
    if (st.kind === 'count') {
      const c = S.counts[st.id] || {}, max = Math.max(4, ...st.items.map(n => c[n] || 0));
      body = `<div class="vt-grid">${st.items.map((n, i) => {
        const v = c[n] || 0, ours = rev && st.ours.includes(n);
        return `<button class="vt-card ${ours ? 'ours' : ''} ${v ? 'has' : ''}" data-n="${esc(n)}" style="--d:${i * 40}ms">
          <span class="vt-name">${esc(n)}${ours ? '<i class="vt-tag">unsere Wahl</i>' : ''}</span>
          <span class="vt-bar"><i style="width:${v / max * 100}%"></i></span>
          <span class="vt-num">${v}</span></button>`;
      }).join('')}</div>`;
    } else {
      const list = S.texts[st.id] || [];
      body = `<form class="vt-add" id="vtAdd"><input id="vtIn" maxlength="80" placeholder="Antwort eines Teams eintippen und Enter drücken" autocomplete="off"><button class="btn primary" type="submit">Hinzufügen</button></form>
        <div class="vt-chips">${list.map((t, i) => `<span class="vt-chip" style="--d:${i * 40}ms">${esc(t)}<button data-del="${i}" title="Entfernen">×</button></span>`).join('') || '<span class="vt-empty">Noch keine Antworten.</span>'}</div>
        ${rev ? `<div class="vt-ours"><b>Unsere Punkte</b>${st.ours.map(t => `<span class="vt-chip ours">${esc(t)}</span>`).join('')}</div>` : ''}`;
    }
    $('#vtMain').innerHTML = `<section class="vt-q enter"><div class="vt-eyebrow">Frage ${st.no} von ${STEPS.length}</div><h1>${esc(st.q)}</h1><p>${esc(st.sub)}</p></section>
      ${body}
      <div class="vt-reveal">${rev ? `<div class="vt-note">${esc(st.note)}</div><button class="btn ghost" id="vtHide">Auflösung ausblenden</button>` : `<button class="btn ghost" id="vtShow">${st.id === 'vote' ? 'Unsere Empfehlung einblenden' : 'Auflösung zeigen'}</button>`}</div>`;
    bind(st); nav();
  }
  function bind(st) {
    document.querySelectorAll('.vt-card').forEach(b => {
      b.addEventListener('click', () => bump(st.id, b.dataset.n, 1));
      b.addEventListener('contextmenu', e => { e.preventDefault(); bump(st.id, b.dataset.n, -1); });
    });
    $('#vtAdd')?.addEventListener('submit', e => {
      e.preventDefault(); const v = $('#vtIn').value.trim(); if (!v) return;
      (S.texts[st.id] = S.texts[st.id] || []).push(v); save(); render(); $('#vtIn').focus();
    });
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { S.texts[st.id].splice(+b.dataset.del, 1); save(); render(); }));
    $('#vtShow')?.addEventListener('click', () => { S.reveal[st.id] = true; save(); render(); });
    $('#vtHide')?.addEventListener('click', () => { S.reveal[st.id] = false; save(); render(); });
    if (st.kind === 'text') $('#vtIn').focus();
  }
  function bump(id, n, d) {
    const c = S.counts[id] = S.counts[id] || {};
    c[n] = Math.max(0, (c[n] || 0) + d); save();
    const st = STEPS[S.step], max = Math.max(4, ...st.items.map(x => c[x] || 0));
    document.querySelectorAll('.vt-card').forEach(card => {
      const v = c[card.dataset.n] || 0;
      card.querySelector('.vt-bar i').style.width = (v / max * 100) + '%';
      card.querySelector('.vt-num').textContent = v;
      card.classList.toggle('has', v > 0);
      if (card.dataset.n === n && d > 0) { card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop'); }
    });
  }
  function go(i) { S.step = Math.max(0, Math.min(STEPS.length - 1, i)); save(); render(); }
  $('#vtPrev').addEventListener('click', () => go(S.step - 1));
  $('#vtNext').addEventListener('click', () => go(S.step + 1));
  $('#vtReset').addEventListener('click', () => { if (confirmReset()) { S = fresh(); save(); render(); } });
  let armed = 0;
  function confirmReset() { // zweimal klicken statt Browser-Dialog
    if (Date.now() - armed < 3000) return true;
    armed = Date.now(); $('#vtReset').textContent = 'Nochmals klicken'; setTimeout(() => { $('#vtReset').textContent = 'Zurücksetzen'; }, 3000); return false;
  }
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') go(S.step + 1);
    if (e.key === 'ArrowLeft') go(S.step - 1);
  });
  render();
})();
