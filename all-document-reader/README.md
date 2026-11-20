# 📚 All Document Reader

All-in-one prehliadač dokumentov, ktorý beží priamo v prehliadači – bez servera, bez inštalácie a offline
(všetky knižnice sú v priečinku `vendor/`). Súbory sa nikam neodosielajú, všetko sa spracúva lokálne.

## Funkcie

| Oblasť | Čo aplikácia vie |
|---|---|
| **Formáty** | PDF, DOCX, XLSX/XLS/ODS, PPTX, TXT/MD/LOG/JSON/XML, CSV/TSV. Obmedzene (len text): DOC, PPT, ODT, RTF |
| **Triedenie** | Skenuje vybraný priečinok (rekurzívne) a zoskupuje dokumenty podľa formátu; kategórie *Nedávne* a *So záložkami* |
| **Správa súborov** | Detaily (veľkosť, cesta, dátum zmeny), premenovanie, odstránenie, zdieľanie (Web Share API alebo stiahnutie) |
| **Čítanie** | Rýchle načítanie (PDF strany sa vykresľujú postupne), navigácia po stranách/snímkach, priblíženie, hľadanie v dokumente so zvýraznením, záložky |
| **Ostatné** | Drag & drop súborov aj priečinkov, tmavý režim, mobilné rozloženie, klávesové skratky |

Zameranie je **„prezeranie namiesto úprav“** – aplikácia je prehliadač, nie editor.

## Spustenie

Aplikácia potrebuje byť servírovaná cez HTTP (kvôli PDF workeru):

```bash
cd all-document-reader
python3 -m http.server 8080
# otvorte http://localhost:8080
```

## Oprávnenia

- **Chrome / Edge**: tlačidlo *Skenovať priečinok* používa File System Access API. Pri premenovaní alebo
  odstránení sa prehliadač opýta na povolenie zápisu – zmeny sa potom prejavia priamo na disku.
- **Firefox / Safari**: priečinok sa načíta cez výber priečinka len na čítanie; premenovanie a odstránenie
  ovplyvní iba zoznam v aplikácii.
- Záložky, nedávne súbory a téma sa ukladajú do `localStorage` prehliadača.

## Klávesové skratky (v otvorenom dokumente)

| Skratka | Akcia |
|---|---|
| `Ctrl/⌘ + F` | Hľadať v dokumente |
| `Enter` / `Shift + Enter` | Ďalší / predchádzajúci výsledok |
| `Ctrl/⌘ + +` / `−` | Priblížiť / oddialiť |
| `Esc` | Zavrieť dokument |

## Použité knižnice (vo `vendor/`)

- [PDF.js](https://mozilla.github.io/pdf.js/) 3.11.174 – vykresľovanie PDF
- [mammoth.js](https://github.com/mwilliamson/mammoth.js) 1.6.0 – DOCX → HTML
- [SheetJS](https://sheetjs.com/) 0.18.5 – XLSX/XLS/ODS/CSV
- [JSZip](https://stuk.github.io/jszip/) 3.10.1 – čítanie PPTX/ODT
