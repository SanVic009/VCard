import base64
from io import BytesIO
from PIL import Image
from fastapi.testclient import TestClient
from main import app
from auth.dependencies import get_current_user

# Mock authentication dependency
def mock_get_current_user():
    return {"id": "00000000-0000-0000-0000-000000000000", "email": "test@example.com"}

app.dependency_overrides[get_current_user] = mock_get_current_user

client = TestClient(app)

def test_extract_endpoint():
    image_path = "images/1.jpg"
    
    # Resize and compress like the frontend does
    img = Image.open(image_path)
    img.thumbnail((1000, 1000))
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    image_data = buffer.getvalue()
    
    image_base64 = base64.b64encode(image_data).decode('utf-8')
    print(f"Compressed image base64 size: {len(image_base64) / 1024:.1f} KB")
    
    # Test single-image backward compatibility payload
    print("Testing single-image payload...")
    response = client.post("/extraction/extract", json={
        "image_base64": image_base64,
        "mime_type": "image/jpeg"
    })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}\n")
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Test multi-image payload
    print("Testing multi-image payload...")
    response = client.post("/extraction/extract", json={
        "images": [
            {
                "image_base64": image_base64,
                "mime_type": "image/jpeg"
            },
            {
                "image_base64": image_base64,
                "mime_type": "image/jpeg"
            }
        ]
    })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}\n")
    assert response.status_code == 200
    assert response.json()["success"] is True

if __name__ == "__main__":
    test_extract_endpoint()
