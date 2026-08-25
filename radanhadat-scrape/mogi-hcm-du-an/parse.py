import re, os, json, csv, glob

BASE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(BASE, "pages")
OUT = BASE
files = sorted(glob.glob(os.path.join(D, "p*.md")))

TITLE = re.compile(r'^\[\*\*(.+?)\*\*\]\((https://mogi\.vn/[^)]*?-prj(\d+))\)$')
LOC   = re.compile(r'^(.+?),\s*TPHCM(.*)$')
HAND  = re.compile(r'Bàn giao:\s*(.+?)\s*$')
PRICE = re.compile(r'^(Từ\s+.+|Giá\b.+|Liên hệ.*)$')
STAT  = re.compile(r'\[(Đang bán|Cho thuê|Sắp mở bán|Đã bàn giao|Mua bán|Đã bán)\]\((https://mogi\.vn/[^)]+)\)')
PERM2 = re.compile(r'\(([^()]*m2[^()]*)\)')

rows, seen = [], set()

for fp in files:
    lines = open(fp, encoding="utf-8").read().split("\n")
    for i, ln in enumerate(lines):
        m = TITLE.match(ln.strip())
        if not m:
            continue
        name, url, pid = m.group(1).strip(), m.group(2), m.group(3)
        if pid in seen:
            continue
        seen.add(pid)
        dev = district = handover = price = ""
        statuses, listing_links = [], []
        for j in range(i + 1, min(i + 16, len(lines))):
            s = lines[j].strip()
            if not s:
                continue
            if s.startswith("![") or TITLE.match(s):
                break
            if s.startswith("- ["):
                continue
            lm = LOC.match(s)
            if lm and not district:
                district = lm.group(1).strip()
                hm = HAND.search(lm.group(2))
                handover = hm.group(1).strip() if hm else ""
                continue
            sm = STAT.findall(s)
            if sm:
                for st, lk in sm:
                    statuses.append(st)
                    listing_links.append(lk)
                continue
            if PRICE.match(s) and not price:
                price = s
                continue
            if not dev and not s.startswith("[") and not s.startswith("-"):
                dev = s
        pm = PERM2.search(price)
        per_m2 = pm.group(1).strip() if pm else ""
        from_price = PERM2.sub("", price).strip()
        rows.append(dict(
            project_id="prj" + pid, name=name, developer=dev,
            district=district, city="TPHCM", handover=handover,
            price_from=from_price, price_per_m2=per_m2,
            status="; ".join(dict.fromkeys(statuses)),
            url=url, listing_urls="; ".join(dict.fromkeys(listing_links)),
        ))

rows.sort(key=lambda r: int(r["project_id"][3:]))
with open(os.path.join(OUT, "du-an-hcm.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
with open(os.path.join(OUT, "du-an-hcm.json"), "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=1)

lines_out = ["pages parsed: %d" % len(files), "projects: %d" % len(rows)]
for k in ["developer", "district", "handover", "price_from", "status"]:
    lines_out.append("  missing %s: %d" % (k, sum(1 for r in rows if not r[k])))
from collections import Counter
lines_out.append("top districts: " + str(Counter(r["district"] for r in rows).most_common(8)))
open(os.path.join(OUT, "parse-report.txt"), "w", encoding="utf-8").write("\n".join(lines_out))
print("\n".join(lines_out[:7]))
