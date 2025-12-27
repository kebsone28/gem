import pandas as pd
import sys

file_path = r"C:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\KOBO\Nouveau dossier\aEYZwPujJiFBTNb6mxMGCB.xlsx"

try:
    xl = pd.ExcelFile(file_path)
    
    if 'survey' in xl.sheet_names and 'choices' in xl.sheet_names:
        print("--- Kobo Form Analysis ---")
        df_survey = pd.read_excel(file_path, sheet_name='survey')
        df_choices = pd.read_excel(file_path, sheet_name='choices')

        # 1. Find columns that might be status
        # We look for select_one type
        df_survey['type'] = df_survey['type'].astype(str)
        select_questions = df_survey[df_survey['type'].str.startswith('select_one')]
        
        print(f"\nFound {len(select_questions)} 'select_one' questions.")
        
        for idx, row in select_questions.iterrows():
            q_name = row['name']
            q_label = row.get('label', 'No Label')
            q_type = row['type'] # e.g. "select_one cj3rh91"
            
            # Extract list name
            list_name = q_type.split(' ')[1] if len(q_type.split(' ')) > 1 else None
            
            if list_name:
                print(f"\nQuestion: {q_name} ({q_label})")
                print(f"  -> Uses list: {list_name}")
                
                # Find options
                options = df_choices[df_choices['list_name'] == list_name]
                if not options.empty:
                    print("  -> Options:")
                    for _, opt in options.iterrows():
                        print(f"     - {opt.get('name', '')} : {opt.get('label', '')}")
    else:
        print("Not a standard Kobo XLSForm (missing survey/choices sheets)")

except Exception as e:
    print(f"Error: {e}")
