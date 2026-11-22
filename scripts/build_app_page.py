#!/usr/bin/env python3
"""Build download/attendmate-site/app.html from the single-file edition
(download/attendmate-pro.html): strip the landing page, replace the hash
router with a standalone init, and wire cross-links to the website.
Fail loudly if any marker is missing."""
import pathlib

SRC = pathlib.Path('/home/z/my-project/download/attendmate-pro.html')
DST = pathlib.Path('/home/z/my-project/download/attendmate-site/app.html')

html = SRC.read_text(encoding='utf-8')

def cut(s, start, end, keep='before'):
    i = s.find(start)
    assert i >= 0, f'marker not found: {start[:60]!r}'
    j = s.find(end, i + len(start))
    assert j >= 0, f'marker not found: {end[:60]!r}'
    return s[:i] + s[j + len(end):] if keep == 'between' else s[:i] + s[j:]

# 1) drop the whole landing section (between the two route comments)
html = cut(html,
           '<!-- ================= WEBSITE / LANDING (route: #home) ================= -->',
           '<!-- ================= APP (route: #app) ================= -->',
           keep='between')

# 2) title + manifest link
old_title = '<title>AttendMate Pro — NSMCH Phase-III Attendance Tracker</title>'
assert old_title in html
html = html.replace(old_title, '<title>Dashboard — AttendMate Pro</title>')

fav = '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,'
assert fav in html
# insert manifest link right after the favicon link element (end of that line)
lines = html.split('\n')
for k, ln in enumerate(lines):
    if ln.startswith('<link rel="icon"'):
        lines[k] = ln + '\n<link rel="manifest" href="manifest.webmanifest">'
        break
else:
    raise AssertionError('favicon line not found')
html = '\n'.join(lines)

# 3) replace router section with standalone init
start_marker = 'let lastRoute = null;'
end_marker = 'init();'
i = html.find(start_marker)
assert i >= 0, 'router start marker missing'
j = html.find(end_marker, i)
assert j >= 0, 'init() call missing'
new_block = '''window.addEventListener('error', () => { try { toast('Something went wrong — your data is safe'); } catch (e) { } });
window.addEventListener('unhandledrejection', () => { try { toast('Something went wrong — your data is safe'); } catch (e) { } });

function wireChrome() {
  const homeBtn = document.getElementById('btn-site-home');
  if (homeBtn) homeBtn.addEventListener('click', () => { location.href = 'index.html'; });
  const siteTheme = document.getElementById('btn-theme-site');
  if (siteTheme) siteTheme.addEventListener('click', () => document.getElementById('btn-theme').click());
}

function init() {
  loadState();
  document.getElementById('brand-mark').innerHTML = icon('cap', 20);
  applyTheme();
  buildNav();
  document.getElementById('extra-subject').innerHTML = SUBJECTS.map(s => `<option value="${s.code}">${esc(s.name)} (${s.code})</option>`).join('');
  document.getElementById('fill-from').value = shiftDate(todayIso, -7);
  document.getElementById('fill-to').value = shiftDate(todayIso, -1);
  wireEvents();
  wireLogin();
  wireChrome();
  switchTab(state.activeTab || 'today');
  if (!isSignedIn()) showLogin();
}
init();'''
html = html[:i] + new_block + html[j + len(end_marker):]

# 4) applyTheme mirrors theme to the site key
old_at = '''function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.profile.theme);
  const ic = state.profile.theme === 'dark' ? icon('sun') : icon('moon');
  document.getElementById('theme-icon').innerHTML = ic;
  const icSite = document.getElementById('theme-icon-site');
  if (icSite) icSite.innerHTML = ic;
}'''
new_at = '''function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.profile.theme);
  const ic = state.profile.theme === 'dark' ? icon('sun') : icon('moon');
  document.getElementById('theme-icon').innerHTML = ic;
  try { localStorage.setItem('attendmate_site_theme', state.profile.theme); } catch (e) { }
}'''
assert old_at in html, 'applyTheme body drifted'
html = html.replace(old_at, new_at)

# 5) app footer links back into the website
old_foot = 'Built for medical students · NSMCH Bihta, Patna · Phase-III (Part-2) · Batch 2023 · Session 2026–27 — data stays on your device.'
new_foot = ('Part of the <a href="index.html">AttendMate Pro website</a> · <a href="features.html">Features</a> · '
            '<a href="roster.html">Roster</a> · <a href="faq.html">FAQ</a> · NSMCH Bihta, Patna · '
            'Phase-III (Part-2) · Batch 2023 — data stays on your device.')
assert old_foot in html, 'app footer text drifted'
html = html.replace(old_foot, new_foot)

# 6) login card footer: back-to-website link
old_gfoot = '<div class="g-foot">\n    <span>English (India)</span>\n    <span>Help · Privacy · Terms</span>\n  </div>'
new_gfoot = '<div class="g-foot">\n    <span><a href="index.html" style="text-decoration:none">&larr; Back to website</a></span>\n    <span>English (India) · Help · Privacy</span>\n  </div>'
assert old_gfoot in html, 'login g-foot drifted'
html = html.replace(old_gfoot, new_gfoot)

# sanity: no landing leftovers (markup), and strip landing-only CSS
assert 'id="site"' not in html, 'landing remnants in app.html'
assert 'class="hero-preview"' not in html
assert html.count('btn-site-home') >= 2  # markup + wiring
assert 'hashchange' not in html

css_start = '#site{min-height:100vh}'
css_end = '/* --- premium app reskin --- */'
i = html.find(css_start)
assert i >= 0, 'landing CSS start marker missing'
j = html.find(css_end, i)
assert j >= 0, 'landing CSS end marker missing'
html = html[:i] + html[j:]

DST.write_text(html, encoding='utf-8')
print(f'OK wrote {DST} ({DST.stat().st_size} bytes)')
