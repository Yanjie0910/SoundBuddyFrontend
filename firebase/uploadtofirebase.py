import json
import firebase_admin
from firebase_admin import credentials, db

print("Firebase Data Uploader")
print("=" * 60)

try:
    cred = credentials.Certificate("serviceAccountKey.json")

    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred, {
            "databaseURL": "https://soundbuddy-74531-default-rtdb.asia-southeast1.firebasedatabase.app"
        })

    print("Firebase Admin SDK initialized")

except Exception as e:
    print(f"Error initializing Firebase: {e}")
    exit(1)


def upload_json_file(file_path, firebase_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        ref = db.reference(firebase_path)
        ref.set(data)

        print(f"Uploaded: {file_path} → {firebase_path}")
        return True

    except FileNotFoundError:
        print(f"File not found: {file_path}")
        return False

    except json.JSONDecodeError as e:
        print(f"Invalid JSON in {file_path}: {e}")
        return False

    except Exception as e:
        print(f"Error uploading {file_path}: {e}")
        return False


print("\nUploading data to Firebase...\n")

uploads = [
    ("modules/module1.json", "/modules/module1"),
    ("modules/module2.json", "/modules/module2"),
    ("modules/module3.json", "/modules/module3"),

    ("minigames/module1_minigame.json", "/minigames/module1"),
    ("minigames/module2_minigame.json", "/minigames/module2"),
    ("minigames/module3_minigame.json", "/minigames/module3"),
]

success_count = 0

for file_path, firebase_path in uploads:
    if upload_json_file(file_path, firebase_path):
        success_count += 1

print("\nUpload Summary")
print("=" * 60)
print(f"Successful uploads: {success_count}/{len(uploads)}")

if success_count == len(uploads):
    print("All selected files uploaded successfully.")
else:
    print("Some files failed to upload. Check the messages above.")