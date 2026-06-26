import asyncio
import base64
import json
from dotenv import load_dotenv

load_dotenv()

from extraction.service import process_business_card

async def main():
    image_path = "images/1.jpg"
    
    print(f"Reading image from {image_path}...")
    with open(image_path, "rb") as f:
        image_data = f.read()
        
    image_base64 = base64.b64encode(image_data).decode('utf-8')
    mime_type = "image/jpeg"
    
    print("Calling extraction pipeline...")
    try:
        result = await process_business_card([{"image_base64": image_base64, "mime_type": mime_type}])
        print("Extraction Result:")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Extraction failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
