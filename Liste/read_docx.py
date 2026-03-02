import zipfile
import xml.etree.ElementTree as ET
import os

docx_path = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\DEVIS_PROQUELEC_LSE 1.docx'
output_path = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\devis_content.txt'

if os.path.exists(docx_path):
    try:
        with zipfile.ZipFile(docx_path) as z:
            xml_content = z.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            text = []
            for para in tree.findall('.//w:p', ns):
                para_text = "".join([t.text for t in para.findall('.//w:t', ns) if t.text])
                if para_text:
                    text.append(para_text)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write("\n".join(text))
            
            print(f"Content saved to {output_path}")
    except Exception as e:
        print(f"Error reading Docx: {e}")
else:
    print("File not found.")
