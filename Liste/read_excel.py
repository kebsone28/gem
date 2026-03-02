import pandas as pd
import json
import os

excel_path = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\Liste-LSE.xlsx'

if os.path.exists(excel_path):
    try:
        xl = pd.ExcelFile(excel_path)
        print(f"Sheets: {xl.sheet_names}")
        # Read the first sheet or specific sheet if known
        df = pd.read_excel(excel_path, sheet_name=0)
        print("Columns:", df.columns.tolist())
        print("First 10 rows:")
        print(df.head(10).to_string())
    except Exception as e:
        print(f"Error reading Excel: {e}")
else:
    print("File not found.")
