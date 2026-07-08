from supabase import Client
from fastapi import HTTPException, status
from .schemas import CardCreate, CardUpdate, CardResponse
import base64
import logging

logger = logging.getLogger(__name__)

class CardRepository:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    def upload_card_image(self, user_id: str, card_id: str, image_base64: str, side: str) -> str:
        try:
            image_bytes = base64.b64decode(image_base64)
            path = f"{user_id}/{card_id}_{side}.webp"
            self.supabase.storage.from_("business-cards").upload(
                path=path,
                file=image_bytes,
                file_options={"content-type": "image/webp", "upsert": "true"}
            )
            # Return the public URL
            res = self.supabase.storage.from_("business-cards").get_public_url(path)
            return res
        except Exception as e:
            logger.error(f"Failed to upload {side} image for card {card_id}: {e}")
            raise HTTPException(status_code=500, detail="Image upload failed.")

    def delete_card_images(self, user_id: str, card_id: str) -> None:
        try:
            paths = [f"{user_id}/{card_id}_front.webp", f"{user_id}/{card_id}_back.webp"]
            self.supabase.storage.from_("business-cards").remove(paths)
        except Exception as e:
            logger.error(f"Failed to delete images for card {card_id}: {e}")

    def create_card(self, user_id: str, data: CardCreate) -> CardResponse:
        insert_data = data.model_dump(exclude_unset=True)
        insert_data["user_id"] = user_id
        
        # Pop base64 data so it's not inserted into DB directly
        image_front_base64 = insert_data.pop("image_front_base64", None)
        image_back_base64 = insert_data.pop("image_back_base64", None)
        
        # 1. Insert card row first to get the card id
        response = self.supabase.table("business_cards").insert(insert_data).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create card")
            
        card_id = response.data[0]["id"]
        
        # 2 & 3. Upload images if present
        updates = {}
        try:
            if image_front_base64:
                updates["image_url_front"] = self.upload_card_image(user_id, card_id, image_front_base64, "front")
            if image_back_base64:
                updates["image_url_back"] = self.upload_card_image(user_id, card_id, image_back_base64, "back")
        except Exception as e:
            # If upload fails, rollback
            self.supabase.table("business_cards").delete().eq("id", card_id).execute()
            raise e
            
        # 4. Update card row with image URLs if any
        if updates:
            update_response = self.supabase.table("business_cards").update(updates).eq("id", card_id).execute()
            if update_response.data:
                return CardResponse(**update_response.data[0])
                
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
            
        self.delete_card_images(user_id, card_id)
