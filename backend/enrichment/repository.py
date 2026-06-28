import logging
from typing import Optional, Dict, Any
from supabase import Client

logger = logging.getLogger(__name__)

class EnrichmentRepository:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    def get_card_by_id(self, card_id: str) -> Optional[Dict[str, Any]]:
        res = self.supabase.table("business_cards").select("*").eq("id", card_id).execute()
        if res.data:
            return res.data[0]
        return None

    def get_company_by_id(self, company_id: str) -> Optional[Dict[str, Any]]:
        res = self.supabase.table("companies").select("*").eq("id", company_id).execute()
        if res.data:
            return res.data[0]
        return None

    def normalize_website(self, url: str) -> str:
        if not url:
            return ""
        url = url.strip().lower()
        # Remove scheme
        if url.startswith("https://"):
            url = url[8:]
        elif url.startswith("http://"):
            url = url[7:]
        # Remove www.
        if url.startswith("www."):
            url = url[4:]
        # Remove trailing slash and paths
        url = url.split("/")[0]
        return url

    def find_existing_company(self, websites: list[str], company_name: Optional[str]) -> Optional[Dict[str, Any]]:
        # Match by website first (normalized match)
        card_website = websites[0].strip() if websites and len(websites) > 0 and websites[0] else None
        if card_website:
            normalized_card = self.normalize_website(card_website)
            if normalized_card:
                res = self.supabase.table("companies").select("*").execute()
                for company in res.data:
                    comp_web = company.get("website")
                    if comp_web and self.normalize_website(comp_web) == normalized_card:
                        logger.info(f"Deduplication match found by website domain: {comp_web} == {card_website}")
                        return company
                
        # If no website on the card, or no website match, match by name (case-insensitive exact match on companies.name)
        if company_name and company_name.strip():
            trimmed_name = company_name.strip()
            # PostgREST ilike performs case-insensitive comparison
            res = self.supabase.table("companies").select("*").ilike("name", trimmed_name).execute()
            if res.data:
                logger.info(f"Deduplication match found by name: {trimmed_name}")
                return res.data[0]
                
        return None

    def create_pending_company(self, name: Optional[str], website: Optional[str]) -> Dict[str, Any]:
        insert_data = {
            "name": name,
            "website": website,
            "enrichment_status": "pending",
            "products": [],
            "services": [],
            "technologies": []
        }
        res = self.supabase.table("companies").insert(insert_data).execute()
        if not res.data:
            raise Exception("Failed to insert pending company")
        return res.data[0]

    def link_card_to_company(self, card_id: str, company_id: str) -> None:
        self.supabase.table("business_cards").update({"company_id": company_id}).eq("id", card_id).execute()

    def update_company_success(self, company_id: str, data: Dict[str, Any], raw_response: Dict[str, Any]) -> None:
        update_data = {
            "name": data.get("company_name") or data.get("name"),
            "website": data.get("website") or data.get("company_url"),
            "location": data.get("location"),
            "products": data.get("products") or [],
            "services": data.get("services") or [],
            "technologies": data.get("technologies") or [],
            "raw_data": raw_response,
            "enrichment_status": "completed",
            "enrichment_error": None
        }
        self.supabase.table("companies").update(update_data).eq("id", company_id).execute()

    def update_company_failure(self, company_id: str, error_message: str) -> None:
        update_data = {
            "enrichment_status": "failed",
            "enrichment_error": error_message
        }
        self.supabase.table("companies").update(update_data).eq("id", company_id).execute()
