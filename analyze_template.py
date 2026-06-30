from docx import Document
import zipfile
import sys
import os
import xml.etree.ElementTree as ET

try:
    # Extract content from .dotx template
    src = 'archive/Liste/CDC_COMPLET_PROJET_RACCORDEMENT (1).dotx'
    
    with zipfile.ZipFile(src, 'r') as zip_ref:
        # Extract document.xml
        document_xml = zip_ref.read('word/document.xml')
        
        # Parse XML
        root = ET.fromstring(document_xml)
        
        # Define namespaces
        namespaces = {
            'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
        }
        
        print('=== STRUCTURE DU TEMPLATE ===')
        
        # Extract paragraphs
        paragraphs = root.findall('.//w:p', namespaces)
        print(f'Nombre de paragraphes: {len(paragraphs)}')
        
        print('\n=== PARAGRAPHES ===')
        for i, para in enumerate(paragraphs[:50]):
            texts = para.findall('.//w:t', namespaces)
            text = ''.join([t.text for t in texts if t.text])
            if text.strip():
                # Get style
                style_node = para.find('.//w:pStyle', namespaces)
                style = style_node.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val') if style_node is not None else 'None'
                print(f'{i}: [{style}] {text[:100]}')
        
        # Extract tables
        tables = root.findall('.//w:tbl', namespaces)
        print(f'\nNombre de tables: {len(tables)}')
        
        print('\n=== TABLES ===')
        for i, table in enumerate(tables[:10]):
            rows = table.findall('.//w:tr', namespaces)
            print(f'Table {i}: {len(rows)} rows')
            if rows:
                first_row = rows[0]
                cells = first_row.findall('.//w:tc', namespaces)
                for j, cell in enumerate(cells[:5]):
                    texts = cell.findall('.//w:t', namespaces)
                    text = ''.join([t.text for t in texts if t.text])
                    print(f'  Col {j}: {text[:50]}')
    
except Exception as e:
    print(f'Erreur: {e}', file=sys.stderr)
    import traceback
    traceback.print_exc()
    sys.exit(1)
