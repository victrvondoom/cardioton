import pandas as pd
from pathlib import Path


DATASET = Path("data/raw/extention of Z-Alizadeh sani dataset.xlsx")


def inspect_sheet(df, sheet_name):
    print("\n" + "=" * 80)
    print(f"SHEET: {sheet_name}")
    print("=" * 80)

    # ---------------------------------------------------------
    # 1. Basic information
    # ---------------------------------------------------------
    print("\n[1] BASIC INFORMATION")
    print("-" * 80)
    print(f"Rows:    {df.shape[0]}")
    print(f"Columns: {df.shape[1]}")

    # ---------------------------------------------------------
    # 2. Column information
    # ---------------------------------------------------------
    print("\n[2] COLUMN INFORMATION")
    print("-" * 80)

    for i, column in enumerate(df.columns):
        dtype = df[column].dtype
        unique = df[column].nunique(dropna=False)

        print(
            f"{i:3} | "
            f"{str(column):30} | "
            f"{str(dtype):10} | "
            f"unique={unique}"
        )

    # ---------------------------------------------------------
    # 3. Missing values
    # ---------------------------------------------------------
    print("\n[3] MISSING VALUES")
    print("-" * 80)

    missing = df.isna().sum()
    missing = missing[missing > 0]

    if missing.empty:
        print("No missing values.")
    else:
        print(missing.to_string())

    # ---------------------------------------------------------
    # 4. Duplicate rows
    # ---------------------------------------------------------
    print("\n[4] DUPLICATE ROWS")
    print("-" * 80)

    duplicate_count = df.duplicated().sum()

    print(f"Duplicate rows: {duplicate_count}")

    # ---------------------------------------------------------
    # 5. Constant features
    # ---------------------------------------------------------
    print("\n[5] CONSTANT FEATURES")
    print("-" * 80)

    constant_features = [
        column
        for column in df.columns
        if df[column].nunique(dropna=False) <= 1
    ]

    if constant_features:
        for column in constant_features:
            print(f"- {column}")
    else:
        print("No constant features.")

    # ---------------------------------------------------------
    # 6. Near-constant features
    # ---------------------------------------------------------
    print("\n[6] NEAR-CONSTANT FEATURES (>95% SAME VALUE)")
    print("-" * 80)

    near_constant = []

    for column in df.columns:
        value_counts = df[column].value_counts(normalize=True, dropna=False)

        if not value_counts.empty and value_counts.iloc[0] > 0.95:
            near_constant.append(
                (column, value_counts.index[0], value_counts.iloc[0])
            )

    if near_constant:
        for column, value, proportion in near_constant:
            print(
                f"- {column}: "
                f"{proportion:.2%} = {value}"
            )
    else:
        print("No near-constant features.")

    # ---------------------------------------------------------
    # 7. Target distributions
    # ---------------------------------------------------------
    print("\n[7] TARGET DISTRIBUTIONS")
    print("-" * 80)

    targets = ["LAD", "LCX", "RCA", "Cath"]

    for target in targets:
        if target in df.columns:
            print(f"\n{target}:")
            print(df[target].value_counts(dropna=False).to_string())

    # ---------------------------------------------------------
    # 8. Categorical columns
    # ---------------------------------------------------------
    print("\n[8] CATEGORICAL / OBJECT COLUMNS")
    print("-" * 80)

    categorical_columns = df.select_dtypes(
        include=["object", "string", "category"]
    ).columns

    for column in categorical_columns:
        print(f"\n{column}")
        print(df[column].value_counts(dropna=False).to_string())

    # ---------------------------------------------------------
    # 9. Numeric summary
    # ---------------------------------------------------------
    print("\n[9] NUMERIC SUMMARY")
    print("-" * 80)

    numeric_df = df.select_dtypes(include="number")

    if not numeric_df.empty:
        print(
            numeric_df.describe()
            .T
            .to_string()
        )
    else:
        print("No numeric columns.")

    # ---------------------------------------------------------
    # 10. Target relationships
    # ---------------------------------------------------------
    print("\n[10] TARGET RELATIONSHIPS")
    print("-" * 80)

    existing_targets = [
        target for target in targets
        if target in df.columns
    ]

    if len(existing_targets) > 1:
        print(
            df[existing_targets]
            .astype("category")
            .apply(lambda x: x.cat.codes)
            .corr()
            .to_string()
        )

    # ---------------------------------------------------------
    # 11. First rows
    # ---------------------------------------------------------
    print("\n[11] FIRST 5 ROWS")
    print("-" * 80)

    print(df.head().to_string())


def main():

    print("=" * 80)
    print("CARDIOINSPECTION — DATASET FORENSICS")
    print("=" * 80)

    if not DATASET.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATASET}"
        )

    excel = pd.ExcelFile(DATASET)

    print("\nWorkbook sheets:")
    print(excel.sheet_names)

    for sheet_name in excel.sheet_names:

        df = pd.read_excel(
            DATASET,
            sheet_name=sheet_name
        )

        # Ignore completely empty sheets
        if df.empty:
            print("\n" + "=" * 80)
            print(f"SHEET: {sheet_name}")
            print("=" * 80)
            print("EMPTY SHEET — skipping analysis.")
            continue

        inspect_sheet(df, sheet_name)


if __name__ == "__main__":
    main()