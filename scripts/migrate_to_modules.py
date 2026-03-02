import os
import glob
import re

html_files = glob.glob('*.html')

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Change all <script src="src/..."></script> to <script type="module" src="src/..."></script>
    # Also for logistique_main.js, terrain_main.js etc.
    content = re.sub(r'<script\s+src="((?:src/|[a-z0-9_]+_main\.js)[^"]+)"></script>', r'<script type="module" src="\1"></script>', content)

    # Change inline scripts that use DOMContentLoaded to <script type="module">
    # Because if they depend on modules, they must be deferred.
    # We can just change all <script> that don't have src to <script type="module">, except for simple vendors if any.
    # Actually, let's just replace all <script> with <script type="module"> if they contain 'DOMContentLoaded' or 'window.db'
    
    def repl_inline(match):
        script_tag = match.group(1)
        inner = match.group(2)
        if 'DOMContentLoaded' in inner or 'window.apiService' in inner or 'window.db' in inner:
            return f'<script type="module">{inner}</script>'
        return match.group(0)

    content = re.sub(r'(<script>)([\s\S]*?)</script>', repl_inline, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print(f"Migrated {len(html_files)} HTML files to use type='module' for scripts.")
