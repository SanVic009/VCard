import logging
from fastapi.testclient import TestClient
from main import app
import uuid

# Disable overly verbose logs for the test script
logging.getLogger("passlib").setLevel(logging.ERROR)

client = TestClient(app)

def test_auth_flow():
    # Generate a random email to ensure fresh signup
    test_email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    test_password = "securepassword123"
    
    print(f"--- Testing Signup for {test_email} ---")
    signup_response = client.post("/auth/signup", json={"email": test_email, "password": test_password})
    print(f"Status Code: {signup_response.status_code}")
    print(f"Response: {signup_response.json()}\n")
    
    print("--- Testing Login with correct credentials ---")
    login_response = client.post("/auth/login", json={"email": test_email, "password": test_password})
    print(f"Status Code: {login_response.status_code}")
    
    if login_response.status_code == 200:
        print("Login Successful!")
        token = login_response.json().get("access_token")
        
        print("\n--- Testing /auth/me with Token ---")
        me_response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        print(f"Status Code: {me_response.status_code}")
        print(f"Response: {me_response.json()}\n")
    else:
        print(f"Login failed: {login_response.json()}")

    print("--- Testing Login with WRONG credentials ---")
    wrong_login = client.post("/auth/login", json={"email": test_email, "password": "wrongpassword"})
    print(f"Status Code: {wrong_login.status_code}")
    print(f"Response: {wrong_login.json()}\n")

if __name__ == "__main__":
    test_auth_flow()
