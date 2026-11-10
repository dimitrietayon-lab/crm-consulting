-- Phasenmodell: Die Übergabe-Checkliste setzte früher den Status "Kunde",
-- der nicht im kanonischen Statusmodell enthalten war (Zielkunden verschwanden
-- dadurch aus Kanban/Filtern). Altdaten auf "gewonnen" normalisieren.
UPDATE "SprintTarget" SET "status" = 'gewonnen' WHERE "status" = 'Kunde';
