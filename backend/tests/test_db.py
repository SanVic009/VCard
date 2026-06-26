import asyncio
from database import engine, Base
from sqlalchemy import text

async def test_db():
    try:
        print("Testing DB connection...")
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Connection successful! Creating tables...")
        Base.metadata.create_all(bind=engine)
        print("Tables created successfully.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_db())
