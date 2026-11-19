# Site Bug Annotator

**Estensione Chrome per annotare visivamente qualsiasi sito web.** Clicchi su un elemento della pagina, scrivi cosa va corretto e la segnalazione resta "appuntata" lì con un pin numerato. Dal pannello laterale gestisci l'elenco dei fix, li segni come fatti, filtri per dispositivo ed esporti tutto in JSON.

> ### 👋 Una premessa sincera
> **Non sono uno sviluppatore.** Questa estensione è nata da un'esigenza concreta (raccogliere le correzioni da fare sui siti senza perdersi tra screenshot, email e chat) ed è stata realizzata **interamente con l'intelligenza artificiale, in modalità _vibe coding_**: io descrivevo cosa volevo, l'AI scriveva il codice, io provavo e chiedevo modifiche.
>
> Significa che:
> - il codice funziona per l'uso per cui è nato, ma **non ha la revisione di un programmatore esperto**;
> - possono esserci bug, casi limite non gestiti o soluzioni poco eleganti;
> - segnalazioni, suggerimenti e pull request sono benvenuti, soprattutto da chi ne sa più di me.
>
> Usala liberamente, ma con lo spirito giusto: è un progetto personale, condiviso così com'è.

---

## Funzionalità

- **Modalità segnalazione**: evidenzia l'elemento sotto il mouse (con il nome del tag) e al clic apre una piccola finestra per scrivere il commento. `⌘/Ctrl + Invio` per salvare, `Esc` per annullare o uscire.
- **Pin numerati** sulla pagina, visibili solo a chi ha l'estensione installata. Rossi se da fare, verdi se completati.
- **Pannello laterale** con l'elenco delle segnalazioni del sito, contatori, schede *Tutte / Da fare / Fatte*.
- **Vista dispositivo**: emulazione Desktop 1440 × 900, Tablet 768 × 1024 e Mobile 390 × 844 tramite Chrome DevTools Protocol. La finestra si restringe alla larghezza del dispositivo (centrata dov'era), così il sito occupa tutta l'area senza spazi vuoti; tornando a *Normale* riprende la dimensione originale. Se lo schermo è troppo piccolo per Desktop 1440, la pagina viene ridotta in scala. Ogni segnalazione ricorda la vista in cui è stata creata e il pulsante **Mostra** la ripristina.
- **Filtro per dispositivo**: pin e lista mostrano solo le segnalazioni Desktop, Tablet, Mobile o tutte.
- **Mostra**: apre la pagina giusta, scorre fino all'elemento e lo evidenzia (anche su single-page app).
- **Pin on/off**: nasconde tutti i pin per navigare il sito "pulito".
- **Esporta / Importa JSON** per condividere le segnalazioni con colleghi o archiviarle.
- Funziona anche su siti protetti da **HTTP Basic Auth** o da login applicativo (basta essere già entrati).
- Interfaccia ispirata ad **Atlassian Design System**, con supporto automatico al **tema scuro**.

## Installazione

### Dalla release (consigliato)

1. Scarica `site-bug-annotator-chrome-v1.0.0.zip` dalla pagina [Releases](../../releases).
2. Estrai lo zip in una cartella che non cancellerai (Chrome la usa ogni volta).
3. Apri `chrome://extensions`.
4. Attiva **Modalità sviluppatore** in alto a destra.
5. Clicca **Carica estensione non pacchettizzata** e seleziona la cartella estratta (quella che contiene `manifest.json`).
6. Fissa l'icona nella barra degli strumenti e cliccala per aprire il pannello.

Dopo la prima installazione **ricarica le schede già aperte**.

### Dal codice sorgente

```bash
git clone <url-del-repository>
```

Poi segui i passi 3–5 selezionando la cartella `extension/`.

## Come si usa

1. Apri il sito da revisionare e clicca l'icona dell'estensione: si apre il pannello laterale.
2. (Opzionale) Scegli la **Vista dispositivo** per simulare tablet o mobile.
3. Premi **Segnala**, passa il mouse sulla pagina e clicca l'elemento da correggere.
4. Scrivi il commento e premi **Aggiungi**.
5. Dal pannello: **Mostra** per ritrovare l'elemento, **Fatto** per chiudere la segnalazione, cestino per eliminarla.

## Permessi richiesti

| Permesso | Perché serve |
|---|---|
| `storage` | Salvare segnalazioni e impostazioni nel browser. |
| `activeTab`, `scripting`, `<all_urls>` | Mostrare pin ed evidenziazioni su qualsiasi sito. |
| `sidePanel` | Il pannello laterale. |
| `debugger` | Emulare le viste Desktop/Tablet/Mobile. Mentre è attiva, Chrome mostra la barra *"Site Bug Annotator ha avviato il debug di questo browser"*: è normale. Se la chiudi con *Annulla*, l'estensione torna alla vista normale. |

**Privacy**: nessun dato viene raccolto o inviato a server esterni. Tutto resta nel tuo browser (`chrome.storage.local`).

## Limiti noti

- Le segnalazioni **non sono sincronizzate** tra computer: per condividerle usa Esporta/Importa JSON.
- Il riconoscimento dell'elemento usa selettore CSS + "impronta" (testo, link, classi): dopo modifiche pesanti al DOM può non ritrovarlo.
- Niente screenshot automatici, per ora.
- Il progetto è identificato dal dominio: staging e produzione sono progetti separati.
- Non funziona sulle pagine interne di Chrome (`chrome://`, Chrome Web Store, ecc.).

## Struttura del progetto

```
extension/
├── manifest.json      # Manifest V3
├── background.js      # Service worker: emulazione dispositivi e adattamento finestra
├── content.js / .css  # Script nella pagina: pin, evidenziazione, finestra commento
├── sidepanel.html     # Pannello laterale
├── sidepanel.css      # Stili (token ispirati ad Atlassian Design System)
├── sidepanel.js       # Logica del pannello
└── icons/
```

## Contribuire

Issue e pull request sono benvenute. Visto come è nato il progetto, apprezzo in particolare:
revisioni del codice, segnalazioni di bug con i passi per riprodurli e consigli su come migliorare l'affidabilità.

## Licenza

[MIT](LICENSE)

---

*Site Bug Annotator non è affiliato, sponsorizzato o approvato da Atlassian. Atlassian è un marchio del rispettivo proprietario; l'interfaccia si ispira soltanto alle linee guida pubbliche dell'Atlassian Design System.*

---

## English summary

**Site Bug Annotator** is a Chrome extension (Manifest V3) to visually annotate any website: click an element, write what needs fixing, and a numbered pin stays attached to it. A side panel lists all issues per site, with To do / Done status, desktop/tablet/mobile emulation (the window resizes to the device width) and filters, plus JSON import/export. All data stays in your browser.

**Honest disclaimer: I'm not a developer.** This project was built entirely with AI through *vibe coding* — I described what I wanted, the AI wrote the code, and I tested and iterated. It works for my use case but hasn't been reviewed by a professional developer, so expect rough edges. Issues and pull requests are very welcome.

Install: download the Chrome zip from Releases, unzip it, open `chrome://extensions`, enable Developer mode, click **Load unpacked** and select the unzipped folder.
