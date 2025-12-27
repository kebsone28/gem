import os
import zipfile

root = os.path.join(os.getcwd(), 'test-results')
found = []
for dirpath, dirnames, filenames in os.walk(root):
    for f in filenames:
        if f == 'trace.zip' and 'terrain-Terrain' in dirpath:
            found.append(os.path.join(dirpath, f))

if not found:
    print('NO_TRACE_FOUND')
    raise SystemExit(2)

out_dir = os.path.join(root, 'terrain-trace-extracted')
if not os.path.exists(out_dir):
    os.makedirs(out_dir)

for zp in found:
    print('Extracting', zp)
    with zipfile.ZipFile(zp, 'r') as z:
        z.extractall(out_dir)
print('DONE')
