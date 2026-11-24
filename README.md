# MediLog Incident-Portal

Escape-Workshop zum Gruppencase 9 (ERP Advanced, HSLU).

## Lokal starten
VS Code mit der Erweiterung «Live Server»: unten rechts auf «Go Live».
Oder im Terminal: `python3 -m http.server 8000` und im Browser `http://localhost:8000` öffnen.
Hinweis: Die Seite braucht `localhost` oder `https`, direkt per Doppelklick (file://) funktioniert die Codeprüfung nicht.

## Spielleitung
Logo oben links 5-mal schnell anklicken, dann den Leitungscode eingeben.
Dort: aktuellen Schritt freischalten, Bonus freischalten, +5 Minuten, Team zurücksetzen.

## Struktur
- `index.html` – Login, Portal, Dossier
- `assets/js/levels.js` – Texte der Schritte, Mails, Dokumente
- `assets/js/app.js` – Ablauf, Countdown, Codeprüfung, Dossier
- `assets/js/hashes.js` – Lösungen als SHA-256-Hash
- `assets/mails`, `assets/docs`, `assets/files` – Unterlagen und Excel-Vorlage

## Sicherheit
- Statische Seite ohne Server und Datenbank: keine Logins, keine Formulardaten auf einem Server, keine SQL-Injection möglich.
- Codes sind nicht im Klartext im Code. Ein Code ist richtig, wenn er den Schlüssel des Schritts entschlüsselt (PBKDF2 mit 200'000 Runden, AES-GCM).
- Mails und PDFs ab Schritt 2 liegen verschlüsselt unter `assets/x/` und öffnen sich erst mit dem richtigen Code.
- Content-Security-Policy, keine externen Skripte oder Schriften, kein Einbetten in fremde Seiten, nicht für Suchmaschinen.
- Nach 5 falschen Codes 30 Sekunden Sperre.
- Musterlösung und Klartext-Unterlagen gehören nie in dieses Repo.
