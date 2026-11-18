-- Portal-Modul/Feature-Keys und Routen von sprint -> acquisition / akquise umstellen.
-- IDs (sprint-module, sprint-feature-*, sprint-perm-*) bleiben unverändert.

UPDATE "PortalModule"
SET "key" = 'acquisition', "name" = 'Akquise'
WHERE "key" = 'sprint';

UPDATE "PortalFeature"
SET "key"   = replace("key", 'sprint_', 'acquisition_'),
    "route" = replace("route", '/sprint-targets', '/akquise')
WHERE "key" LIKE 'sprint\_%' OR "route" LIKE '/sprint-targets%';
