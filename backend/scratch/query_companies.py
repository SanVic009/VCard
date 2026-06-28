import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import settings
from supabase import create_client

def main():
    load_dotenv()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        print("Supabase credentials not configured.")
        return
        
    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
    
    print("--- BUSINESS CARDS ---")
    cards = supabase.table("business_cards").select("*").execute()
    for card in cards.data:
        print(f"ID: {card['id']} | Name: {card.get('name')} | Company: {card.get('company')} | Company ID: {card.get('company_id')}")
        
    print("\n--- COMPANIES ---")
    companies = supabase.table("companies").select("*").execute()
    for comp in companies.data:
        print(f"ID: {comp['id']}")
        print(f"  Name: {comp.get('name')}")
        print(f"  Website: {comp.get('website')}")
        print(f"  Status: {comp.get('enrichment_status')}")
        print(f"  Error: {comp.get('enrichment_error')}")
        print(f"  Products: {comp.get('products')}")
        print(f"  Services: {comp.get('services')}")
        print(f"  Tech: {comp.get('technologies')}")

if __name__ == "__main__":
    main()
