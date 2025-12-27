import csv
from collections import Counter

path = r"c:\Mes Sites Web\Gestion électrification massive - V3\KOBO\Nouveau dossier\Thies.csv"

with open(path, newline='', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    header_len = len(header)
    counts = Counter()
    bad_lines = []
    sample_bad = []
    for i, row in enumerate(reader, start=2):
        counts[len(row)] += 1
        if len(row) != header_len:
            bad_lines.append((i, len(row), row))
            if len(sample_bad) < 5:
                sample_bad.append((i, len(row), row))

print('Header columns:', header)
print('Header length:', header_len)
print('Row counts by length:', counts)
print('Number of inconsistent rows:', len(bad_lines))
print('Sample inconsistent rows:')
for r in sample_bad:
    print(r)
