import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from catboost import CatBoostRegressor

# ==========================
# LOAD DATA
# ==========================
df = pd.read_csv("data/ml_training_data_updated.csv")

# Remove rows without target
df = df.dropna(subset=["percentage"])

# Keep only required columns
df = df[
    [
        "year",
        "round",
        "collegeName",
        "branchName",
        "category",
        "percentage"
    ]
]

# Fill missing values
df["collegeName"] = df["collegeName"].fillna("Unknown")
df["branchName"] = df["branchName"].fillna("Unknown")
df["category"] = df["category"].fillna("OPEN")

# Features and target
X = df.drop("percentage", axis=1)
y = df["percentage"]

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42
)

# Categorical columns index
cat_features = [2, 3, 4]

# ==========================
# TRAIN MODEL
# ==========================
model = CatBoostRegressor(
    iterations=1000,
    learning_rate=0.05,
    depth=8,
    loss_function="RMSE",
    eval_metric="RMSE",
    random_seed=42,
    verbose=100
)

model.fit(
    X_train,
    y_train,
    cat_features=cat_features
)

# ==========================
# EVALUATION
# ==========================
pred = model.predict(X_test)

mae = mean_absolute_error(y_test, pred)
rmse = mean_squared_error(
    y_test,
    pred
) ** 0.5

r2 = r2_score(y_test, pred)

print("\nRESULTS")
print("MAE :", mae)
print("RMSE:", rmse)
print("R2 :", r2)

# Save model
joblib.dump(
    model,
    "models/cutoff_model.pkl"
)

print("Model saved.")