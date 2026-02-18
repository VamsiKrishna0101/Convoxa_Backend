import os
import re

src_dir = r"c:\Users\Welcome\Desktop\Adda\Adda_Backend\src"

def update_imports(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern to find 'from "./path"' or 'from "../path"'
    # Handles both single line and multiline imports
    # Case 1: import ... from "./path"
    # Case 2: import {
    #   ...
    # } from "./path"
    # Case 3: export ... from "./path"
    
    # We look for 'from' followed by a relative path in quotes
    pattern = r'(from\s+[\'"])(\.\.?\/[^\'"]+)([\'"])'
    
    def replacer(match):
        prefix = match.group(1)
        path = match.group(2)
        suffix = match.group(3)
        
        # If it already has an extension or doesn't start with '.', leave it
        if not path.startswith('.'):
            return match.group(0)
            
        # Check if it has an extension that we should NOT add .js to
        # Skip if it already ends in .js, .json, .css, .scss, .svg
        if path.endswith('.js') or path.endswith('.json') or path.endswith('.css') or path.endswith('.scss') or path.endswith('.svg'):
            return match.group(0)
            
        # Add .js
        return f"{prefix}{path}.js{suffix}"

    new_content = re.sub(pattern, replacer, content)

    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

updated_count = 0
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.ts'):
            full_path = os.path.join(root, file)
            if update_imports(full_path):
                print(f"Updated: {os.path.relpath(full_path, src_dir)}")
                updated_count += 1

print(f"Total files updated: {updated_count}")
