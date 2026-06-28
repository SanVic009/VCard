import logging
from fastapi import APIRouter, Depends, BackgroundTasks, status, HTTPException
from supabase import Client
from auth.dependencies import get_current_user, get_supabase
from core.config import settings
from .schemas import EnrichmentRequest, EnrichmentStatusResponse, CompanyDetailResponse
from .repository import EnrichmentRepository
from .service import EnrichmentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/enrichment", tags=["Enrichment"])

def get_enrichment_repo(supabase: Client = Depends(get_supabase)) -> EnrichmentRepository:
    return EnrichmentRepository(supabase)

def get_enrichment_service() -> EnrichmentService:
    return EnrichmentService(settings.gemini_api_key)

def run_enrichment_task(card_id: str, repo: EnrichmentRepository, service: EnrichmentService):
    try:
        # 1. Load the card by card_id
        card = repo.get_card_by_id(card_id)
        if not card:
            logger.error(f"Enrichment background task failed: Card {card_id} not found.")
            return

        websites = card.get("websites") or []
        company_name = card.get("company")
        
        # Check if neither is available
        if not company_name and not websites:
            logger.info(f"Skipping enrichment for Card {card_id}: neither name nor website available.")
            return

        primary_website = websites[0].strip() if websites and len(websites) > 0 and websites[0] else None

        # 2. Run deduplication check
        existing_company = repo.find_existing_company(websites, company_name)
        
        if existing_company:
            company_id = existing_company["id"]
            # If the matched company completed successfully, we reuse it and return
            if existing_company.get("enrichment_status") == "completed":
                logger.info(f"Deduplication match found. Reusing completed company {company_id}")
                repo.link_card_to_company(card_id, company_id)
                return
            
            # If matched company is failed (or pending), we retry enrichment
            logger.info(f"Deduplication match found. Reusing company {company_id} but status is {existing_company.get('enrichment_status')}. Retrying enrichment.")
            repo.link_card_to_company(card_id, company_id)
            # Update status back to pending to allow retry
            repo.supabase.table("companies").update({"enrichment_status": "pending", "enrichment_error": None}).eq("id", company_id).execute()
        else:
            # 4. If new: insert companies row (status: pending), link card → company
            company = repo.create_pending_company(company_name, primary_website)
            company_id = company["id"]
            repo.link_card_to_company(card_id, company_id)
        
        # 5. Call Gemini
        try:
            result = service.enrich_company(primary_website, company_name)
            # 6. On success: update companies row with all extracted fields, set status: 'completed'
            repo.update_company_success(company_id, result, result)
            logger.info(f"Enrichment completed successfully for company {company_id}")
        except Exception as e:
            # 7. On failure: set status: 'failed', store error message in enrichment_error
            error_msg = str(e)
            logger.error(f"Enrichment failed for company {company_id}: {error_msg}")
            repo.update_company_failure(company_id, error_msg)
            
    except Exception as e:
        logger.error(f"Enrichment background task crashed for Card {card_id}: {e}", exc_info=True)


@router.post("/enrich", status_code=status.HTTP_202_ACCEPTED)
def enrich_card(
    payload: EnrichmentRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    repo: EnrichmentRepository = Depends(get_enrichment_repo),
    service: EnrichmentService = Depends(get_enrichment_service)
):
    # Verify card exists and belongs to user (or exists)
    card = repo.get_card_by_id(payload.card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
        
    # Queue background task
    background_tasks.add_task(run_enrichment_task, payload.card_id, repo, service)
    return {"message": "Enrichment queued"}


@router.get("/status/{card_id}", response_model=EnrichmentStatusResponse)
def get_enrichment_status(
    card_id: str,
    current_user: dict = Depends(get_current_user),
    repo: EnrichmentRepository = Depends(get_enrichment_repo)
):
    card = repo.get_card_by_id(card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
        
    company_id = card.get("company_id")
    if not company_id:
        return EnrichmentStatusResponse(status="pending", company_id=None)
        
    company = repo.get_company_by_id(company_id)
    if not company:
        return EnrichmentStatusResponse(status="pending", company_id=None)
        
    return EnrichmentStatusResponse(
        status=company.get("enrichment_status", "pending"),
        company_id=company_id
    )


@router.get("/company/{company_id}", response_model=CompanyDetailResponse)
def get_company_detail(
    company_id: str,
    current_user: dict = Depends(get_current_user),
    repo: EnrichmentRepository = Depends(get_enrichment_repo)
):
    company = repo.get_company_by_id(company_id)
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
        
    # Query for any card linked to this company to get card_id as a fallback
    card_res = repo.supabase.table("business_cards").select("id").eq("company_id", company_id).limit(1).execute()
    card_id = card_res.data[0]["id"] if card_res.data else None
    
    # Inject card_id into the response dict
    company_dict = dict(company)
    company_dict["card_id"] = card_id
    
    return CompanyDetailResponse(**company_dict)
