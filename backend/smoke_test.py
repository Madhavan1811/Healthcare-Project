import sys
sys.path.insert(0, '.')

from ml.predict import predict_all

result = predict_all({
    'age': 55, 'sex': 'male', 'height_cm': 175, 'weight_kg': 83,
    'smoking_status': 'former', 'exercise_frequency': '1_2',
    'sleep_hours': 5, 'alcohol_use': 'occasional',
    'high_bp': True, 'high_chol': True, 'diabetes': 'prediabetes',
    'kidney_disease': False, 'copd': False, 'depression': False,
    'difficulty_walking': False, 'general_health': 'good', 'physical_unwell_days': 15
})

for k, v in result.items():
    print(k, 'risk_percent=%s' % v['risk_percent'], 'level=%s' % v['risk_level'])
