-- Fachliche Entkopplung: Dienstleistung/Leistungen gehören ins Angebot, nicht
-- an ein Paket->Rollen-Abhängigkeit. Rollenbedarf kommt nur noch kundenspezifisch
-- aus AcquisitionTargetRole. Die Alt-Tabelle entfällt.
DROP TABLE IF EXISTS "SprintPackageRole";
DROP TABLE IF EXISTS "AcquisitionPackageRole";
