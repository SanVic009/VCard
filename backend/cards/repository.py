from supabase import Client
from fastapi import HTTPException, status
from .schemas import CardCreate, CardUpdate, CardResponse

class CardRepository:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    def create_card(self, user_id: str, data: CardCreate) -> CardResponse:
        # Exclude unset fields so we don't overwrite defaults
        insert_data = data.model_dump(exclude_unset=True)
        # Inject user_id server-side
        insert_data["user_id"] = user_id
        
        response = self.supabase.table("business_cards").insert(insert_data).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create card")
        return CardResponse(**response.data[0])

    def get_cards(self, user_id: str, search: str | None = None) -> list[CardResponse]:
        # Filter by user_id explicitly for defense in depth
        query = self.supabase.table("business_cards")\
            .select("*")\
            .eq("user_id", user_id)
        
        if search:
            query = query.or_(f"name.ilike.%{search}%,company.ilike.%{search}%")
            
        response = query.order("created_at", desc=True).execute()
        return [CardResponse(**card) for card in response.data]

    def get_card(self, user_id: str, card_id: str) -> CardResponse:
        response = self.supabase.table("business_cards")\
            .select("*")\
            .eq("id", card_id)\
            .eq("user_id", user_id)\
            .execute()
            
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
            
        return CardResponse(**response.data[0])

    def update_card(self, user_id: str, card_id: str, data: CardUpdate) -> CardResponse:
        # Partial update: exclude None fields
        update_data = data.model_dump(exclude_none=True)
        if not update_data:
            # Nothing to update, return the existing card
            return self.get_card(user_id, card_id)
            
        response = self.supabase.table("business_cards")\
            .update(update_data)\
            .eq("id", card_id)\
            .eq("user_id", user_id)\
            .execute()
            
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
            
        return CardResponse(**response.data[0])

    def delete_card(self, user_id: str, card_id: str) -> None:
        response = self.supabase.table("business_cards")\
            .delete()\
            .eq("id", card_id)\
            .eq("user_id", user_id)\
            .execute()
            
        if not response.data:
            # Deletion returned no rows, meaning it wasn't found or unauthorized
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
