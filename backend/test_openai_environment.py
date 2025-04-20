import os
from openai import AsyncOpenAI
import asyncio
from dotenv import load_dotenv

load_dotenv()

async def test():
    api_key = os.environ.get("OPENAI_API_KEY")
    print(f"API Key from environment: {api_key[:10]}...{api_key[-10:]}")
    
    client = AsyncOpenAI(api_key=api_key)
    try:
        print("Attempting to connect to OpenAI API with env variable...")
        models = await client.models.list()
        print('Connection succeeded!')
        print(f"Available models: {[model.id for model in models.data[:5]]}")
    except Exception as e:
        print(f'Connection error: {str(e)}')

if __name__ == "__main__":
    asyncio.run(test()) 