# -*- coding: utf-8 -*-
"""Extract chapters 201-556 from the user-supplied DOCX (read-only) into story-source/chapters-3.json."""
import zipfile, re, json, os, sys
from xml.etree import ElementTree as ET

SRC = r'F:\DeepSeek\LCR\全球诡异时代2（第二部）_201-556章_全文.docx'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'story-source')
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

def paragraphs():
    with zipfile.ZipFile(SRC) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    for p in root.iter(W + 'p'):
        t = ''.join(x.text or '' for x in p.iter(W + 't')).strip()
        if t: yield t

def main():
    os.makedirs(OUT, exist_ok=True)
    head = re.compile(r'^第\s*(\d+)\s*章[\s:：]*(.*)$')
    chapters, cur = [], None
    pre = []
    for t in paragraphs():
        m = head.match(t)
        if m and len(t) < 60:
            cur = {'num': int(m.group(1)), 'title': m.group(2).strip(), 'body': []}
            chapters.append(cur)
        elif cur: cur['body'].append(t)
        else: pre.append(t)
    for c in chapters: c['body'] = '\n'.join(c['body'])
    json.dump(chapters, open(os.path.join(OUT, 'chapters-3.json'), 'w', encoding='utf8'), ensure_ascii=False)
    with open(os.path.join(OUT, 'headings-3.txt'), 'w', encoding='utf8') as f:
        for c in chapters: f.write(f"{c['num']}\t{len(c['body'])}\t{c['title']}\n")
    nums = [c['num'] for c in chapters]
    print(len(chapters), 'chapters', min(nums), max(nums), 'chars', sum(len(c['body']) for c in chapters), 'preface', len(pre), pre[:3])
    missing = sorted(set(range(min(nums), max(nums) + 1)) - set(nums)); dup = sorted({n for n in nums if nums.count(n) > 1})
    print('missing', missing[:40], 'dup', dup[:40])

main()
