
import re

def check_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    script_match = re.search(r'<script>(?!.*src=)', text, re.DOTALL | re.IGNORECASE)
    if not script_match:
        print("No inline script found")
        return
    
    script_start_pos = script_match.end()
    script_end_match = re.search(r'</script>', text[script_start_pos:], re.DOTALL | re.IGNORECASE)
    if not script_end_match:
        print("Unclosed <script> tag")
        return
        
    script = text[script_start_pos : script_start_pos + script_end_match.start()]
    
    stack = [] # Stores (type, line_no)
    # type can be: '{', '(', '[', '`', '${', '"', "'"
    
    lines = script.split('\n')
    offset = text.count('\n', 0, script_start_pos) + 1
    
    for line_no, line in enumerate(lines):
        curr_line = line_no + offset
        j = 0
        while j < len(line):
            char = line[j]
            
            # Check top of stack
            top = stack[-1][0] if stack else None
            
            if top in ["'", '"']:
                if char == top and (j == 0 or line[j-1] != '\\'):
                    stack.pop()
            elif top == '`':
                if char == '`' and (j == 0 or line[j-1] != '\\'):
                    stack.pop()
                elif char == '$' and j + 1 < len(line) and line[j+1] == '{' and (j == 0 or line[j-1] != '\\'):
                    stack.append(('${', curr_line))
                    j += 1
            else:
                # Normal JS mode (or inside ${...})
                if char in ["'", '"', '`']:
                    stack.append((char, curr_line))
                elif char == '{':
                    stack.append(('{', curr_line))
                elif char == '}':
                    if not stack:
                        print(f"EXTRA }} at line {curr_line}")
                    else:
                        t, ln = stack.pop()
                        if t not in ['{', '${']:
                            print(f"MISMATCH: }} closes {t} from line {ln} at line {curr_line}")
                elif char == '(':
                    stack.append(('(', curr_line))
                elif char == ')':
                    if not stack:
                        print(f"EXTRA ) at line {curr_line}")
                    else:
                        t, ln = stack.pop()
                        if t != '(':
                            print(f"MISMATCH: ) closes {t} from line {ln} at line {curr_line}")
                elif char == '[':
                    stack.append(('[', curr_line))
                elif char == ']':
                    if not stack:
                        print(f"EXTRA ] at line {curr_line}")
                    else:
                        t, ln = stack.pop()
                        if t != '[':
                            print(f"MISMATCH: ] closes {t} from line {ln} at line {curr_line}")
            j += 1
            
    for t, ln in stack:
        print(f"UNCLOSED {t} started at line {ln}")

check_balance(r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\parametres.html')
