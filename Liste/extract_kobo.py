import pandas as pd
import os

excel_path = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\formulaire-kobo.xlsx'
output_md = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\kobo_audit.md'

if os.path.exists(excel_path):
    try:
        xl = pd.ExcelFile(excel_path)
        
        with open(output_md, 'w', encoding='utf-8') as f:
            # Survey
            df_survey = pd.read_excel(excel_path, sheet_name='survey')
            f.write("# Kobo Survey Audit\n\n")
            f.write("| Type | Name | Label (FR) | Required |\n")
            f.write("| --- | --- | --- | --- |\n")
            for _, row in df_survey.iterrows():
                t = str(row.get('type', ''))
                n = str(row.get('name', ''))
                l = str(row.get('label::Français (fr)', row.get('label', '')))
                r = str(row.get('required', ''))
                f.write(f"| {t} | {n} | {l} | {r} |\n")
            
            # Choices
            df_choices = pd.read_excel(excel_path, sheet_name='choices')
            f.write("\n# Kobo Choices Audit\n\n")
            f.write("| List Name | Name | Label (FR) |\n")
            f.write("| --- | --- | --- |\n")
            for _, row in df_choices.iterrows():
                ln = str(row.get('list_name', ''))
                n = str(row.get('name', ''))
                l = str(row.get('label::Français (fr)', row.get('label', '')))
                f.write(f"| {ln} | {n} | {l} |\n")
                
        print(f"Audit written to {output_md}")
            
    except Exception as e:
        print(f"Error reading Excel: {e}")
else:
    print("File not found.")
