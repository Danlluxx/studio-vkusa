#!/usr/bin/env python3
"""Выгрузка контента Битрикса (локальная копия в Docker) в JSON для нового сайта."""
import json, subprocess, sys, os
OUT = os.path.join(os.path.dirname(__file__), '..', 'web', 'src', 'data')
os.makedirs(OUT, exist_ok=True)

def q(sql):
    r = subprocess.run(['docker','compose','exec','-T','db','mariadb','-uroot','-proot','vkusa',
                        '--default-character-set=utf8mb4','-N','-B','-r','-e',sql],
                       capture_output=True, text=True, check=True, cwd=os.path.join(os.path.dirname(__file__),'..'))
    out = r.stdout.strip()
    return json.loads(out) if out and out != 'NULL' else []

FILE = "CONCAT('/upload/',f.SUBDIR,'/',f.FILE_NAME)"
def rows(sql): return q(f"select coalesce(JSON_ARRAYAGG(j),'[]') from ({sql}) t")

sections = rows("""select JSON_OBJECT('id',s.ID,'code',s.CODE,'name',trim(s.NAME),'parent',s.IBLOCK_SECTION_ID,
  'depth',s.DEPTH_LEVEL,'sort',s.SORT,'active',s.ACTIVE,'description',s.DESCRIPTION,
  'picture',(select """+FILE+""" from b_file f where f.ID=s.PICTURE)) j
  from b_iblock_section s where s.IBLOCK_ID=5 and s.ACTIVE='Y' order by s.LEFT_MARGIN""")

items = rows("""select JSON_OBJECT('id',e.ID,'code',e.CODE,'name',trim(e.NAME),'section',e.IBLOCK_SECTION_ID,'sort',e.SORT,
  'preview',e.PREVIEW_TEXT,'detail',e.DETAIL_TEXT,
  'image',(select """+FILE+""" from b_file f where f.ID=e.DETAIL_PICTURE),
  'imagePreview',(select """+FILE+""" from b_file f where f.ID=e.PREVIEW_PICTURE),
  'price',(select p.VALUE from b_iblock_element_property p where p.IBLOCK_ELEMENT_ID=e.ID and p.IBLOCK_PROPERTY_ID=5 limit 1),
  'unit',(select en.VALUE from b_iblock_element_property p join b_iblock_property_enum en on en.ID=p.VALUE_NUM where p.IBLOCK_ELEMENT_ID=e.ID and p.IBLOCK_PROPERTY_ID=7 limit 1),
  'priceText',(select p.VALUE from b_iblock_element_property p where p.IBLOCK_ELEMENT_ID=e.ID and p.IBLOCK_PROPERTY_ID=25 limit 1),
  'popular',exists(select 1 from b_iblock_element_property p where p.IBLOCK_ELEMENT_ID=e.ID and p.IBLOCK_PROPERTY_ID=8 and p.VALUE is not null and p.VALUE<>''),
  'photos',(select coalesce(JSON_ARRAYAGG(CONCAT('/upload/',f.SUBDIR,'/',f.FILE_NAME)),JSON_ARRAY()) from b_iblock_element_property p join b_file f on f.ID=p.VALUE_NUM where p.IBLOCK_ELEMENT_ID=e.ID and p.IBLOCK_PROPERTY_ID=6),
  'menuPdf',(select """+FILE+""" from b_iblock_element_property p join b_file f on f.ID=p.VALUE_NUM where p.IBLOCK_ELEMENT_ID=e.ID and p.IBLOCK_PROPERTY_ID=9 limit 1)) j
  from b_iblock_element e where e.IBLOCK_ID=5 and e.ACTIVE='Y' order by e.SORT, e.ID""")

def simple(iblock, extra=''):
    return rows(f"""select JSON_OBJECT('id',e.ID,'name',trim(e.NAME),'sort',e.SORT,'preview',e.PREVIEW_TEXT,'detail',e.DETAIL_TEXT,
      'image',(select {FILE} from b_file f where f.ID=e.PREVIEW_PICTURE),
      'imageDetail',(select {FILE} from b_file f where f.ID=e.DETAIL_PICTURE){extra}) j
      from b_iblock_element e where e.IBLOCK_ID={iblock} and e.ACTIVE='Y' order by e.SORT, e.ID""")

data = {'sections': sections, 'items': items,
        'slider': simple(1), 'gallery': simple(2), 'clients': simple(3),
        'certificates': simple(4), 'benefits': simple(6), 'reports': simple(9)}
for k, v in data.items():
    json.dump(v, open(os.path.join(OUT, k + '.json'), 'w'), ensure_ascii=False, indent=1)
    print(k, len(v))
