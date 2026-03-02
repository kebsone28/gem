import pandas as pd
import sys

try:
    file_path = r"C:\Mes-Sites-Web\GEM_SAAS\Liste\formulaire-kobo.xlsx"
    xls = pd.ExcelFile(file_path)
    for sheet in xls.sheet_names:
        print(f"--- Sheet: {sheet} ---")
        df = pd.read_excel(xls, sheet_name=sheet)
        print("Columns:")
        for col in df.columns:
            print(f" - {col}")
        print("\nFirst 3 rows:")
        print(df.head(3).to_string())
        print("="*40)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
