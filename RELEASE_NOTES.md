# Site Bug Annotator v1.0.0 🎉

Prima versione pubblica. Un'estensione Chrome per **annotare visivamente qualsiasi sito web**: clicchi un elemento, scrivi cosa va corretto e un pin numerato resta lì finché il fix non è fatto.

> ⚠️ **Nota onesta:** non sono uno sviluppatore. L'estensione è stata realizzata interamente con l'AI in modalità *vibe coding*. Funziona per l'uso per cui è nata, ma potrebbe avere qualche spigolo: segnalazioni e pull request sono benvenute.

## ✨ Novità
- **Nuova interfaccia** ispirata ad Atlassian Design System: tipografia, colori, lozenge di stato, schede con contatori, filtro dispositivi a segmenti.
- **Tema scuro automatico**, segue le impostazioni del sistema.
- **Nuova finestra di commento nella pagina** al posto del vecchio popup del browser: mostra l'elemento selezionato, `⌘/Ctrl + Invio` per salvare, `Esc` per annullare.
- **Evidenziazione migliorata** in modalità segnalazione, con il nome dell'elemento sotto il mouse; `Esc` esce dalla modalità.
- **Notifiche e conferme integrate** nel pannello (niente più `alert` del browser).
- **Viste Tablet e Mobile migliorate**: la finestra si adatta alla larghezza del dispositivo, centrata, invece di lasciare il sito schiacciato a sinistra con uno spazio vuoto. Tornando a *Normale* riprende la dimensione originale.
- Nuova icona e pin con nuovo design; le schede si evidenziano quando clicchi un pin.

## 🧰 Funzionalità
- Pin numerati per pagina, visibili solo con l'estensione installata
- Stato *Da fare / Fatto*, filtri per stato e per dispositivo
- Emulazione Desktop 1440 × 900, Tablet 768 × 1024, Mobile 390 × 844
- **Mostra**: apre la pagina giusta, ripristina la vista e scorre all'elemento
- Esporta / Importa JSON
- Funziona anche dietro HTTP Basic Auth o login

## 📦 Installazione
1. Scarica **`site-bug-annotator-chrome-v1.0.0.zip`** qui sotto ed estrailo.
2. Apri `chrome://extensions` e attiva **Modalità sviluppatore**.
3. Clicca **Carica estensione non pacchettizzata** e seleziona la cartella estratta.
4. Ricarica le schede già aperte.

## 🔒 Privacy
Tutti i dati restano nel browser (`chrome.storage.local`). Nessun server esterno, nessuna raccolta dati.

## 📄 File
| File | Contenuto |
|---|---|
| `site-bug-annotator-chrome-v1.0.0.zip` | Estensione pronta da caricare in Chrome |
| Source code (zip / tar.gz) | Codice sorgente completo del repository |
