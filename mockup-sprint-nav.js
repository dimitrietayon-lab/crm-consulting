(function () {
  // ── 1. Inject shared design system CSS ───────────────────────
  if (!document.getElementById('sprint-ds')) {
    var link = document.createElement('link');
    link.id = 'sprint-ds';
    link.rel = 'stylesheet';
    link.href = 'mockup-sprint.css';
    document.head.appendChild(link);
  }

  // ── 2. SVG icon builder ───────────────────────────────────────
  // cls: extra class modifier (e.g. 'sm' → 'si si-sm')
  function si(d, cls) {
    var c = cls ? 'si si-' + cls : 'si';
    return '<svg class="' + c + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  }

  // ── 3. Emoji → SVG replacement map ───────────────────────────
  // Keys must be ordered longest-first if any are subsets of others.
  var ICON_MAP = [
    // ⚙️ must come before bare ⚙ variants
    ['⚙️', si('M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z')],
    ['✉️', si('M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z')],
    ['🗂️', si('M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7')],
    ['🏷️', si('M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z')],

    // Emoji icons
    ['🚀', si('M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z')], // sparkles
    ['📊', si('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z')], // chart-bar
    ['📋', si('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2')], // clipboard
    ['📅', si('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z')], // calendar
    ['⚡', si('M13 10V3L4 14h7v7l9-11h-7z')], // lightning-bolt
    ['🔔', si('M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9')], // bell
    ['⭐', si('M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z')], // star
    ['📞', si('M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z')], // phone
    ['📧', si('M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z')], // mail
    ['🤝', si('M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z')], // shield-check (meeting proxy)
    ['📄', si('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z')], // document-text
    ['✅', si('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0')], // check-circle
    ['🧠', si('M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z')], // light-bulb
    ['📝', si('M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z')], // pencil-alt
    ['💬', si('M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z')], // chat-alt2
    ['🔍', si('M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0')], // search
    ['💶', si('M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0')], // currency-euro
    ['👤', si('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z')], // user
    ['👥', si('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0')], // users
    ['💡', si('M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z')], // light-bulb
    ['📈', si('M13 7h8m0 0v8m0-8l-8 8-4-4-6 6')], // trending-up
    ['⚠️', si('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z')], // exclamation
    ['⏳', si('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0')], // clock
    // Unicode symbols (not emoji but visual)
    ['✓', si('M5 13l4 4L19 7', 'sm')],
    ['✗', si('M6 18L18 6M6 6l12 12', 'sm')],
  ];

  // ── 4. DOM text-node replacement ─────────────────────────────
  function replaceIconsInDOM() {
    // Build quick-lookup: does the body contain any replaceable char?
    var bodyText = document.body.textContent || '';
    var needed = ICON_MAP.filter(function(pair) {
      return bodyText.indexOf(pair[0]) !== -1;
    });
    if (!needed.length) return;

    // Walk all text nodes (skip <script> and <style> parents)
    var walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          var tag = node.parentNode && node.parentNode.tagName;
          return (tag === 'SCRIPT' || tag === 'STYLE')
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    var toReplace = [];
    var node;
    while ((node = walker.nextNode())) {
      var found = false;
      for (var i = 0; i < needed.length; i++) {
        if (node.data.indexOf(needed[i][0]) !== -1) { found = true; break; }
      }
      if (found) toReplace.push(node);
    }

    toReplace.forEach(function(textNode) {
      var html = textNode.data;
      needed.forEach(function(pair) {
        html = html.split(pair[0]).join(pair[1]);
      });
      var span = document.createElement('span');
      span.style.cssText = 'display:contents'; // invisible wrapper
      span.innerHTML = html;
      textNode.parentNode.replaceChild(span, textNode);
    });
  }

  // ── 5. Navigation definition ──────────────────────────────────
  var NAV_ITEMS = [
    { id: 'dashboard',    d: 'M3 13l2-2m0 0l7-7 7 7M5 11v8a1 1 0 001 1h3m10-10l2 2m-2-2v8a1 1 0 01-1 1h-3m-6 0h6',                                                                                                         label: 'Dashboard',   href: 'mockup-sprint-dashboard.html' },
    { id: 'kanban',       d: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7',                                                  label: 'Zielkunden',  href: 'mockup-sprint-kanban.html' },
    { id: 'liste',        d: 'M3 5h18M3 9h18M3 13h18M3 17h10',                                                                                                                                                                  label: 'Listenansicht', href: 'mockup-sprint-zielkunden-liste.html', sub: true },
    { id: 'import',       d: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',                                                                                                                                    label: 'Listen-Import', href: 'mockup-sprint-import.html',           sub: true },
    { id: 'sperrliste',   d: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',                                                                                          label: 'Sperrliste',  href: 'mockup-sprint-sperrliste.html',        sub: true },
    { id: 'aktivitaeten', d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',                                                          label: 'Aktivitäten', href: 'mockup-sprint-aktivitaeten.html' },
    { id: 'uebergabe',    d: 'M17 8l4 4m0 0l-4 4m4-4H3M7 8a3 3 0 100 6 3 3 0 000-6z',                                                                                                                                          label: 'Übergabe',     href: 'mockup-sprint-uebergabe.html',        sub: true },
    { id: 'kontakte',     d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0',                label: 'Kontakte',    href: 'mockup-sprint-kontakte.html' },
    { id: 'angebote',     d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',                                                                      label: 'Angebote',    href: 'mockup-sprint-angebote-liste.html' },
    { id: 'outreach',     d: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',                                                                                       label: 'Outreach',    href: 'mockup-sprint-outreach.html' },
    { id: 'team',         d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',                                                                              label: 'Team',        href: 'mockup-sprint-team.html' },
    { id: 'reporting',    d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'Reporting',   href: 'mockup-sprint-reporting.html' },
    { id: 'abdeckung',    d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0',                                                                                                                                                     label: 'Abdeckung',   href: 'mockup-sprint-abdeckung.html',       sub: true },
    { id: 'planung',      d: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',                              label: 'Planung',     href: 'mockup-sprint-planung.html',          sub: true },
    { id: 'bafa',         d: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0',               label: 'BAFA',        href: 'mockup-sprint-bafa.html' },
  ];

  var PARENT_MAP = {
    'detail':            'kanban',
    'assessment':        'kanban',
    'proposals':         'kanban',
    'angebot':           'angebote',
    'angebot-neu':       'angebote',
    'zielkunde-neu':     'kanban',
    'aktivitaet-loggen': 'aktivitaeten',
    'liste':             'kanban',
    'sperrliste':        'kanban',
    'planung':           'reporting',
    'abdeckung':         'reporting',
  };

  var SETTINGS_D = 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z';
  var GRID_D = 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z';

  // ── 5b. Platform-Admin navigation ────────────────────────────
  var PLATFORM_NAV = [
    { id: 'uebersicht',  d: GRID_D, label: 'Mandanten',        href: 'mockup-platform-uebersicht.html' },
    { id: 'mandant-neu', d: 'M12 4v16m8-8H4', label: 'Neuer Mandant', href: 'mockup-platform-mandant-neu.html' },
    { id: 'mandant',     d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', label: 'Mandant-Detail', href: 'mockup-platform-mandant.html', sub: true },
    { id: 'wechsel',     d: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', label: 'Mandantenwechsel', href: 'mockup-platform-wechsel.html', sub: true },
  ];

  function renderPlatform() {
    var el = document.getElementById('platform-nav');
    if (!el) return;
    var activeId = el.getAttribute('data-active') || '';

    var html = '<div class="nav-group"><div class="nav-group-label">Plattform</div>';
    PLATFORM_NAV.forEach(function (item) {
      var cls = 'nav-item' + (item.id === activeId ? ' active' : '');
      var attrs = item.sub ? ' style="padding-left:28px;font-size:12.5px"' : '';
      html += '<a href="' + item.href + '" class="' + cls + '"' + attrs + '>' + si(item.d) + '<span>' + item.label + '</span></a>';
    });
    html += '</div>';

    html += '<div class="nav-group" style="border-top:1px solid rgba(255,255,255,.06);padding-top:10px;margin-top:6px;">';
    html += '<a href="mockup-crm-profil.html" class="nav-item other-app">' + si('M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4') + '<span>Ponturo CRM</span></a>';
    html += '<a href="mockup-sprint-dashboard.html" class="nav-item other-app">' + si('M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z') + '<span>KI-Readiness Sprint</span></a>';
    html += '</div>';

    el.innerHTML = html;
  }

  // ── 5c. Ponturo CRM navigation (CRM-Profil) ──────────────────
  var CRM_NAV = [
    { label: 'Portal', items: [
      { id: 'start',    d: 'M3 12l9-9 9 9M5 10v10h14V10', label: 'Startseite' },
      { id: 'dashboard', d: 'M3 13l2-2m0 0l7-7 7 7M5 11v8a1 1 0 001 1h3m10-10l2 2m-2-2v8a1 1 0 01-1 1h-3m-6 0h6', label: 'Dashboard' },
      { id: 'profil',   d: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4', label: 'CRM-Profil' },
    ] },
    { label: 'Kunden', items: [
      { id: 'accounts',   d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', label: 'Accounts' },
      { id: 'contacts',   d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0', label: 'Kontakte' },
      { id: 'activities', d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', label: 'Aktivitäten' },
    ] },
    { label: 'Vertrieb', items: [
      { id: 'pipeline',  d: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', label: 'Pipeline' },
      { id: 'proposals', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Angebote' },
      { id: 'contracts', d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0', label: 'Verträge' },
    ] },
    { label: 'Mandate', items: [
      { id: 'projects',  d: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Projekte' },
      { id: 'tasks',     d: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', label: 'Aufgaben' },
    ] },
    { label: 'Wissen', items: [
      { id: 'documents', d: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z', label: 'Dokumente' },
    ] },
    { label: 'Analyse', items: [
      { id: 'key-accounts',  d: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', label: 'Key Accounts' },
      { id: 'cross-selling', d: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5', label: 'Cross-Selling' },
      { id: 'compliance',    d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', label: 'Compliance' },
    ] },
    { label: 'KI & Analyse', items: [
      { id: 'ai',   d: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', label: 'KI-Opportunities' },
      { id: 'news', d: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 002 2zM4 6h16M18 8h2a2 2 0 012 2v8a2 2 0 01-2 2', label: 'News Monitoring' },
    ] },
    { label: 'System', items: [
      { id: 'settings', d: SETTINGS_D, label: 'Einstellungen' },
      { id: 'admin',    d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', label: 'Benutzer & Rollen', sub: true },
    ] },
  ];

  function renderCrm() {
    var el = document.getElementById('crm-nav');
    if (!el) return;
    var activeId = el.getAttribute('data-active') || '';

    var html = '';
    CRM_NAV.forEach(function (group) {
      html += '<div class="nav-group"><div class="nav-group-label">' + group.label + '</div>';
      group.items.forEach(function (item) {
        var cls = 'nav-item' + (item.id === activeId ? ' active' : '');
        var attrs = item.sub ? ' style="padding-left:28px;font-size:12.5px"' : '';
        html += '<span class="' + cls + '"' + attrs + '>' + si(item.d) + '<span>' + item.label + '</span></span>';
      });
      html += '</div>';
    });

    html += '<div class="nav-group" style="border-top:1px solid rgba(255,255,255,.06);padding-top:10px;margin-top:6px;">';
    html += '<a href="#ausgeblendet" class="nav-item other-app">' + si('M3 5h18M3 9h18M3 13h18M3 17h10') + '<span>Weitere Module · 12</span></a>';
    html += '<a href="mockup-platform-uebersicht.html" class="nav-item other-app">' + si(GRID_D) + '<span>Plattform-Admin</span></a>';
    html += '<a href="mockup-sprint-dashboard.html" class="nav-item other-app">' + si('M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z') + '<span>KI-Readiness Sprint</span></a>';
    html += '</div>';

    el.innerHTML = html;
  }

  // ── 6. Render sidebar nav ─────────────────────────────────────
  function render() {
    var el = document.getElementById('sprint-nav');
    if (!el) return;
    var raw = el.getAttribute('data-active') || '';
    var activeId = PARENT_MAP[raw] || raw;

    var html = '<div class="nav-group"><div class="nav-group-label">Sprint-Vertrieb</div>';
    NAV_ITEMS.forEach(function(item) {
      var cls = 'nav-item' + (item.id === activeId ? ' active' : '');
      var attrs = item.sub ? ' style="padding-left:28px;font-size:12.5px"' : '';
      html += '<a href="' + item.href + '" class="' + cls + '"' + attrs + '>' + si(item.d) + '<span>' + item.label + '</span></a>';
    });
    html += '</div>';

    var sCls = 'nav-item' + (activeId === 'einstellungen' ? ' active' : '');
    html += '<div class="nav-group" style="border-top:1px solid rgba(255,255,255,.06);padding-top:10px;margin-top:6px;">';
    html += '<a href="mockup-sprint-einstellungen.html" class="' + sCls + '">' + si(SETTINGS_D) + '<span>Einstellungen</span></a>';
    html += '<a href="mockup-crm-profil.html" class="nav-item other-app" style="margin-top:2px">' + si('M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4') + '<span>Ponturo CRM</span></a>';
    html += '<a href="mockup-platform-uebersicht.html" class="nav-item other-app">' + si(GRID_D) + '<span>Plattform-Admin</span></a>';
    html += '</div>';

    el.innerHTML = html;
  }

  // ── 7. Run on DOM ready ───────────────────────────────────────
  function init() {
    render();
    renderPlatform();
    renderCrm();
    replaceIconsInDOM();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
