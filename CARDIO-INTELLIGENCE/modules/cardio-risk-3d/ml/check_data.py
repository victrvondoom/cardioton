import pandas as pd

df = pd.read_excel("data/extension of Z-Alizadeh Sani Dataset.xlsx")

print("Shape:")
print(df.shape)

print("\nColumns:")
print(df.columns.tolist())

print("\nFirst 5 rows:")
print(df.head())

print("\nMissing values:")
print(df.isnull().sum())

print("\nTarget values:")

print("\nCath:")
print(df["Cath"].value_counts())

print("\nLAD:")
print(df["LAD"].value_counts())

print("\nLCX:")
print(df["LCX"].value_counts())

print("\nRCA:")
print(df["RCA"].value_counts())
