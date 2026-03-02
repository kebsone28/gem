import os
import glob
import re

directories = [
    'src/infrastructure/repositories',
    'src/application/services',
    'src/domain/services'
]

for d in directories:
    files = glob.glob(f'{d}/*.js')
    for filepath in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        if r'(function (' in content and r'})(' in content:
            # We skip complex ones for manual handling if any, but wait, ProjectService uses `(function () {` !
            pass

        if r'(function () {' in content and r'})();' in content:
            content = content.replace('(function () {', '// (function () {')
            content = content.replace('})();', '// })();')
            
            filename = os.path.basename(filepath)
            class_name = os.path.splitext(filename)[0]
            
            content = re.sub(rf'\bclass {class_name}\b', f'export class {class_name}', content)

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Processed IIFE -> Export: {filepath}")
        else:
            filename = os.path.basename(filepath)
            class_name = os.path.splitext(filename)[0]
            if f'export class {class_name}' not in content and f'class {class_name}' in content:
                content = re.sub(rf'\bclass {class_name}\b', f'export class {class_name}', content)
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Processed pure class -> Export: {filepath}")
