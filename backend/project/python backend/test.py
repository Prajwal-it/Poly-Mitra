from predictor import predict_admission

result = predict_admission(
    student_percentile=91.50,
    college_name="PCCOE",
    branch_name="Computer Engineering",
    category="OPEN",
    round_no=1,
    year=2027
)

print(result)