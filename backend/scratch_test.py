import json

with open('cutoffs2025_round1.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print('Total records:', len(data))
lopenh = [r for r in data if r.get('category') == 'LOPENH']
print('LOPENH records count:', len(lopenh))
if lopenh:
    print('Sample LOPENH:', lopenh[0])
