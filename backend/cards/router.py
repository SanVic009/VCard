from fastapi import APIRouter, Depends, status
from supabase import Client
from .schemas import CardCreate, CardUpdate, CardResponse, CardListResponse
from .repository import CardRepository
from auth.dependencies import get_current_user, get_supabase

router = APIRouter(prefix="/cards", tags=["cards"])

def get_card_repo(supabase: Client = Depends(get_supabase)) -> CardRepository:
    # Uses the service role client explicitly passed from auth/dependencies
    return CardRepository(supabase)

@router.post("", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
def create_card(
    data: CardCreate,
    current_user: dict = Depends(get_current_user),
    repo: CardRepository = Depends(get_card_repo)
):
    user_id = current_user.get("id")
    return repo.create_card(user_id, data)

@router.get("", response_model=CardListResponse)
def get_cards(
    search: str | None = None,
    current_user: dict = Depends(get_current_user),
    repo: CardRepository = Depends(get_card_repo)
):
    user_id = current_user.get("id")
    cards = repo.get_cards(user_id, search=search)
    return CardListResponse(cards=cards, total=len(cards))

@router.get("/{card_id}", response_model=CardResponse)
def get_card(
    card_id: str,
    current_user: dict = Depends(get_current_user),
    repo: CardRepository = Depends(get_card_repo)
):
    user_id = current_user.get("id")
    return repo.get_card(user_id, card_id)

@router.patch("/{card_id}", response_model=CardResponse)
def update_card(
    card_id: str,
    data: CardUpdate,
    current_user: dict = Depends(get_current_user),
    repo: CardRepository = Depends(get_card_repo)
):
    user_id = current_user.get("id")
    return repo.update_card(user_id, card_id, data)

@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(
    card_id: str,
    current_user: dict = Depends(get_current_user),
    repo: CardRepository = Depends(get_card_repo)
):
    user_id = current_user.get("id")
    repo.delete_card(user_id, card_id)
