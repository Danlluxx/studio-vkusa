#!/usr/bin/env python3
"""Урезает шрифты Fontsource: ограничивает ось насыщенности и оставляет нужные символы. Запуск: python3 scripts/subset-fonts.py"""
import os
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer

BASE = 'node_modules/@fontsource-variable/'
OUT = 'src/fonts/'
LATIN = list(range(0x20, 0x7F)) + [0xA0, 0xAB, 0xB7, 0xBB, 0xD7] + list(range(0x2010, 0x2016)) + list(range(0x2018, 0x201F)) + [0x2022, 0x2026, 0x2116, 0x20BD]
CYR = list(range(0x400, 0x460)) + [0x490, 0x491, 0x2116, 0x301]
JOBS = [
    ('playfair-display/files/playfair-display-cyrillic-wght-normal.woff2', 'playfair-cyr.woff2', CYR, (400, 700)),
    ('playfair-display/files/playfair-display-cyrillic-wght-italic.woff2', 'playfair-cyr-italic.woff2', CYR, (400, 700)),
    ('playfair-display/files/playfair-display-latin-wght-normal.woff2', 'playfair-latin.woff2', LATIN, (400, 700)),
    ('playfair-display/files/playfair-display-latin-wght-italic.woff2', 'playfair-latin-italic.woff2', LATIN, (400, 700)),
    ('manrope/files/manrope-cyrillic-wght-normal.woff2', 'manrope-cyr.woff2', CYR, (400, 800)),
    ('manrope/files/manrope-latin-wght-normal.woff2', 'manrope-latin.woff2', LATIN, (400, 800)),
]
os.makedirs(OUT, exist_ok=True)
for src, dst, chars, (lo, hi) in JOBS:
    f = TTFont(BASE + src)
    opts = subset.Options(); opts.layout_features = ['kern', 'liga', 'locl', 'mark', 'mkmk']; opts.notdef_outline = True; opts.name_IDs = [1, 2]
    s = subset.Subsetter(opts); s.populate(unicodes=chars); s.subset(f)
    f = instancer.instantiateVariableFont(f, {'wght': (lo, hi)})
    f.flavor = 'woff2'; f.save(OUT + dst)
    print(f'{dst:28} {os.path.getsize(BASE + src)//1024:3d} KB -> {os.path.getsize(OUT + dst)/1024:5.1f} KB')
