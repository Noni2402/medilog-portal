// Inhalte des Portals: Schritte, Mails, Dokumente
window.GAME = {
  durationMin: 40,
  mails: {
    m1: { file: '01_Mail_CEO_Auftrag.png', from: 'Daniel Furrer', role: 'CEO', init: 'DF', time: null, subject: 'GL-Sitzung heute: Entscheid Verfügbarkeit Auftragsabwicklung' },
    m2: { enc: 'a2', k: 's1', from: 'Reto Kaufmann', role: 'Leiter Informatik', init: 'RK', time: null, subject: 'AW: Verfügbarkeit – Blatt Redundanz' },
    m3: { enc: 'a3', k: 's2', from: 'Claudia Bühler', role: 'Leiterin Logistik', init: 'CB', time: null, subject: 'Ausfallkosten – bitte nicht mit Durchschnitten rechnen' },
    m4: { enc: 'a4', k: 's3', from: 'Reto Kaufmann', role: 'Leiter Informatik', init: 'RK', time: '14.10.', subject: 'Störungsbericht INC-2026-1013: Ausfall ERP-Server 13.10.2026', rel: ['d1', 'd3', 'd4'] },
    m5: { enc: 'a5', k: 's4a', from: 'Patrick Gisler', role: 'Leiter Verkauf', init: 'PG', time: '22.10.', subject: 'Kündigungen Rahmenverträge – wir brauchen ein Versprechen', rel: ['d4'] },
    m6: { enc: 'a6', k: 's4a', from: 'Sandra Imhof', role: 'CFO', init: 'SI', time: null, subject: 'Freigabe Blatt «Massnahmen»' },
  },
  docs: {
    d1: { enc: 'b1', k: 's3', title: 'Kurierrechnung RB-2026-10418', short: 'Kurierrechnung', meta: 'Reussblitz Kurier GmbH · 31.10.2026' },
    d3: { enc: 'b3', k: 's3', title: 'Brief Zentralspital Pilatus', short: 'Brief Spital', meta: 'Einschreiben · 20.10.2026' },
    d4: { enc: 'b4', k: 's3', title: 'Hosting-Vertrag, Anhang B: SLA', short: 'Hosting-Vertrag', meta: 'Alpstream Datacenter AG · 02.11.2026' },
  },
  steps: [
    {
      id: 's1', title: 'Verfügbarkeit heute', sheet: 'Verfügbarkeit',
      lead: 'Wie verfügbar ist die Auftragsabwicklung heute, als ganze Kette?',
      how: ['Excel in der Excel-App öffnen, nicht in Excel Online.', 'Blatt «Verfügbarkeit» öffnen. Anzahl Störungen und Ausfallzeit je Komponente sind schon gezählt.', 'In die erste gelbe Zeile MTTR, MTBF und Verfügbarkeit als Formel eintragen und bis zur letzten Komponente nach unten ziehen.', 'In der Zeile «Kette» die Verfügbarkeit der ganzen Kette berechnen.'],
      formulas: ['MTTR = Ausfallzeit ÷ Anzahl Störungen', 'MTBF = (Jahre × Kalenderstunden − Ausfallzeit) ÷ Anzahl Störungen', 'Verfügbarkeit = MTBF ÷ (MTBF + MTTR)', 'Kette in Serie = PRODUKT aller Verfügbarkeiten', 'Kurznamen im Excel: Jahre (3), Kalenderstunden (8\'760)'],
      todo: [{ t: 'Mail des CEO lesen', mail: 'm1' }, { t: 'Excel herunterladen', go: 'downloads' }],
      fields: [{ key: 's1', label: 'Verfügbarkeit der Kette', unit: '%', step: '0.01', norm: 'fix2' }],
      unlock: { mails: ['m2'] }
    },
    {
      id: 's2', title: 'Redundanz', sheet: 'Redundanz',
      lead: 'Was bringen doppelte Komponenten wirklich?',
      how: ['Blatt «Redundanz» öffnen und den Blattschutz aufheben: Überprüfen → Blattschutz aufheben.', 'In den violetten Feldern die richtige Ausführung einstellen.', 'Gelbe Felder: Verfügbarkeit für die doppelten Komponenten, dann beide Ketten mit PRODUKT. Die Spalten «realistisch» rechnen automatisch.'],
      formulas: ['Doppelt, unabhängig: A = 1 − (1 − A einfach)²', 'Einfach: A bleibt gleich', 'Realistisch: Ein Teil der Ausfälle trifft beide Komponenten gleichzeitig (β, gleicher Raum, Strom, Update), dazu kommt die Umschaltzeit.'],
      todo: [{ t: 'Mail von Reto Kaufmann lesen', mail: 'm2' }],
      fields: [{ key: 's2', label: 'Verfügbarkeit der Kette, realistisch', unit: '%', step: '0.01', norm: 'fix2' }],
      unlock: { mails: ['m3'] }
    },
    {
      id: 's3', title: 'Kosten nach Tageszeit', sheet: 'Kosten',
      lead: 'Wann ist ein Ausfall am teuersten?',
      how: ['Blatt «Kosten» öffnen. Es ist mit einem Freigabecode gesperrt.', 'Gelbe Felder: «Marge verloren pro h» und «Summe pro h» für jedes Zeitfenster.', 'Im Ausfallrechner die drei Ausfälle vergleichen, um die es geht. Beginn als volle Stunde (0 bis 23).'],
      formulas: ['Marge verloren pro h = Umsatz pro h × Verlust an Konkurrenz × Bruttomarge', 'Summe pro h = Marge verloren + Überstunden + Express', 'Kurzname im Excel: Bruttomarge (9 %)'],
      todo: [{ t: 'Mail von Claudia Bühler lesen', mail: 'm3' }],
      fields: [{ key: 's3', label: 'Kosten des teuersten Ausfalls', unit: 'CHF', step: '1', norm: 'int' }],
      unlock: { mails: ['m4'], docs: ['d1', 'd3', 'd4'] }
    },
    {
      id: 's4', title: 'Die Oktober-Akte', sheet: 'Oktober',
      lead: 'Was hat der Ausfall vom 13. Oktober gekostet, und was hätte das Hosting-SLA bezahlt?',
      how: ['Im Blatt «Oktober» die Zeitachse ausfüllen, Uhrzeit mit Doppelpunkt (z. B. 08:15). RTO und RPO rechnen sich.', 'Die Mengen in den violetten Feldern aus den Unterlagen bestimmen. Nicht jede Zahl gehört in die Rechnung.', 'In Abschnitt 3 die Stunden im Oktober eintragen. Die SLA-Gutschrift rechnet sich.'],
      formulas: ['Zeigt «Ansatz» gesperrt? Dann zuerst das Blatt «Kosten» freigeben und ausfüllen.'],
      todo: [{ t: 'Störungsbericht lesen', mail: 'm4' }, { t: 'Unterlagen ansehen', go: 'docs' }],
      fields: [{ key: 's4a', label: 'Direkter Schaden', unit: 'CHF', step: '1', norm: 'int' }],
      unlock: { mails: ['m5', 'm6'] }
    },
    {
      id: 's5', title: 'Entscheid für die GL', sheet: 'Massnahmen',
      lead: 'Welche Massnahmen empfehlt ihr der Geschäftsleitung?',
      how: ['Blatt «Massnahmen» öffnen. Es ist mit einem Passwort geschützt.', 'Massnahmen auf Ja oder Nein stellen.', 'Eure zwei Annahmen setzen: Kundenverlust pro Jahr und verlorene Bestellungen.', 'Spielt mit euren Annahmen: Setzt den Kundenverlust einmal auf 0, einmal auf den Oktober-Wert und einmal deutlich höher. Rechts im Blatt seht ihr, ob das günstigste Szenario wechselt.', 'Ergebnis mit den Szenarien vergleichen und unter «Entscheid» erfassen.'],
      formulas: ['Kundenverlust in CHF Marge pro Jahr: Welche Kunden hat der Oktober-Ausfall gekostet?', '100 % verlorene Bestellungen = Werte aus dem Case, 200 % = doppelt so viele', 'Summe über fünf Jahre = einmalig + 5 × (laufend + Schaden)'],
      todo: [{ t: 'Mail der CFO lesen', mail: 'm6' }, { t: 'Mail von Patrick Gisler lesen', mail: 'm5' }, { t: 'Entscheid erfassen', go: 'decision' }],
      decision: true
    }
  ],
  bonus: {
    key: 'bonus', title: 'Bonus: Die Rechnung der CFO',
    lead: 'Die CFO spricht von «alle paar Jahre einmal». Wie viele Störungen hatte die Kette pro Jahr wirklich?',
    fields: [{ key: 'bonus', label: 'Störungen pro Jahr', unit: '', step: '0.01', norm: 'fix12' }]
  },
  measures: ['Zweite Internetleitung', 'WLAN doppelt', 'USV und Notstrom', 'ERP-Cluster', 'Zweitstandort Rotkreuz', 'Notfallprozess', 'Hosting ERP, DB und WMS'],
  components: ['Internetleitung', 'Firewall', 'ERP-Server', 'ERP-Datenbank', 'WMS', 'Lager-WLAN', 'Stromversorgung']
};
