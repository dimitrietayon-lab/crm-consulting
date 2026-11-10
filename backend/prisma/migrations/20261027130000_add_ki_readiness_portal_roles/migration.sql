-- KI-Readiness-Rollen für die Rollenverwaltung (Administration → Rollen)
INSERT INTO "PortalRole" ("id", "name", "description", "isSystem", "createdAt", "updatedAt")
VALUES
  ('sprint-role-lead', 'Lead Berater', 'Verantwortet den KI-Readiness Sprint beim Kunden', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sprint-role-ki', 'KI-Experte', 'Führt KI-Readiness-Assessment und Use-Case-Erarbeitung durch', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sprint-role-sales', 'Vertrieb', 'Verantwortet Akquise und Angebot im KI-Readiness Sprint', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
