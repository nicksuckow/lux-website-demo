/* LUX Waukee: site behaviour. Vanilla JS, no dependencies.
   Everything here is an enhancement: without JS the page is complete and readable. */
(function () {
  'use strict';

  var CFG = window.LUX_CONFIG || {};
  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var $ = function (sel, ctx) { return (ctx || doc).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); };
  var EMAIL = CFG.email || 'lux@luxwaukee.com';
  var PHONE = CFG.phone || '(515) 209-9999';
  var hasIO = 'IntersectionObserver' in window;

  /* ------------------------------------------------------------------
     1. Config: booking / ordering links, form endpoint, year
  ------------------------------------------------------------------ */
  function applyConfig() {
    if (CFG.reserveUrl) {
      $$('[data-reserve-link], [data-reserve-cta]').forEach(function (a) {
        a.href = CFG.reserveUrl; a.target = '_blank'; a.rel = 'noopener';
        if (a.hasAttribute('aria-label')) a.setAttribute('aria-label', 'Reserve online (opens in a new tab)');
      });
      $$('[data-reserve-label]').forEach(function (s) { s.textContent = 'Book online'; });
      $$('[data-reserve-text]').forEach(function (s) { s.textContent = 'Book online, or give us a call.'; });
    }
    if (CFG.orderUrl) {
      $$('[data-order-link], [data-order-cta]').forEach(function (a) {
        a.href = CFG.orderUrl; a.target = '_blank'; a.rel = 'noopener';
        if (a.hasAttribute('aria-label')) a.setAttribute('aria-label', 'Order online (opens in a new tab)');
      });
      $$('[data-order-label]').forEach(function (s) { s.textContent = 'Order online'; });
      $$('[data-order-text]').forEach(function (s) { s.textContent = 'Order online, then pick it up at the restaurant.'; });
    }
    var form = $('#event-form');
    if (form && CFG.eventsFormEndpoint) {
      form.action = CFG.eventsFormEndpoint;
      form.method = 'post';
      form.removeAttribute('enctype');
    }
    $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  /* ------------------------------------------------------------------
     2. Hours engine (America/Chicago). One source: CFG.services.
  ------------------------------------------------------------------ */
  var TZ = CFG.timeZone || 'America/Chicago';
  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var WEEK = [1, 2, 3, 4, 5, 6, 0]; // table order, Monday first
  var NBSP = ' ';

  function toMin(s) { var p = String(s).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  var SERVICES = (CFG.services || []).map(function (s) {
    var open = toMin(s.open), close = toMin(s.close);
    if (close <= open) close += 1440; // runs past midnight
    return { name: s.name, days: (s.days || []).slice().sort(), open: open, close: close };
  });
  // service names in the order they open (Lunch, Dinner...)
  var NAMES = [];
  SERVICES.slice().sort(function (a, b) { return a.open - b.open; }).forEach(function (s) {
    if (NAMES.indexOf(s.name) === -1) NAMES.push(s.name);
  });

  var tzFormat = null;
  try {
    tzFormat = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  } catch (e) { tzFormat = null; }

  function localNow(date) {
    date = date || new Date();
    if (!tzFormat) {
      var m = date.getMonth() + 1, d = date.getDate();
      return { day: date.getDay(), minutes: date.getHours() * 60 + date.getMinutes(), ymd: date.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d };
    }
    var o = {};
    tzFormat.formatToParts(date).forEach(function (p) { o[p.type] = p.value; });
    return {
      day: DAY_SHORT.indexOf(o.weekday),
      minutes: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10),
      ymd: o.year + '-' + o.month + '-' + o.day
    };
  }
  function servicesOn(day) {
    return SERVICES.filter(function (s) { return s.days.indexOf(day) !== -1; })
      .sort(function (a, b) { return a.open - b.open; });
  }

  // "2:30 PM"
  function fmt(min) {
    min = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), m = min % 60, ap = h >= 12 ? 'PM' : 'AM';
    return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + NBSP + ap;
  }
  // "2:30" (no meridiem)
  function fmtBare(min) {
    min = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), m = min % 60;
    return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m;
  }
  function isPM(min) { return (((min % 1440) + 1440) % 1440) >= 720; }
  // "4:30 – 9:30 PM" / "10:30 AM – 2:30 PM"
  function fmtRange(a, b) {
    return (isPM(a) === isPM(b) ? fmtBare(a) : fmt(a)) + ' – ' + fmt(b);
  }
  // same, with the meridiems wrapped so phones can drop them in the table
  function rangeHTML(a, b) {
    var amp = function (min) { return '<span class="ampm"> ' + (isPM(min) ? 'PM' : 'AM') + '</span>'; };
    return fmtBare(a) + (isPM(a) === isPM(b) ? '' : amp(a)) + ' – ' + fmtBare(b) + amp(b);
  }

  // [0,1,2,3,4] -> "Sun – Thu"; [5,6] -> "Fri & Sat"; all -> "daily"/"nightly"
  function dayPhrase(days, evening) {
    var has = [0, 1, 2, 3, 4, 5, 6].map(function (d) { return days.indexOf(d) !== -1; });
    var count = has.filter(Boolean).length;
    if (count === 7) return evening ? 'nightly' : 'daily';
    if (!count) return '';
    var runs = [];
    for (var s = 0; s < 7; s++) {
      if (has[s] && !has[(s + 6) % 7]) {
        var len = 0;
        while (len < 7 && has[(s + len) % 7]) len++;
        runs.push({ start: s, len: len });
      }
    }
    runs.sort(function (a, b) { return ((a.start + 6) % 7) - ((b.start + 6) % 7); });
    return runs.map(function (r) {
      var first = DAY_SHORT[r.start], last = DAY_SHORT[(r.start + r.len - 1) % 7];
      if (r.len === 1) return first;
      if (r.len === 2) return first + ' & ' + last;
      return first + ' – ' + last;
    }).join(', ');
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function entriesNamed(name) { return SERVICES.filter(function (s) { return s.name === name; }); }
  function unionDays(list) {
    var out = [];
    list.forEach(function (s) { s.days.forEach(function (d) { if (out.indexOf(d) === -1) out.push(d); }); });
    return out.sort();
  }
  // a short, honest summary of one service: { days: 'daily', when: '10:30–2:30' | 'from 4:30', sameTimes }
  function summary(name) {
    var list = entriesNamed(name);
    if (!list.length) return null;
    var same = list.every(function (s) { return s.open === list[0].open && s.close === list[0].close; });
    var sameOpen = list.every(function (s) { return s.open === list[0].open; });
    var evening = list[0].open >= 15 * 60;
    var days = dayPhrase(unionDays(list), evening);
    var earliest = Math.min.apply(null, list.map(function (s) { return s.open; }));
    return {
      days: days,
      range: same ? fmtBare(list[0].open) + '–' + fmtBare(list[0].close) : '',
      from: 'from ' + fmtBare(sameOpen ? list[0].open : earliest),
      same: same
    };
  }

  function getStatus(now) {
    var m = now.minutes, i, s;
    // a service from yesterday still running after midnight
    var yday = servicesOn((now.day + 6) % 7);
    for (i = 0; i < yday.length; i++) {
      s = yday[i];
      if (s.close > 1440 && m < s.close - 1440) return openState(s, s.close - 1440 - m, s.close, (now.day + 6) % 7);
    }
    var today = servicesOn(now.day);
    for (i = 0; i < today.length; i++) {
      s = today[i];
      if (m >= s.open && m < s.close) return openState(s, s.close - m, s.close, now.day);
    }
    for (i = 0; i < today.length; i++) {
      s = today[i];
      if (s.open > m) {
        if (i > 0) {
          return { state: 'between', next: s, open: false,
            long: 'Back at ' + fmt(s.open) + ' for ' + s.name.toLowerCase(),
            short: 'Back at ' + fmt(s.open) };
        }
        return { state: 'before', next: s, open: false,
          long: 'Opens today at ' + fmt(s.open),
          short: 'Opens ' + fmt(s.open) };
      }
    }
    for (var d = 1; d <= 7; d++) {
      var first = servicesOn((now.day + d) % 7)[0];
      if (first) {
        var when = d === 1 ? 'tomorrow' : DAY_NAMES[(now.day + d) % 7];
        return { state: 'closed', next: first, open: false,
          long: 'Closed · Opens ' + when + ' at ' + fmt(first.open),
          short: 'Closed' };
      }
    }
    return { state: 'closed', open: false, long: 'Hours coming soon', short: 'Hours' };
  }
  // The last 30 minutes of a service read "Closing soon" (state 'lastcall' keeps the faster
  // pulse). It states only the published closing time, not a last-orders policy.
  function openState(s, left, close, day) {
    var last = left <= 30;
    return {
      state: last ? 'lastcall' : 'open', service: s, day: day, open: true,
      long: (last ? 'Closing soon' : 'Open now') + ' · ' + s.name + ' until ' + fmt(close),
      short: last ? 'Closing soon' : 'Open now'
    };
  }

  /* ---- Renderers: every hours display on the page comes from CFG.services ---- */
  function renderHoursTable() {
    var table = $('[data-hours-table]');
    if (!table || !SERVICES.length) return;
    var head = '<tr><th scope="col">Day</th>' + NAMES.map(function (n) { return '<th scope="col">' + n + '</th>'; }).join('') + '</tr>';
    table.tHead.innerHTML = head;
    var rows = WEEK.map(function (day) {
      var list = servicesOn(day);
      var th = '<th scope="row"><abbr title="' + DAY_NAMES[day] + '">' + DAY_SHORT[day] + '</abbr></th>';
      if (!list.length) return '<tr data-day="' + day + '">' + th + '<td class="is-closed" colspan="' + NAMES.length + '">Closed</td></tr>';
      var cells = NAMES.map(function (n) {
        var mine = list.filter(function (s) { return s.name === n; });
        if (!mine.length) return '<td class="is-closed" data-svc="' + n + '">Closed</td>';
        return '<td data-svc="' + n + '">' + mine.map(function (s) { return rangeHTML(s.open, s.close); }).join(', ') + '</td>';
      }).join('');
      return '<tr data-day="' + day + '">' + th + cells + '</tr>';
    });
    table.tBodies[0].innerHTML = rows.join('');
  }

  function renderFooterHours() {
    var box = $('[data-hours-summary]');
    if (!box || !SERVICES.length) return;
    // merge entries with the same name + times, then one line per group
    var groups = [];
    SERVICES.forEach(function (s) {
      var g = groups.filter(function (x) { return x.name === s.name && x.open === s.open && x.close === s.close; })[0];
      if (g) unionDays([g, s]).forEach(function (d) { if (g.days.indexOf(d) === -1) g.days.push(d); });
      else groups.push({ name: s.name, open: s.open, close: s.close, days: s.days.slice() });
    });
    // service order (Lunch, Dinner), then the order they are listed in config
    groups.sort(function (a, b) { return NAMES.indexOf(a.name) - NAMES.indexOf(b.name); });
    box.innerHTML = '';
    groups.forEach(function (g) {
      var p = doc.createElement('p');
      p.appendChild(doc.createTextNode(g.name + ' ' + dayPhrase(g.days, false)));
      p.appendChild(doc.createElement('br'));
      p.appendChild(doc.createTextNode(fmtRange(g.open, g.close)));
      box.appendChild(p);
    });
  }

  function renderStrip() {
    var strip = $('[data-hours-strip]');
    if (!strip || !SERVICES.length) return;
    $$('[data-svc]', strip).forEach(function (li) { li.remove(); });
    var find = $('.hours-strip__find', strip);
    NAMES.forEach(function (n) {
      var s = summary(n);
      var li = doc.createElement('li');
      li.setAttribute('data-svc', n);
      var label = doc.createElement('span');
      label.className = 'hours-strip__label';
      label.textContent = n;
      li.appendChild(label);
      li.appendChild(doc.createTextNode(' ' + s.days + ' ' + (s.same ? s.range : s.from)));
      strip.insertBefore(li, find);
    });
  }

  function renderMenuHours() {
    NAMES.forEach(function (n) {
      var s = summary(n);
      var list = entriesNamed(n);
      $$('[data-tab-hours="' + n + '"]').forEach(function (el) {
        el.textContent = s.same ? cap(s.days) + ' · ' + s.range : cap(s.days) + ' ' + s.from;
      });
      $$('[data-tab-hours-short="' + n + '"]').forEach(function (el) {
        el.textContent = s.same ? s.range : cap(s.from);
      });
      $$('[data-card-hours="' + n + '"]').forEach(function (el) {
        el.innerHTML = '';
        list.forEach(function (e) {
          var span = doc.createElement('span');
          span.textContent = cap(dayPhrase(e.days, false)) + ' · ' + fmtRange(e.open, e.close);
          el.appendChild(span);
        });
      });
    });
  }

  function renderStatus(now) {
    now = now || localNow();
    var st = getStatus(now);
    root.setAttribute('data-status-state', st.state);
    $$('[data-status]').forEach(function (el) { el.textContent = st.long; });
    $$('[data-status-short]').forEach(function (el) { el.textContent = st.short; });
    $$('[data-status-pill]').forEach(function (a) {
      a.setAttribute('aria-label', st.long + '. See hours and directions.');
      a.title = st.long;
    });

    // today's row and the service being served right now
    $$('[data-hours-table] tbody tr').forEach(function (tr) {
      var today = +tr.getAttribute('data-day') === now.day;
      tr.classList.toggle('is-today', today);
      if (today) tr.setAttribute('aria-current', 'date'); else tr.removeAttribute('aria-current');
      var th = $('th', tr), mark = th && $('.today-mark', th);
      if (today && th && !mark) {
        var s = doc.createElement('span'); s.className = 'today-mark'; s.textContent = 'Today';
        th.appendChild(s);
      } else if (!today && mark) { mark.remove(); }
      // the cell being served: after midnight that is yesterday's row
      var serving = st.open && st.service && +tr.getAttribute('data-day') === st.day;
      $$('td[data-svc]', tr).forEach(function (td) {
        td.classList.toggle('is-now', !!serving && td.getAttribute('data-svc') === st.service.name);
      });
    });

    // "Now serving" on the menu tab being served
    $$('.tab[data-service]').forEach(function (tab) {
      var badge = $('[data-now-badge]', tab);
      if (badge) badge.hidden = !(st.open && st.service && st.service.name === tab.getAttribute('data-service'));
    });
    return st;
  }

  // With CFG.menuTabFollowsService, the menu opens on the service being served or, when
  // closed, the one coming next (overnight and in the morning that is Lunch; between services, Dinner).
  function defaultServiceTab(now) {
    var st = getStatus(now);
    var s = st.service || st.next;
    return s ? s.name : (NAMES[1] || NAMES[0]);
  }

  function initHours() {
    renderHoursTable();
    renderFooterHours();
    renderStrip();
    renderMenuHours();
    renderStatus();
    var tick = function () { renderStatus(); };
    setTimeout(function () { tick(); setInterval(tick, 60000); }, 60000 - (Date.now() % 60000) + 200);
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) tick(); });
  }

  /* ------------------------------------------------------------------
     3. Light: header state, light pools, hairlines, reveals, footer sign.
        All IntersectionObserver driven: nothing runs per scroll frame.
  ------------------------------------------------------------------ */
  function initLight() {
    var header = $('.site-header');
    var lit = $$('[data-light]');
    var reveals = $$('.reveal');
    var sign = $('[data-sign]');
    if (!hasIO) {
      lit.forEach(function (el) { el.classList.add('is-lit'); });
      reveals.forEach(function (el) { el.classList.add('is-in'); });
      if (sign) sign.classList.add('is-lit');
      return;
    }
    // header: solid once the page has moved
    var sentinel = doc.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none;';
    doc.body.prepend(sentinel);
    new IntersectionObserver(function (en) {
      header.classList.toggle('is-scrolled', !en[0].isIntersecting);
    }).observe(sentinel);

    var litIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-lit'); litIO.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    lit.forEach(function (el) { litIO.observe(el); });

    if (reduceMotion.matches) {
      reveals.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
      reveals.forEach(function (el) { revealIO.observe(el); });
    }

    if (sign) {
      var signIO = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { sign.classList.add('is-lit'); signIO.disconnect(); }
      }, { threshold: 0.4 });
      signIO.observe(sign);
    }

    // Pointer-reactive halo in the hero (fine pointers only, one rAF per move)
    var hero = $('.hero');
    if (hero && window.matchMedia('(pointer: fine)').matches) {
      var raf = 0, mx = 0, my = 0;
      hero.addEventListener('pointermove', function (ev) {
        if (reduceMotion.matches) return;
        var r = hero.getBoundingClientRect();
        mx = (ev.clientX - r.left) / r.width - 0.5;
        my = (ev.clientY - r.top) / r.height - 0.5;
        if (!raf) raf = requestAnimationFrame(function () {
          raf = 0;
          hero.style.setProperty('--mx', mx.toFixed(3));
          hero.style.setProperty('--my', my.toFixed(3));
        });
      });
      hero.addEventListener('pointerleave', function () {
        hero.style.setProperty('--mx', 0); hero.style.setProperty('--my', 0);
      });
    }
  }

  /* ------------------------------------------------------------------
     4. Mobile dock: appears once the hero's buttons have scrolled away
  ------------------------------------------------------------------ */
  function initDock() {
    var ctas = $('#hero-ctas');
    if (!ctas) return;
    if (hasIO) {
      new IntersectionObserver(function (en) {
        var e = en[0];
        root.classList.toggle('dock-on', !e.isIntersecting && e.boundingClientRect.top < 0);
      }).observe(ctas);
    } else {
      root.classList.add('dock-on');
    }
    // keep it out of the way of the on-screen keyboard while someone types
    var form = $('#event-form');
    if (form) {
      form.addEventListener('focusin', function (e) {
        if (e.target.matches('input, select, textarea')) root.classList.add('is-typing');
      });
      form.addEventListener('focusout', function () {
        setTimeout(function () {
          if (!form.contains(doc.activeElement) || !doc.activeElement.matches('input, select, textarea')) root.classList.remove('is-typing');
        }, 0);
      });
    }
  }

  /* ------------------------------------------------------------------
     5. Mobile menu
  ------------------------------------------------------------------ */
  function initMobileMenu() {
    var btn = $('.menu-toggle');
    var panel = $('#mobile-menu');
    if (!btn || !panel) return;
    var label = $('.menu-toggle__label', btn);
    var outside = [$('#main'), $('.site-footer'), $('.dock')].filter(Boolean);
    var mq = window.matchMedia('(min-width: 60em)'); // same breakpoint as the header CSS

    function focusables() {
      return [btn].concat($$('a[href], button:not([disabled])', panel));
    }
    function open() {
      panel.hidden = false;
      void panel.offsetWidth; // apply display before the fade starts
      root.classList.add('menu-open');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Close menu');
      if (label) label.textContent = 'Close';
      outside.forEach(function (el) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); });
      var first = $('a', panel);
      if (first) first.focus({ preventScroll: true });
      doc.addEventListener('keydown', onKey);
    }
    function close(returnFocus) {
      root.classList.remove('menu-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.removeAttribute('aria-label');
      if (label) label.textContent = 'Menu';
      outside.forEach(function (el) { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); });
      doc.removeEventListener('keydown', onKey);
      var done = function () { if (btn.getAttribute('aria-expanded') === 'false') panel.hidden = true; };
      if (reduceMotion.matches) done(); else setTimeout(done, 380);
      if (returnFocus) btn.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (e.key === 'Tab') {
        var f = focusables();
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    btn.addEventListener('click', function () {
      if (btn.getAttribute('aria-expanded') === 'true') close(true); else open();
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) close(false);
    });
    var onMq = function () { if (mq.matches && btn.getAttribute('aria-expanded') === 'true') close(false); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else mq.addListener(onMq);
  }

  /* ------------------------------------------------------------------
     6. Menu tabs (WAI-ARIA tabs, automatic activation), service-aware
  ------------------------------------------------------------------ */
  function initTabs() {
    var list = $('[data-tablist]');
    if (!list) return;
    var tabs = $$('.tab', list);
    var glow = $('.menu__tabs-glow', list);
    // The HTML holds plain buttons and cards (the tab row is hidden without JS);
    // the tab roles are added here, once the tabs actually work.
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Menus');
    var initial = null;
    tabs.forEach(function (t) {
      t.setAttribute('role', 'tab');
      var p = doc.getElementById(t.getAttribute('aria-controls'));
      if (!p) return;
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-labelledby', t.id);
      p.tabIndex = 0;
      if (!initial && !p.hidden) initial = t; // the card the HTML shows (Dinner)
    });

    function moveGlow(tab) {
      if (!glow || !tab) return;
      glow.style.setProperty('--x', tab.offsetLeft + 'px');
      glow.style.setProperty('--w', tab.offsetWidth + 'px');
    }
    function selected() { return tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0]; }
    function select(tab, focus, animate) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var p = doc.getElementById(t.getAttribute('aria-controls'));
        if (p) {
          p.hidden = !on;
          p.classList.remove('is-entering');
          if (on && animate && !reduceMotion.matches) { void p.offsetWidth; p.classList.add('is-entering'); }
        }
      });
      moveGlow(tab);
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false, true); });
      tab.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') n = tabs[0];
        else if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true, true); }
      });
    });

    // Open on the card the HTML shows (Dinner, the complete menu), or, with
    // menuTabFollowsService, on the service being served or coming next.
    // Without JS every card shows in turn.
    var want = CFG.menuTabFollowsService && SERVICES.length ? defaultServiceTab(localNow()) : null;
    var start = want && tabs.filter(function (t) { return t.getAttribute('data-service') === want; })[0];
    select(start || initial || tabs[0], false, false);

    // "See the dinner menu" and similar buttons inside a card switch tabs
    $$('[data-tab-jump]').forEach(function (b) {
      var t = doc.getElementById(b.getAttribute('data-tab-jump'));
      if (t && tabs.indexOf(t) !== -1) b.addEventListener('click', function () { select(t, true, true); });
    });

    window.addEventListener('resize', function () { moveGlow(selected()); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { moveGlow(selected()); });
  }

  /* ------------------------------------------------------------------
     6b. Dinner card section chips (phones + tablets; hidden by CSS on desktop).
         The chips are plain links to the course headings, so they work without JS.
         JS adds: a solid bar once it sticks under the header, and the chip of the
         course being read (IntersectionObserver only: nothing runs per scroll frame).
  ------------------------------------------------------------------ */
  function initMenuIndex() {
    var bar = $('[data-menu-index]');
    if (!bar || !hasIO) return;
    var list = $('.menu-index__list', bar);
    var links = $$('a[href^="#"]', bar);
    var sections = links.map(function (a) {
      var h = doc.getElementById(a.getAttribute('href').slice(1));
      return h && h.closest('.course');
    });
    var head = $('.carte__head', bar.parentNode);
    if (!list || !head || sections.some(function (s) { return !s; })) return;

    var current = -1, stickTop = 0, shift = 0, line = 0, sticky = true, ios = [];
    var sentinel = doc.createElement('div');
    sentinel.className = 'menu-index__sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    bar.parentNode.insertBefore(sentinel, bar);

    function shown() { return bar.offsetParent !== null; } // display:none on desktop / other tabs
    function setCurrent(i) {
      if (i === current) return;
      current = i;
      links.forEach(function (a, j) {
        if (j === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      var a = links[i];
      if (!a || !shown()) return;
      // keep that chip in view inside the row (a horizontal scroll only: the page never moves)
      var l = a.offsetLeft, r = l + a.offsetWidth, edge = 28;
      if (l < list.scrollLeft + edge || r > list.scrollLeft + list.clientWidth - edge) {
        var left = l - (list.clientWidth - a.offsetWidth) / 2;
        if (list.scrollTo) list.scrollTo({ left: left, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
        else list.scrollLeft = left;
      }
    }
    // Both observers call this. The bar is "stuck" once the spot it sits in has scrolled under
    // the header. The course being read is the first one whose bottom is still below the line
    // under the bar; none while the card's own header is still below that line.
    // (The section observer also catches jumps that skip the sentinel's edge.)
    function update() {
      if (!shown()) return;
      bar.classList.toggle('is-stuck', sticky && sentinel.getBoundingClientRect().top + shift < stickTop);
      if (head.getBoundingClientRect().bottom > line) { setCurrent(-1); return; }
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().bottom > line) { setCurrent(i); return; }
      }
      setCurrent(sections.length - 1);
    }
    function observe() {
      ios.forEach(function (io) { io.disconnect(); });
      var cs = getComputedStyle(bar);
      sticky = cs.position === 'sticky'; // CSS makes it static on very short screens
      stickTop = parseFloat(cs.top) || 0;
      shift = parseFloat(cs.marginTop) || 0; // the bar starts this far from the sentinel
      line = Math.round(stickTop + (sticky ? bar.offsetHeight || 54 : 0) + 20);
      var stuck = new IntersectionObserver(update, { rootMargin: '-' + Math.round(stickTop - shift) + 'px 0px 0px 0px' });
      stuck.observe(sentinel);
      var spy = new IntersectionObserver(update, { rootMargin: '-' + line + 'px 0px 0px 0px' });
      spy.observe(head);
      sections.forEach(function (s) { spy.observe(s); });
      ios = [stuck, spy];
    }
    observe();
    var t = 0, w = window.innerWidth;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { if (window.innerWidth !== w) { w = window.innerWidth; observe(); } }, 150);
    });
    // the sticky/static switch is a height query, so a height-only change re-measures too
    var short = window.matchMedia && window.matchMedia('(max-height: 520px)');
    if (short) {
      if (short.addEventListener) short.addEventListener('change', observe);
      else if (short.addListener) short.addListener(observe);
    }
    // a chip reached with Tab scrolls fully into the row (the browser only scrolls one that is entirely
    // hidden); the row's scroll-padding keeps it clear of the edge fade
    list.addEventListener('focusin', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  /* ------------------------------------------------------------------
     7. Gallery lightbox (native <dialog>). Without JS the links open the image.
  ------------------------------------------------------------------ */
  function initLightbox() {
    var dlg = $('#lightbox');
    var items = $$('.gallery__item');
    if (!dlg || !items.length || typeof dlg.showModal !== 'function') return;
    var img = doc.createElement('img');
    img.className = 'lightbox__img';
    img.alt = '';
    $('.lightbox__figure', dlg).prepend(img);
    var cap = $('#lightbox-caption');
    var count = $('.lightbox__count', dlg);
    var idx = 0, opener = null;

    function show(i) {
      idx = (i + items.length) % items.length;
      var it = items[idx];
      var thumb = $('img', it);
      dlg.classList.remove('is-swapping'); void dlg.offsetWidth; dlg.classList.add('is-swapping');
      img.src = it.getAttribute('href');
      img.alt = thumb ? thumb.alt : '';
      cap.textContent = it.getAttribute('data-caption') || '';
      count.textContent = (idx + 1) + ' of ' + items.length;
    }
    function open(i, from) {
      opener = from;
      show(i);
      dlg.showModal();
      root.classList.add('lightbox-open');
      $('.lightbox__close', dlg).focus();
    }
    dlg.addEventListener('close', function () {
      root.classList.remove('lightbox-open');
      if (opener) opener.focus();
    });
    items.forEach(function (it, i) {
      it.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault(); open(i, it);
      });
    });
    $('.lightbox__prev', dlg).addEventListener('click', function () { show(idx - 1); });
    $('.lightbox__next', dlg).addEventListener('click', function () { show(idx + 1); });
    $('.lightbox__close', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
      else if (e.key === 'Home') { e.preventDefault(); show(0); }
      else if (e.key === 'End') { e.preventDefault(); show(items.length - 1); }
    });
    // click on the dark backdrop (outside the image and controls) closes
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.classList.contains('lightbox__stage')) dlg.close();
    });
    // swipe on touch devices
    var sx = null;
    dlg.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
      sx = null;
    });
  }

  /* ------------------------------------------------------------------
     8. Private-events form: validation, then an honest success state.
        No endpoint: "Almost there" + Send by email. Endpoint: POST, and only
        a successful POST says the inquiry is in.
  ------------------------------------------------------------------ */
  function initForm() {
    var form = $('#event-form');
    if (!form) return;
    form.noValidate = true; // JS validates; without JS the browser's own checks apply
    var success = $('#form-success');
    var summaryBox = $('#form-summary');
    var submitBtn = $('button[type="submit"]', form);
    var fallback = $('[data-mailto-fallback]', form);
    var attempted = false;

    // earliest date = today in Waukee (America/Chicago), not the browser's zone
    var dateInput = $('#f-date');
    var todayStr = localNow().ymd;
    if (dateInput) dateInput.min = todayStr;

    var rules = {
      name: function (v) { return v.trim().length >= 2 ? '' : 'Please tell us your name.'; },
      email: function (v) {
        if (!v.trim()) return 'Please enter your email so we can reply.';
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'That email doesn’t look right. Try name@example.com.';
      },
      phone: function (v) {
        if (!v.trim()) return '';
        var digits = v.replace(/\D/g, '');
        return digits.length >= 10 && digits.length <= 15 ? '' : 'Please enter a full phone number, or leave it blank.';
      },
      date: function (v) {
        if (!v) return 'Please choose a date for your event.';
        return v >= todayStr ? '' : 'Please choose today or a later date.';
      },
      party_size: function (v) {
        if (!String(v).trim()) return 'How many guests are you expecting?';
        var n = Number(v);
        return Number.isInteger(n) && n >= 1 ? '' : 'Please enter a number of guests (1 or more).';
      },
      event_type: function (v) { return v ? '' : 'Please choose the type of event.'; }
    };

    function validateField(el) {
      var rule = rules[el.name];
      if (!rule) return '';
      var msg = rule(el.value);
      var err = doc.getElementById(el.id + '-err');
      if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
      el.closest('.field').classList.toggle('has-error', !!msg);
      if (err) err.textContent = msg;
      return msg;
    }

    function values() {
      var get = function (n) { return (form.elements[n] && form.elements[n].value || '').trim(); };
      return { name: get('name'), email: get('email'), phone: get('phone'), date: get('date'), size: get('party_size'), type: get('event_type'), message: get('message') };
    }
    function prettyDate(ymd) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
      var p = ymd.split('-');
      var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
      try { return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); } catch (e) { return ymd; }
    }
    function mailtoHref(d) {
      var subject = 'Private event inquiry' + (d.type ? ': ' + d.type : '') + (d.date ? ', ' + prettyDate(d.date) : '');
      var lines = [
        'Name: ' + (d.name || ''),
        'Email: ' + (d.email || ''),
        'Phone: ' + (d.phone || '-'),
        'Event date: ' + (d.date ? prettyDate(d.date) : ''),
        'Party size: ' + (d.size || ''),
        'Event type: ' + (d.type || ''),
        '',
        d.message || ''
      ];
      return 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
    }
    // the "or email us" link always carries whatever has been typed so far
    function refreshFallback() { if (fallback) fallback.href = mailtoHref(values()); }

    $$('input, select, textarea', form).forEach(function (el) {
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'blur', function () {
        if (attempted || el.getAttribute('aria-invalid') === 'true') validateField(el);
      });
      el.addEventListener('input', function () {
        if (el.getAttribute('aria-invalid') === 'true') validateField(el);
      });
    });
    form.addEventListener('input', refreshFallback);
    form.addEventListener('change', refreshFallback);
    refreshFallback();

    function showSuccess(d, sent) {
      var first = d.name.split(/\s+/)[0] || '';
      var title = $('[data-success-title]', success);
      title.textContent = (sent ? 'Thank you' : 'Almost there') + (first ? ', ' + first : '') + '.';
      $('[data-success-text]', success).textContent = sent
        ? 'Your inquiry is in. Our team will reply to ' + d.email + ' soon.'
        : 'Your inquiry hasn’t been sent yet. Use “Send by email” to send these details to ' + EMAIL + ' from your email app, and our team will follow up.';
      var dl = $('[data-success-summary]', success);
      dl.innerHTML = '';
      [['Date', prettyDate(d.date)], ['Guests', d.size], ['Event', d.type], ['Reply to', d.email]].forEach(function (row) {
        var dt = doc.createElement('dt'), dd = doc.createElement('dd');
        dt.textContent = row[0]; dd.textContent = row[1];
        dl.appendChild(dt); dl.appendChild(dd);
      });
      var mail = $('[data-success-mailto]', success);
      mail.href = mailtoHref(d);
      mail.hidden = !!sent;
      success.setAttribute('data-sent', sent ? 'true' : 'false');
      form.hidden = true;
      success.hidden = false;
      title.focus({ preventScroll: true });
      var top = success.getBoundingClientRect().top;
      if (top < 80 || top > window.innerHeight * 0.6) success.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    }

    function showError(msg, d) {
      summaryBox.hidden = false;
      summaryBox.innerHTML = '';
      var p = doc.createElement('p');
      p.append(msg);
      if (d) {
        var a = doc.createElement('a');
        a.href = mailtoHref(d); a.textContent = 'Send it by email instead';
        p.append(' ');
        p.appendChild(a);
        p.append(' or call ');
        var tel = doc.createElement('a');
        tel.href = CFG.phoneHref || 'tel:+15152099999';
        tel.className = 'nowrap';
        tel.textContent = PHONE;
        p.appendChild(tel);
        p.append('.');
      }
      summaryBox.appendChild(p);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      attempted = true;
      var errors = [];
      $$('input, select, textarea', form).forEach(function (el) {
        var msg = validateField(el);
        if (msg) errors.push(el);
      });
      if (errors.length) {
        showError(errors.length === 1 ? 'Please fix 1 field below.' : 'Please fix ' + errors.length + ' fields below.');
        // bring the summary out from under the fixed header, then focus the first field
        // (the browser still scrolls to that field if it is further down)
        var sr = summaryBox.getBoundingClientRect();
        var pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
        if (sr.top < pad || sr.bottom > window.innerHeight) summaryBox.scrollIntoView({ block: 'start' });
        errors[0].focus();
        return;
      }
      summaryBox.hidden = true;
      var d = values();

      if (!CFG.eventsFormEndpoint) { showSuccess(d, false); return; }

      submitBtn.disabled = true;
      submitBtn.classList.add('is-busy');
      var label = $('.btn__label', submitBtn);
      if (label) label.textContent = 'Sending…';
      fetch(CFG.eventsFormEndpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          showSuccess(d, true);
        })
        .catch(function () {
          showError('We couldn’t send that just now.', d);
          summaryBox.focus();
        })
        .then(function () {
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-busy');
          if (label) label.textContent = 'Send inquiry';
        });
    });

    $('[data-form-reset]', success).addEventListener('click', function () {
      form.reset();
      attempted = false;
      $$('[aria-invalid]', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });
      $$('.has-error', form).forEach(function (el) { el.classList.remove('has-error'); });
      $$('.field__error', form).forEach(function (el) { el.textContent = ''; });
      summaryBox.hidden = true;
      success.hidden = true;
      form.hidden = false;
      refreshFallback();
      $('#f-name').focus();
    });
  }

  /* ------------------------------------------------------------------
     9. Map: styled card first, the Google Map only when a guest asks
  ------------------------------------------------------------------ */
  function initMap() {
    var map = $('[data-map]');
    if (!map) return;
    var btn = $('[data-map-load]', map);
    var tpl = $('[data-map-template]', map);
    if (!btn || !tpl) return;
    btn.addEventListener('click', function () {
      var frag = tpl.content.cloneNode(true);
      var frame = frag.querySelector('iframe');
      map.appendChild(frag);
      map.classList.add('has-frame');
      btn.hidden = true;
      frame.setAttribute('tabindex', '0');
      frame.focus();
    });
  }

  /* ------------------------------------------------------------------
     10. Scrollspy for the desktop nav
  ------------------------------------------------------------------ */
  function initSpy() {
    var links = $$('.nav a[href^="#"]');
    if (!links.length || !hasIO) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = map[e.target.id];
        if (!a) return;
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.remove('is-active'); l.removeAttribute('aria-current'); });
          a.classList.add('is-active'); a.setAttribute('aria-current', 'true');
        } else if (a.classList.contains('is-active')) {
          a.classList.remove('is-active'); a.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    Object.keys(map).forEach(function (id) { var s = doc.getElementById(id); if (s) io.observe(s); });
  }

  /* ------------------------------------------------------------------
     11. In-page links: smooth scroll + move focus to the target
  ------------------------------------------------------------------ */
  function initAnchors() {
    doc.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href').slice(1);
      if (!id) return;
      var target = doc.getElementById(id);
      if (!target) return;
      e.preventDefault();
      var behavior = reduceMotion.matches ? 'auto' : 'smooth';
      if (id === 'top') window.scrollTo({ top: 0, behavior: behavior });
      else target.scrollIntoView({ behavior: behavior, block: 'start' });
      if (history.pushState) history.pushState(null, '', '#' + id);
      var focusEl = id === 'top' ? doc.getElementById('main') : target;
      if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
      focusEl.focus({ preventScroll: true });
    });
  }

  /* ------------------------------------------------------------------
     Boot
  ------------------------------------------------------------------ */
  function boot() {
    applyConfig();
    initHours();
    initLight();
    initDock();
    initMobileMenu();
    initTabs();
    initMenuIndex();
    initLightbox();
    initForm();
    initMap();
    initSpy();
    initAnchors();
  }

  // exposed for testing / debugging only
  window.LUX_HOURS = { getStatus: getStatus, localNow: localNow, render: renderStatus, defaultTab: defaultServiceTab };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
