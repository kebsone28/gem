import os
import glob
import re

directories = [
    'src/infrastructure/repositories',
    'src/infrastructure/events',
    'src/infrastructure/logging',
    'src/infrastructure/errors',
    'src/infrastructure/monitoring',
    'src/infrastructure/sync',
    'src/infrastructure/backup',
    'src/infrastructure/migrations',
    'src/domain/registry',
    'src/application/services',
    'src/application/state',
    'src/domain/services',
    'src/shared/errors',
    'src/modules/grappe-assignment/models',
    'src/modules/grappe-assignment/views',
    'src/modules/grappe-assignment/controllers'
]

for d in directories:
    files = glob.glob(f'{d}/*.js')
    for filepath in files:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check if file has IIFE
        if r'(function (' in content and r'})(' in content:
            # Replace IIFE with global wrapper and export
            pass # more complex Regex needed for ones with arguments
            
        elif r'(function () {' in content and r'})();' in content:
            content = content.replace('(function () {', '// (function () {')
            content = content.replace('})();', '// })();')
            
            filename = os.path.basename(filepath)
            class_name = os.path.splitext(filename)[0]
            
            # Export class
            content = re.sub(rf'\bclass {class_name}\b', f'export class {class_name}', content)

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Processed {filepath}")

        else:
            # Just add export if not already present
            filename = os.path.basename(filepath)
            class_name = os.path.splitext(filename)[0]
            if f'export class {class_name}' not in content:
                content = re.sub(rf'\bclass {class_name}\b', f'export class {class_name}', content)
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Processed without IIFE {filepath}")
