-- Phasenmodell: Erstgespräch und Angebot sind jetzt mehrstufig.
-- Altdaten auf die passende Stufe heben, damit keine Zielkunden aus Kanban
-- und Filtern verschwinden.
UPDATE "SprintTarget" SET "status" = 'Erstgespräch durchgeführt'
WHERE "status" = 'Erstgespräch';

UPDATE "SprintTarget" SET "status" = 'Angebot versendet'
WHERE "status" = 'Angebot';
