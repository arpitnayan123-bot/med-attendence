/* AttendMate Pro — site-wide JS (no dependencies, no network calls) */
"use strict";

/* ================= THEME =================
   Stored in 'attendmate_site_theme'; also mirrored into the app's
   state (attendmate_pro_v2.profile.theme) so the dashboard matches. */
function siteGetTheme() {
  try {
    var t = localStorage.getItem('attendmate_site_theme');
    if (t) return t;
    var raw = localStorage.getItem('attendmate_pro_v2');
    if (raw) {
      var s = JSON.parse(raw);
      if (s && s.profile && (s.profile.theme === 'dark' || s.profile.theme === 'light')) return s.profile.theme;
    }
  } catch (e) { /* storage unavailable */ }
  try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
}
function siteSetTheme(theme) {
  try { localStorage.setItem('attendmate_site_theme', theme); } catch (e) { }
  try {
    var raw = localStorage.getItem('attendmate_pro_v2');
    if (raw) {
      var s = JSON.parse(raw);
      if (s && s.profile) { s.profile.theme = theme; localStorage.setItem('attendmate_pro_v2', JSON.stringify(s)); }
    }
  } catch (e) { /* app state absent — fine */ }
  document.documentElement.setAttribute('data-theme', theme);
  var ic = document.getElementById('theme-toggle-icon');
  if (ic) ic.innerHTML = theme === 'dark' ? siteIcon('sun') : siteIcon('moon');
}

/* ================= ICONS ================= */
var SITE_ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.3 11.3 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
  steth: '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  flame: '<path d="M12 2c1 4-4 6-4 10a4 4 0 0 0 8 0c0-1-.5-2-1-3-1.5 1.5-3 .5-3-1 0-2 1-3 0-6z"/><path d="M8.5 14.5C7 16 7 19 9.5 21"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/>'
};
function siteIcon(name, size) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' +
    (size ? ' style="width:' + size + 'px;height:' + size + 'px"' : '') + ' aria-hidden="true">' + (SITE_ICONS[name] || '') + '</svg>';
}

