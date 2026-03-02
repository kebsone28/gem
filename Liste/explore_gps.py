import pandas as pd

excel_path = r'c:\Users\User\Documents\PROQUELEC\2. PROJET\PROJET LSE\Gestion électrification massive - V3\Liste\Liste-LSE.xlsx'

df = pd.read_excel(excel_path, sheet_name=0)

print("=== COLUMNS ===")
for i, col in enumerate(df.columns.tolist()):
    print(f"[{i}] {repr(col)}")

print(f"\n=== TOTAL ROWS: {len(df)} ===")

if 'region' in df.columns:
    print("\n=== REGIONS & COUNTS ===")
    print(df['region'].value_counts().to_string())

# Print numeric columns (potential GPS)
print("\n=== NUMERIC COLUMNS (potential GPS) ===")
num_cols = df.select_dtypes(include=['float64', 'int64']).columns.tolist()
print(num_cols)

# Show value ranges for numeric columns
for col in num_cols:
    mn = df[col].min()
    mx = df[col].max()
    if -90 <= mn <= 90 and -180 <= mx <= 180:
        print(f"  {col}: min={mn:.5f}, max={mx:.5f}  <-- POSSIBLE GPS")
    else:
        print(f"  {col}: min={mn}, max={mx}")
