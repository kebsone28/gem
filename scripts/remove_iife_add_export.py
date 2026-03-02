import os
import glob
import re

directories = [
    'src/domain/entities',
    'src/domain/value-objects'
]

for d in directories:
    files = glob.glob(f'{d}/*.js')
    for filepath in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check if file has IIFE
        if r'(function () {' in content and r'})();' in content:
            # We will just do a Regex replace for `class X` -> `export class X`
            # and we will comment out the IIFE wrapper, or we can just replace the specific lines.
            
            # Replace `(function () {` with nothing (commented)
            content = content.replace('(function () {', '// (function () {')
            
            # Replace `})();` at the end
            content = content.replace('})();', '// })();')
            
            # Replace `class X ` with `export class X `
            # Be careful not to replace `class Household extends ...` inside if there are other classes
            # We'll just replace the main class
            filename = os.path.basename(filepath)
            class_name = os.path.splitext(filename)[0]
            
            content = re.sub(rf'\bclass {class_name}\b', f'export class {class_name}', content)

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"Processed {filepath}")

