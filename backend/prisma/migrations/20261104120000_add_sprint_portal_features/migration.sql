-- Phase 4: Granulare Feature-Keys für den KI-Readiness Sprint (PortalFeature)
-- Fallback: Rollen mit dem bisherigen Sammelrecht 'sprint_targets' behalten den Zugriff,
-- solange ihnen keine granularen sprint_*-Rechte zugewiesen sind (siehe Sidebar.jsx).

-- ─── Modul ───────────────────────────────────────────────────────────────────
INSERT INTO "PortalModule" ("id", "key", "name", "icon", "color", "description", "order")
VALUES (
  'sprint-module', 'sprint', 'KI-Readiness Sprint', 'Crosshair', 'violet',
  'Zielkunden, Angebote, Reporting und Team für den KI-Readiness-Sprint', 12
)
ON CONFLICT ("key") DO NOTHING;

-- ─── Features ────────────────────────────────────────────────────────────────
INSERT INTO "PortalFeature" ("id", "moduleId", "key", "name", "route", "description", "order")
SELECT v."id", (SELECT "id" FROM "PortalModule" WHERE "key" = 'sprint'), v."key", v."name", v."route", NULL, v."order"
FROM (VALUES
  ('sprint-feature-dashboard',  'sprint_dashboard',  'Dashboard',       '/sprint-targets/dashboard',  1),
  ('sprint-feature-targets',    'sprint_targets',    'Zielkunden',      '/sprint-targets',            2),
  ('sprint-feature-import',     'sprint_import',     'Listen-Import',   '/sprint-targets/import',     3),
  ('sprint-feature-blocklist',  'sprint_blocklist',  'Sperrliste',      '/sprint-targets/blocklist',  4),
  ('sprint-feature-activities', 'sprint_activities', 'Aktivitäten',     '/sprint-targets/activities', 5),
  ('sprint-feature-offers',     'sprint_offers',     'Angebote',        '/sprint-targets/offers',     6),
  ('sprint-feature-outreach',   'sprint_outreach',   'Outreach',        '/sprint-targets/outreach',   7),
  ('sprint-feature-team',       'sprint_team',       'Team',            '/sprint-targets/team',       8),
  ('sprint-feature-reporting',  'sprint_reporting',  'Reporting',       '/sprint-targets/reporting',  9),
  ('sprint-feature-market',     'sprint_market',     'Marktauswahl',    '/sprint-targets/market',    10),
  ('sprint-feature-capacity',   'sprint_capacity',   'Planung',         '/sprint-targets/capacity',  11),
  ('sprint-feature-bafa',       'sprint_bafa',       'BAFA',            '/sprint-targets/bafa',      12),
  ('sprint-feature-contacts',   'sprint_contacts',   'Sprint-Kontakte', '/sprint-targets/contacts',  13),
  ('sprint-feature-settings',   'sprint_settings',   'Einstellungen',   '/sprint-targets/settings',  14)
) AS v("id", "key", "name", "route", "order")
ON CONFLICT ("key") DO NOTHING;

-- ─── Zuordnung zu den Sprint-Rollen ─────────────────────────────────────────
-- Alle drei Sprint-Rollen erhalten Vollzugriff; Admins können einzelne Rechte
-- später in der Rollenverwaltung entziehen.
INSERT INTO "PortalRolePermission" ("id", "roleId", "featureId", "canView", "canCreate", "canEdit", "canDelete")
SELECT
  'sprint-perm-' || r."id" || '-' || f."key",
  r."id",
  f."id",
  true, true, true, true
FROM "PortalRole" r
JOIN "PortalFeature" f ON f."key" IN (
  'sprint_dashboard', 'sprint_targets', 'sprint_import', 'sprint_blocklist',
  'sprint_activities', 'sprint_offers', 'sprint_outreach', 'sprint_team',
  'sprint_reporting', 'sprint_market', 'sprint_capacity', 'sprint_bafa',
  'sprint_contacts', 'sprint_settings'
)
WHERE r."id" IN ('sprint-role-lead', 'sprint-role-ki', 'sprint-role-sales')
ON CONFLICT ("roleId", "featureId") DO NOTHING;
