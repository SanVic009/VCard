import logging
from fastapi import APIRouter, Depends, BackgroundTasks, status, HTTPException
from supabase import Client
from auth.dependencies import get_current_user, get_supabase
from database import USE_LOCAL_AUTH
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
    from sqlalchemy import func
    db = None
    job_id = None
    try:
        # 1. Load the card by card_id
        card = None
        user_id = None
        
        if USE_LOCAL_AUTH:
            from database import SessionLocal
            from models import BusinessCard, EnrichmentJob
            db = SessionLocal()
            card_obj = db.query(BusinessCard).filter(BusinessCard.id == card_id).first()
            if card_obj:
                card = {
                    "id": str(card_obj.id),
                    "user_id": str(card_obj.user_id),
                    "company": card_obj.company,
                    "websites": card_obj.websites,
                    "company_id": str(card_obj.company_id) if card_obj.company_id else None
                }
                user_id = str(card_obj.user_id)
        else:
            card = repo.get_card_by_id(card_id)
            if card:
                user_id = card.get("user_id")

        if not card:
            logger.error(f"Enrichment background task failed: Card {card_id} not found.")
            return

        if not user_id:
            logger.error(f"Enrichment background task failed: User ID not found on Card {card_id}")
            return

        # 2. Before calling Gemini: insert enrichment_jobs row with status 'pending'
        if USE_LOCAL_AUTH:
            try:
                job = EnrichmentJob(
                    card_id=card_id,
                    user_id=user_id,
                    status="pending",
                    attempts=0
                )
                db.add(job)
                db.commit()
                db.refresh(job)
                job_id = job.id
            except Exception as e:
                logger.error(f"Failed to insert enrichment job locally: {e}")
        else:
            try:
                job_data = {
                    "card_id": card_id,
                    "user_id": user_id,
                    "status": "pending",
                    "attempts": 0
                }
                job_res = repo.supabase.table("enrichment_jobs").insert(job_data).execute()
                if job_res.data:
                    job_id = job_res.data[0]["id"]
            except Exception as e:
                logger.error(f"Failed to insert enrichment job in Supabase: {e}")

        websites = card.get("websites") or []
        company_name = card.get("company")
        
        # Check if neither is available
        if not company_name and not websites:
            logger.info(f"Skipping enrichment for Card {card_id}: neither name nor website available.")
            if job_id:
                if USE_LOCAL_AUTH:
                    try:
                        db.query(EnrichmentJob).filter(EnrichmentJob.id == job_id).update({
                            "status": "skipped",
                            "skipped_reason": "neither name nor website available"
                        })
                        db.commit()
                    except Exception as e:
                        logger.error(f"Failed to update skipped status locally: {e}")
                else:
                    try:
                        repo.supabase.table("enrichment_jobs").update({
                            "status": "skipped",
                            "skipped_reason": "neither name nor website available"
                        }).eq("id", job_id).execute()
                    except Exception as e:
                        logger.error(f"Failed to update skipped status in Supabase: {e}")
            return

        primary_website = websites[0].strip() if websites and len(websites) > 0 and websites[0] else None

        # 3. Run deduplication check
        existing_company = None
        if not USE_LOCAL_AUTH:
            existing_company = repo.find_existing_company(websites, company_name)
        else:
            from models import Company
            if company_name:
                comp_obj = db.query(Company).filter(func.lower(Company.name) == company_name.lower()).first()
                if comp_obj:
                    existing_company = {"id": str(comp_obj.id)}
            if not existing_company and primary_website:
                comp_obj = db.query(Company).filter(func.lower(Company.website) == primary_website.lower()).first()
                if comp_obj:
                    existing_company = {"id": str(comp_obj.id)}
        
        if existing_company:
            company_id = existing_company["id"]
            logger.info(f"Deduplication match found. Reusing existing company {company_id} and skipping search.")
            if USE_LOCAL_AUTH:
                try:
                    db.query(BusinessCard).filter(BusinessCard.id == card_id).update({
                        "company_id": company_id
                    })
                    db.query(EnrichmentJob).filter(EnrichmentJob.id == job_id).update({
                        "status": "skipped",
                        "company_id": company_id,
                        "skipped_reason": "company already enriched"
                    })
                    db.commit()
                except Exception as e:
                    logger.error(f"Failed to link card and skip job locally: {e}")
            else:
                repo.link_card_to_company(card_id, company_id)
                if job_id:
                    try:
                        repo.supabase.table("enrichment_jobs").update({
                            "status": "skipped",
                            "company_id": company_id,
                            "skipped_reason": "company already enriched"
                        }).eq("id", job_id).execute()
                    except Exception as e:
                        logger.error(f"Failed to update skipped status in Supabase: {e}")
            return
        
        # 4. If new: create pending company
        company_id = None
        if USE_LOCAL_AUTH:
            try:
                from models import Company
                new_comp = Company(
                    name=company_name,
                    website=primary_website,
                    enrichment_status="pending",
                    products=[],
                    services=[],
                    technologies=[]
                )
                db.add(new_comp)
                db.commit()
                db.refresh(new_comp)
                company_id = str(new_comp.id)
                db.query(BusinessCard).filter(BusinessCard.id == card_id).update({
                    "company_id": company_id
                })
                db.commit()
            except Exception as e:
                logger.error(f"Failed to create pending company locally: {e}")
        else:
            company = repo.create_pending_company(company_name, primary_website)
            company_id = company["id"]
            repo.link_card_to_company(card_id, company_id)
            
        # Define attempt increment callback
        def on_attempt():
            if job_id:
                if USE_LOCAL_AUTH:
                    try:
                        db.query(EnrichmentJob).filter(EnrichmentJob.id == job_id).update({
                            "attempts": EnrichmentJob.attempts + 1
                        })
                        db.commit()
                    except Exception as e:
                        logger.error(f"Failed to increment attempts locally: {e}")
                else:
                    try:
                        repo.supabase.rpc("increment_enrichment_attempts", {"job_id": job_id}).execute()
                    except Exception as e:
                        logger.error(f"Failed to increment attempts in Supabase: {e}")

        # 5. Call Gemini
        try:
            result = service.enrich_company(primary_website, company_name, on_attempt=on_attempt)
            
            # 6. On success: update companies row and set status: 'completed'
            if USE_LOCAL_AUTH:
                try:
                    from models import Company
                    db.query(Company).filter(Company.id == company_id).update({
                        "name": result.get("company_name") or company_name,
                        "website": result.get("website") or primary_website,
                        "location": result.get("location"),
                        "products": result.get("products") or [],
                        "services": result.get("services") or [],
                        "technologies": result.get("technologies") or [],
                        "raw_data": result,
                        "enrichment_status": "completed",
                        "enrichment_error": None
                    })
                    db.query(EnrichmentJob).filter(EnrichmentJob.id == job_id).update({
                        "status": "completed",
                        "company_id": company_id,
                        "raw_response": result
                    })
                    db.commit()
                except Exception as e:
                    logger.error(f"Failed to save success results locally: {e}")
            else:
                repo.update_company_success(company_id, result, result)
                if job_id:
                    try:
                        repo.supabase.table("enrichment_jobs").update({
                            "status": "completed",
                            "company_id": company_id,
                            "raw_response": result
                        }).eq("id", job_id).execute()
                    except Exception as e:
                        logger.error(f"Failed to update success job status in Supabase: {e}")
            logger.info(f"Enrichment completed successfully for company {company_id}")
            
        except Exception as e:
            # 7. On failure: set status: 'failed', store error message in enrichment_error
            error_msg = str(e)
            logger.error(f"Enrichment failed for company {company_id}: {error_msg}")
            
            if USE_LOCAL_AUTH:
                try:
                    from models import Company
                    db.query(Company).filter(Company.id == company_id).update({
                        "enrichment_status": "failed",
                        "enrichment_error": error_msg
                    })
                    db.query(EnrichmentJob).filter(EnrichmentJob.id == job_id).update({
                        "status": "failed",
                        "company_id": company_id,
                        "last_error": error_msg
                    })
                    db.commit()
                except Exception as local_err:
                    logger.error(f"Failed to save failure results locally: {local_err}")
            else:
                repo.update_company_failure(company_id, error_msg)
                if job_id:
                    try:
                        repo.supabase.table("enrichment_jobs").update({
                            "status": "failed",
                            "company_id": company_id,
                            "last_error": error_msg
                        }).eq("id", job_id).execute()
                    except Exception as pg_err:
                        logger.error(f"Failed to update failed job status in Supabase: {pg_err}")
            
    except Exception as e:
        logger.error(f"Enrichment background task crashed for Card {card_id}: {e}", exc_info=True)
    finally:
        if USE_LOCAL_AUTH and db:
            db.close()


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
