import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
print(SUPABASE_URL)
print(SUPABASE_SERVICE_ROLE_KEY[:20] if SUPABASE_SERVICE_ROLE_KEY else None)
if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Credentials missing")
    exit(1)

print(f"Connecting to {SUPABASE_URL}...")
client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
response = client.auth.admin.list_users()
print("Connection Successful! Service Role Key is valid.")
print(f"Found {len(response)} users.")
