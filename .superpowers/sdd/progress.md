# Produkt-Erfassung — Integration SDD-Ledger
Plan: obsidian/30_Projekte/KI_Automatisierung/Produkt_Erfassung_Integration_Plan.md
Repo: ~/Downloads/product-upload (github manufarbkontrast/PRODUCT-UPLOAD)
Ziel-DB: mycrafton (genzhiywvfrsouhnkise), gemeinsam mit Brain Cockpit.

Phase 1 DB-Fundament: DONE (Migration 20260715 in mycrafton applied — products+product_images (RLS an, keine anon-Policies), Buckets product-images/processed-images. profiles hat bereits role+filiale (PK=id). jtl_articles/jtl_stock_locations existieren (Cockpit-Sync); jtl_articles.name != Upload-Erwartung artikel_name -> im jtl-lookup-Code mappen.)

Task P1 App→mycrafton: complete (require-filiale auf profiles.id + Rollen-Gate, /api/jtl-lookup kanonisch, EanScanner auf jtl-lookup, Google-Drive-JSON- + Gemini-Vision-Pfade entfernt, review clean).
Task P3 Barcode-Scan mobil härten: complete (commits b1484d5..85dea3b + fix 139efd0, re-review Approved — scan-crop-Geometrie via lib/scan-crop.ts an object-cover-Sichtfenster angeglichen, 4 Geometrie-Tests, Suite 102/102 grün).
Task P4a Foto-Ansichten + Grafiken: complete (commit d780ab6, review Approved — 4 kanonische Views seite_aussen/sohle/schraeg_vorne/paar_profil in config/shoe-views.ts mit anweisung/piktogramm/silhouette, 8 SVGs in public/foto-guide/, gemini-classifier + image-processing + ShoeViewIndicator konsistent auf 4 umgestellt, 15 Tests). Minor-Follow-up: scripts/audit-drive-images.ts (Standalone, nicht importiert) nutzt noch alte 5 Keys.
Task P4b Geführte Foto-Aufnahme: complete (commit 4d4bd97 + fix a251f0f, re-review Approved — components/GuidedPhotoCapture.tsx (3-Phasen-Flow Anleitung/Aufnahme/Vorschau, Live-Silhouetten-Overlay pointer-events-none opacity-40, environment-Kamera), lib/guided-capture.ts (immutabler State-Machine, 18 Tests) + lib/camera-errors.ts (extrahiert, EanScanner unangetastet) + lib/sort-order.ts (parseSortOrder bounded [0,SHOE_VIEWS.length), 11 Tests). Upload via bestehendem POST /api/products/{id}/images (additiver sortOrder-Param, 400 bei ungültig), danach POST /process. Klassischer ImageUploader-Fallback bleibt. Kamera-Stream-Cleanup-Guard gegen Leak bei Abbruch während Permission-Prompt. Suite 131/131 grün.
Offen: P5 Deployment (braucht rotierten GEMINI_API_KEY + mycrafton service_role + Drive-Entscheidung), P2 Rollen-Weiche (ZULETZT).
