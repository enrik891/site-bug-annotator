# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate qui.
Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/) e il progetto usa il [Semantic Versioning](https://semver.org/lang/it/).

## [1.0.0] - 2026-11-19

Prima versione pubblica.

### Aggiunto
- Interfaccia del pannello laterale ridisegnata con token ispirati ad Atlassian Design System.
- Tema scuro automatico.
- Finestra di commento nella pagina (Shadow DOM) al posto di `prompt()`, con scorciatoie `⌘/Ctrl + Invio` ed `Esc`.
- Etichetta con il nome dell'elemento durante la selezione; `Esc` esce dalla modalità segnalazione.
- Contatori nelle schede *Tutte / Da fare / Fatte*.
- Notifiche ("flag") e modale di conferma nel pannello al posto di `alert()` / `confirm()`.
- Stati vuoti con illustrazione e testo contestuale.
- Viste Desktop/Tablet/Mobile: la finestra si adatta alla larghezza del dispositivo (centrata) e viene ripristinata tornando alla vista normale; riduzione in scala se lo schermo è troppo piccolo.
- Ritorno automatico alla vista normale se si chiude la barra di debug di Chrome.
- Nuova icona.
- Evidenziazione della scheda nel pannello quando si clicca un pin.

### Modificato
- Nuovo design di pin, evidenziazione e toast nella pagina, protetti dagli stili del sito ospite.
- Testi e descrizione dell'estensione rivisti.

## Versioni precedenti (0.x)
Prototipi interni: annotazione elementi, pin, sidebar, stati, esportazione/importazione JSON, filtri e viste dispositivo tramite Chrome DevTools Protocol.
