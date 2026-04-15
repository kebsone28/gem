import pandas as pd
import sys

try:
    file_path = r"C:\Mes-Sites-Web\GEM_SAAS\Liste\formulaire-kobo.xlsx"
    out_path = r"C:\Mes-Sites-Web\GEM_SAAS\Liste\kobo_survey_fields.md"
    df = pd.read_excel(file_path, sheet_name="survey")
    
    # Filter columns that exist
    cols = []
    for c in ['type', 'name', 'label::Français (fr)']:
        if c in df.columns:
            cols.append(c)
            
    df_sub = df[cols].dropna(subset=['name'])
    
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write("# Kobo Form Fields\n\n")
        f.write(df_sub.to_markdown(index=False))
        
    print(f"Successfully wrote to {out_path}")
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
