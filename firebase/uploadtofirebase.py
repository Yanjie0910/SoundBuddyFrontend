import json
import firebase_admin
from firebase_admin import credentials, db

print("Firebase Data Uploader")
print("=" * 60)

# Initialize Firebase Admin SDK
try:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://soundbuddy-74531-default-rtdb.asia-southeast1.firebasedatabase.app'
    })
    print("Firebase Admin SDK initialized")
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    exit(1)

def upload_json_file(file_path, firebase_path):
    """Upload a JSON file to specified Firebase path"""
    try:
        # Read JSON file
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Upload to Firebase
        ref = db.reference(firebase_path)
        ref.set(data)
        
        print(f"Uploaded: {file_path} → {firebase_path}")
        return True
    except FileNotFoundError:
        print(f"File not found: {file_path}")
        return False
    except json.JSONDecodeError:
        print(f"Invalid JSON in: {file_path}")
        return False
    except Exception as e:
        print(f"Error uploading {file_path}: {e}")
        return False

# Upload all data files
print("\nUploading data to Firebase...\n")

uploads = [
    # (local file path, Firebase path)
    ('modules/module1.json', '/modules/module1'),
    ('minigames/module1_minigame.json', '/minigames/module1'),
    ('students/demo-students.json', '/students'),
]

success_count = 0
total_count = len(uploads)

for file_path, firebase_path in uploads:
    if upload_json_file(file_path, firebase_path):
        success_count += 1

# Create a LIVE session for the demo
try:
    sessions_ref = db.reference('/sessions/active/demo_session_id')
    sessions_ref.set({
        "studentId": "demo_student",
        "studentName": "Demo Student",
        "currentModule": 1,
        "totalPoints": 0,
        "status": "playing",
        "lastAttempt": {
            "attemptNumber": 0,
            "isCorrect": False
        }
    })
    print(f"✅ Created LIVE Session: /sessions/active/demo_session_id")
    success_count += 1
    total_count += 1
except Exception as e:
    print(f"❌ Error creating active session: {e}")