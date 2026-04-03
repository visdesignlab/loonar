import os
import json
from django.conf import settings
from django.core.files.storage import default_storage

def check_data():
    print(f"MEDIA_ROOT: {settings.MEDIA_ROOT}")
    exists = default_storage.exists('aa_index.json')
    print(f"aa_index.json exists: {exists}")
    if exists:
        with default_storage.open('aa_index.json', 'r') as f:
            content = f.read()
            print("Content (first 100 chars):", content[:100])
            try:
                data = json.loads(content)
                print("Experiments count:", len(data.get('experiments', [])))
            except Exception as e:
                print("JSON mismatch:", e)
    
    # Check directory listing
    try:
        subdirs, files = default_storage.listdir('')
        print("Files in root:", files)
    except Exception as e:
        print("Listdir error:", e)

if __name__ == "__main__":
    import django
    django.setup()
    check_data()