/* ================= OFFICIAL NSMCH PHASE-III (PART-2) ROSTER DATA ================= */
var SUBGROUP_RANGES = [
  { group: 'A', sub: 'A1', min: 1, max: 4 }, { group: 'A', sub: 'A2', min: 5, max: 8 },
  { group: 'A', sub: 'A3', min: 9, max: 12 }, { group: 'A', sub: 'A4', min: 13, max: 16 },
  { group: 'B', sub: 'B1', min: 17, max: 20 }, { group: 'B', sub: 'B2', min: 21, max: 24 },
  { group: 'B', sub: 'B3', min: 25, max: 28 }, { group: 'B', sub: 'B4', min: 29, max: 32 },
  { group: 'C', sub: 'C1', min: 33, max: 36 }, { group: 'C', sub: 'C2', min: 37, max: 40 },
  { group: 'C', sub: 'C3', min: 41, max: 44 }, { group: 'C', sub: 'C4', min: 45, max: 49 },
  { group: 'D', sub: 'D1', min: 50, max: 53 }, { group: 'D', sub: 'D2', min: 54, max: 57 },
  { group: 'D', sub: 'D3', min: 58, max: 61 }, { group: 'D', sub: 'D4', min: 62, max: 66 },
  { group: 'E', sub: 'E1', min: 67, max: 70 }, { group: 'E', sub: 'E2', min: 71, max: 74 },
  { group: 'E', sub: 'E3', min: 75, max: 78 }, { group: 'E', sub: 'E4', min: 79, max: 83 },
  { group: 'F', sub: 'F1', min: 84, max: 87 }, { group: 'F', sub: 'F2', min: 88, max: 91 },
  { group: 'F', sub: 'F3', min: 92, max: 95 }, { group: 'F', sub: 'F4', min: 96, max: 100 }
];
var MINOR_ROSTER = [
  { start: '2026-10-10', end: '2026-10-28', DR: ['A1'], RD: ['A2'], AN: ['A3'], PS: ['A4'] },
  { start: '2026-10-29', end: '2026-11-19', DR: ['A4'], RD: ['A1'], AN: ['A2'], PS: ['A3'] },
  { start: '2026-11-20', end: '2026-12-03', DR: ['A3'], RD: ['A4'], AN: ['A1'], PS: ['A2'] },
  { start: '2026-12-04', end: '2026-12-17', DR: ['A2'], RD: ['A3'], AN: ['A4'], PS: ['A1'] },
  { start: '2026-12-18', end: '2027-01-09', DR: ['F1'], RD: ['F2'], AN: ['F3'], PS: ['F4'] },
  { start: '2027-01-11', end: '2027-01-23', DR: ['F4'], RD: ['F1'], AN: ['F2'], PS: ['F3'] },
  { start: '2027-01-25', end: '2027-02-13', DR: ['F3'], RD: ['F4'], AN: ['F1'], PS: ['F2'] },
  { start: '2027-02-15', end: '2027-02-27', DR: ['F2'], RD: ['F3'], AN: ['F4'], PS: ['F1'] },
  { start: '2027-03-01', end: '2027-03-13', DR: ['E1'], RD: ['E2'], AN: ['E3'], PS: ['E4'] },
  { start: '2027-03-22', end: '2027-04-03', DR: ['E4'], RD: ['E1'], AN: ['E2'], PS: ['E3'] },
  { start: '2027-04-05', end: '2027-04-17', DR: ['E3'], RD: ['E4'], AN: ['E1'], PS: ['E2'] },
  { start: '2027-04-19', end: '2027-05-01', DR: ['E2'], RD: ['E3'], AN: ['E4'], PS: ['E1'] },
  { start: '2027-05-03', end: '2027-05-15', DR: ['D1'], RD: ['D2'], AN: ['D3'], PS: ['D4'] },
  { start: '2027-05-17', end: '2027-05-31', DR: ['D4'], RD: ['D1'], AN: ['D2'], PS: ['D3'] },
  { start: '2027-06-10', end: '2027-06-23', DR: ['D3'], RD: ['D4'], AN: ['D1'], PS: ['D2'] },
  { start: '2027-06-24', end: '2027-07-07', DR: ['D2'], RD: ['D3'], AN: ['D4'], PS: ['D1'] },
  { start: '2027-07-08', end: '2027-07-24', DR: ['C1'], RD: ['C2'], AN: ['C3'], PS: ['C4'] },
  { start: '2027-08-02', end: '2027-08-14', DR: ['C4'], RD: ['C1'], AN: ['C2'], PS: ['C3'] },
  { start: '2027-08-16', end: '2027-08-28', DR: ['C3'], RD: ['C4'], AN: ['C1'], PS: ['C2'] },
  { start: '2027-09-06', end: '2027-09-18', DR: ['C2'], RD: ['C3'], AN: ['C4'], PS: ['C1'] },
  { start: '2027-09-20', end: '2027-10-02', DR: ['B1'], RD: ['B2'], AN: ['B3'], PS: ['B4'] },
  { start: '2027-10-04', end: '2027-10-20', DR: ['B4'], RD: ['B1'], AN: ['B2'], PS: ['B3'] },
  { start: '2027-10-21', end: '2027-11-13', DR: ['B3'], RD: ['B4'], AN: ['B1'], PS: ['B2'] },
  { start: '2027-11-15', end: '2027-11-27', DR: ['B2'], RD: ['B3'], AN: ['B4'], PS: ['B1'] }
];
var MID_ROSTER = [
  { start: '2026-10-10', end: '2026-11-19', PE: ['B1','B2'], OR: ['B3','B4'], EN: ['C1','C2'], OP: ['C3','C4'] },
  { start: '2026-11-20', end: '2026-12-17', PE: ['B3','B4'], OR: ['B1','B2'], EN: ['C3','C4'], OP: ['C1','C2'] },
  { start: '2026-12-18', end: '2027-01-23', PE: ['A1','A2'], OR: ['A3','A4'], EN: ['B1','B2'], OP: ['B3','B4'] },
  { start: '2027-01-25', end: '2027-02-27', PE: ['A3','A4'], OR: ['A1','A2'], EN: ['B3','B4'], OP: ['B1','B2'] },
  { start: '2027-03-01', end: '2027-04-03', PE: ['F1','F2'], OR: ['F3','F4'], EN: ['A1','A2'], OP: ['A3','A4'] },
  { start: '2027-04-05', end: '2027-05-01', PE: ['F3','F4'], OR: ['F1','F2'], EN: ['A3','A4'], OP: ['A1','A2'] },
  { start: '2027-05-03', end: '2027-05-31', PE: ['E1','E2'], OR: ['E3','E4'], EN: ['F1','F2'], OP: ['F3','F4'] },
  { start: '2027-06-10', end: '2027-07-07', PE: ['E3','E4'], OR: ['E1','E2'], EN: ['F3','F4'], OP: ['F1','F2'] },
  { start: '2027-07-08', end: '2027-08-14', PE: ['D1','D2'], OR: ['D3','D4'], EN: ['E1','E2'], OP: ['E3','E4'] },
  { start: '2027-08-16', end: '2027-09-18', PE: ['D3','D4'], OR: ['D1','D2'], EN: ['E3','E4'], OP: ['E1','E2'] },
  { start: '2027-09-20', end: '2027-10-20', PE: ['C1','C2'], OR: ['C3','C4'], EN: ['D1','D2'], OP: ['D3','D4'] },
  { start: '2027-10-21', end: '2027-11-27', PE: ['C3','C4'], OR: ['C1','C2'], EN: ['D3','D4'], OP: ['D1','D2'] }
];
var MAJOR_ROSTER = [
  { start: '2026-10-10', end: '2026-12-17', IM: ['D'], SU: ['E'], OG: ['F'] },
  { start: '2026-12-18', end: '2027-02-27', IM: ['C'], SU: ['D'], OG: ['E'] },
  { start: '2027-03-01', end: '2027-05-01', IM: ['B'], SU: ['C'], OG: ['D'] },
  { start: '2027-05-03', end: '2027-07-07', IM: ['A'], SU: ['B'], OG: ['C'] },
  { start: '2027-07-08', end: '2027-09-18', IM: ['F'], SU: ['A'], OG: ['B'] },
  { start: '2027-09-20', end: '2027-11-27', IM: ['E'], SU: ['F'], OG: ['A'] }
];
var EXAM_CLINICAL_ROSTER = [
  { start: '2027-11-29', end: '2027-12-04', IM: ['A','B'], SU: ['C','D'], OG: ['E','F'], note: 'Exam Oriented Clinical Class' },
  { start: '2027-12-06', end: '2027-12-10', IM: ['E','F'], SU: ['A','B'], OG: ['C','D'], note: 'Exam Oriented Clinical Class' },
  { start: '2028-01-03', end: '2028-01-08', IM: ['C','D'], SU: ['E','F'], OG: ['A','B'], note: 'Exam Oriented Clinical Class' }
];
var DEPT_NAMES = {
  DR: 'Dermatology, Venereology & Leprosy', RD: 'Radiodiagnosis & Radiotherapy', AN: 'Anesthesiology', PS: 'Psychiatry',
  PE: 'Pediatrics', OR: 'Orthopaedics + PMR', EN: 'Otorhinolaryngology (ENT)', OP: 'Ophthalmology',
  IM: 'General Medicine', SU: 'General Surgery', OG: 'Obs-Gynae'
};

