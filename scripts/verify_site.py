#!/usr/bin/env python3
"""Static QA for the AttendMate Pro website:
1. every internal href/src resolves to an existing file (and anchors exist in target pages)
2. every page has title/description/viewport/manifest/theme-color
3. no accidental absolute http links in page bodies (offline purity)
"""
import pathlib, re, sys

ROOT = pathlib.Path('/home/z/my-project/download/attendmate-site')
pages = sorted(ROOT.glob('*.html'))
errors = []

def anchors(path):
    txt = path.read_text(encoding='utf-8')
    return set(re.findall(r'id="([^"]+)"', txt)) | set(re.findall(r'name="([^"]+)"', txt))

for page in pages:
    txt = page.read_text(encoding='utf-8')
    # meta essentials
    for needle, what in [('<title>', 'title'), ('name="description"', 'meta description'),
                         ('name="viewport"', 'viewport meta'), ('rel="manifest"', 'manifest link'),
                         ('name="theme-color"', 'theme-color meta')]:
        if needle not in txt:
            errors.append(f'{page.name}: missing {what}')
    # links
    for m in re.finditer(r'(?:href|src)="([^"]+)"', txt):
        url = m.group(1)
        if url.startswith(('http://', 'https://', 'data:', 'mailto:')):
            if url.startswith('http') and 'w3.org' not in url:
                errors.append(f'{page.name}: external URL {url}')
            continue
        target, _, frag = url.partition('#')
        if target:
            p = (ROOT / target).resolve()
            if not p.exists():
                errors.append(f'{page.name}: broken link {url}')
            elif frag:
                if frag not in anchors(p):
                    errors.append(f'{page.name}: missing anchor #{frag} in {target}')
        elif frag and frag not in anchors(page):
            errors.append(f'{page.name}: missing same-page anchor #{frag}')

# orphans: assets referenced from nowhere would be fine (they are referenced), check the inverse:
known = {p.name for p in pages} | {'css/style.css', 'js/site.js', 'manifest.webmanifest', 'robots.txt', 'README.md'}
for asset in (ROOT / 'assets').rglob('*'):
    if asset.is_file():
        rel = asset.relative_to(ROOT).as_posix()
        referenced = any(rel in p.read_text(encoding='utf-8') for p in pages)
        if not referenced and 'screenshots' in rel:
            errors.append(f'unreferenced screenshot: {rel}')

if errors:
    print('FAIL')
    for e in errors:
        print(' -', e)
    sys.exit(1)
print(f'PASS — {len(pages)} pages checked, all links/anchors/metas OK')
