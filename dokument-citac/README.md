# Čítačka dokumentov

Offline čítačka dokumentov pre mobil: PDF, Word (.docx), Excel (.xlsx, .xls, .ods, .csv),
PowerPoint (.pptx), textové súbory (.txt, .json, .md, …) a obrázky. Súbory sa otvárajú
priamo v zariadení, nič sa neodosiela na internet.

- `npm install && npm run build` → `dist/index.html` (jeden súbor, funguje aj bez internetu)
- Android APK zostavuje GitHub Actions (`.github/workflows/android-apk.yml`) pri každej zmene
  v tomto priečinku a zverejní ho v sekcii **Releases** repozitára.