function siteGroupInfo(rollNo) {
  var r = Math.max(1, Math.min(100, parseInt(rollNo, 10) || 1));
  var found = SUBGROUP_RANGES.filter(function (it) { return r >= it.min && r <= it.max; })[0] || SUBGROUP_RANGES[0];
  return { rollNo: r, group: found.group, subGroup: found.sub };
}
function siteFormatDate(iso) {
  var p = iso.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function siteTodayISO() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function sitePersonalTimeline(subGroup) {
  var group = subGroup.charAt(0), list = [], dept, i;
  for (i = 0; i < MINOR_ROSTER.length; i++) for (dept in { DR: 1, RD: 1, AN: 1, PS: 1 })
    if (MINOR_ROSTER[i][dept] && MINOR_ROSTER[i][dept].indexOf(subGroup) >= 0)
      list.push({ code: dept, name: DEPT_NAMES[dept], start: MINOR_ROSTER[i].start, end: MINOR_ROSTER[i].end, block: 'Allied Specialty' });
  for (i = 0; i < MID_ROSTER.length; i++) for (dept in { PE: 1, OR: 1, EN: 1, OP: 1 })
    if (MID_ROSTER[i][dept] && MID_ROSTER[i][dept].indexOf(subGroup) >= 0)
      list.push({ code: dept, name: DEPT_NAMES[dept], start: MID_ROSTER[i].start, end: MID_ROSTER[i].end, block: 'Specialty Rotation' });
  for (i = 0; i < MAJOR_ROSTER.length; i++) for (dept in { IM: 1, SU: 1, OG: 1 })
    if (MAJOR_ROSTER[i][dept] && MAJOR_ROSTER[i][dept].indexOf(group) >= 0)
      list.push({ code: dept, name: DEPT_NAMES[dept], start: MAJOR_ROSTER[i].start, end: MAJOR_ROSTER[i].end, block: 'Major Clinical' });
  for (i = 0; i < EXAM_CLINICAL_ROSTER.length; i++) for (dept in { IM: 1, SU: 1, OG: 1 })
    if (EXAM_CLINICAL_ROSTER[i][dept] && EXAM_CLINICAL_ROSTER[i][dept].indexOf(group) >= 0)
      list.push({ code: dept, name: DEPT_NAMES[dept] + ' (Exam Oriented)', start: EXAM_CLINICAL_ROSTER[i].start, end: EXAM_CLINICAL_ROSTER[i].end, block: 'Exam Oriented' });
  list.sort(function (a, b) { return a.start < b.start ? -1 : 1; });
  return list;
}

/* ================= PAGE BOOT ================= */
function siteInit() {
  document.documentElement.setAttribute('data-theme', siteGetTheme());
  var ic = document.getElementById('theme-toggle-icon');
  if (ic) ic.innerHTML = siteIcon(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon');
  var tt = document.getElementById('theme-toggle');
  if (tt) tt.addEventListener('click', function () {
    siteSetTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  var burger = document.getElementById('nav-burger'), mm = document.getElementById('mobile-menu');
  if (burger && mm) burger.addEventListener('click', function () {
    var open = mm.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.querySelectorAll('.brand-mark[data-icon]').forEach(function (el) {
    el.innerHTML = siteIcon(el.getAttribute('data-icon'), 18);
  });
  document.querySelectorAll('.ic[data-icon]').forEach(function (el) {
    el.innerHTML = siteIcon(el.getAttribute('data-icon'), 21);
  });
  var yr = document.getElementById('site-year');
  if (yr) yr.textContent = String(new Date().getFullYear());

  /* reveal-on-scroll */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* roster lookup widget */
  var form = document.getElementById('lookup-form');
  if (form) {
    var out = document.getElementById('lookup-result');
    var render = function () {
      var v = parseInt(document.getElementById('lookup-roll').value, 10);
      if (!(v >= 1 && v <= 100)) {
        out.innerHTML = '<div class="lr-empty">Enter a roll number between 1 and 100 to see the resolved group and posting timeline.</div>';
        return;
      }
      var gi = siteGroupInfo(v);
      var tl = sitePersonalTimeline(gi.subGroup);
      var today = siteTodayISO();
      var now = null;
      for (var i = 0; i < tl.length; i++) if (today >= tl[i].start && today <= tl[i].end) now = tl[i];
      var upcoming = tl.filter(function (it) { return it.start > today; }).slice(0, 4);
      var html = '<div class="lr-card">'
        + '<div class="lr-chips">'
        + '<span class="g"><b class="grad-text">' + gi.group + '</b><span>Group</span></span>'
        + '<span class="g"><b class="grad-text">' + gi.subGroup + '</b><span>Sub-group</span></span>'
        + '<span class="g"><b>' + v + '</b><span>Roll no.</span></span>'
        + '<span class="g"><b>' + tl.length + '</b><span>rotations</span></span>'
        + '</div>';
      html += '<div class="lr-now"><div class="t">' + (now ? 'Current rotation (as of ' + siteFormatDate(today) + ')' : 'No rotation scheduled today') + '</div>'
        + (now ? '<div class="nm">' + now.name + ' (' + now.code + ')</div><div style="color:var(--muted);font-size:12.5px">' + now.block + ' · ' + siteFormatDate(now.start) + ' → ' + siteFormatDate(now.end) + '</div>' : '<div class="nm" style="color:var(--muted)">Check the tables below for your next block</div>')
        + '</div>';
      if (upcoming.length) {
        html += '<div><div class="t" style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Next rotations</div><div class="lr-list">';
        upcoming.forEach(function (it) {
          html += '<div class="lr-item"><b>' + it.name + ' <span class="chip sky">' + it.block + '</span></b><span>' + siteFormatDate(it.start) + '</span></div>';
        });
        html += '</div></div>';
      }
      html += '</div>';
      out.innerHTML = html;
    };
    form.addEventListener('submit', function (e) { e.preventDefault(); render(); });
    document.getElementById('lookup-roll').addEventListener('input', render);
    render();
  }

  /* roster tables */
  var host = document.getElementById('roster-tables');
  if (host) {
    var rows = function (arr, depts) {
      return arr.map(function (r) {
        var tds = depts.map(function (d) {
          var v = r[d] ? r[d].join(', ') : '—';
          return '<td>' + (r[d] ? '<span class="chip brand">' + v + '</span>' : '—') + '</td>';
        }).join('');
        return '<tr><td class="dates">' + siteFormatDate(r.start) + ' → ' + siteFormatDate(r.end) + '</td>' + tds + '</tr>';
      }).join('');
    };
    var table = function (title, sub, arr, depts) {
      return '<div class="table-card"><h3>' + title + '</h3><p class="tc-sub">' + sub + '</p><div class="scroll-x"><table class="roster">'
        + '<thead><tr><th>Window</th>' + depts.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '</tr></thead>'
        + '<tbody>' + rows(arr, depts) + '</tbody></table></div></div>';
    };
    host.innerHTML =
      table('Minor — Allied Specialty rotations', 'Two-week blocks through Dermatology, Radiodiagnosis, Anesthesiology and Psychiatry.', MINOR_ROSTER, ['DR', 'RD', 'AN', 'PS'])
      + '<div style="height:18px"></div>'
      + table('Mid — Specialty rotations', 'Pediatrics, Orthopaedics + PMR, ENT and Ophthalmology, two sub-groups at a time.', MID_ROSTER, ['PE', 'OR', 'EN', 'OP'])
      + '<div style="height:18px"></div>'
      + table('Major — Clinical postings', 'General Medicine, General Surgery and Obs-Gynae by whole group.', MAJOR_ROSTER, ['IM', 'SU', 'OG'])
      + '<div style="height:18px"></div>'
      + table('Exam-oriented clinical classes', 'Final revision blocks before the university practicals.', EXAM_CLINICAL_ROSTER, ['IM', 'SU', 'OG']);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', siteInit);
else siteInit();
