# Produkt-Erfassung — Integration SDD-Ledger
Plan: obsidian/30_Projekte/KI_Automatisierung/Produkt_Erfassung_Integration_Plan.md
Repo: ~/Downloads/product-upload (github manufarbkontrast/PRODUCT-UPLOAD)
Ziel-DB: mycrafton (genzhiywvfrsouhnkise), gemeinsam mit Brain Cockpit.

Phase 1 DB-Fundament: DONE (Migration 20260715 in mycrafton applied — products+product_images (RLS an, keine anon-Policies), Buckets product-images/processed-images. profiles hat bereits role+filiale (PK=id). jtl_articles/jtl_stock_locations existieren (Cockpit-Sync); jtl_articles.name != Upload-Erwartung artikel_name -> im jtl-lookup-Code mappen.)
