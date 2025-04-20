from openai import AsyncOpenAI
import asyncio

async def test():
    # IMPORTANT: Replace with your actual OpenAI API key before using
    api_key = 'YOUR_OPENAI_API_KEY_PLACEHOLDER'
    client = AsyncOpenAI(api_key=api_key)
    try:
        print("Attempting to connect to OpenAI API...")
        models = await client.models.list()
        print('Connection succeeded!')
        print(f"Available models: {[model.id for model in models.data]}")
    except Exception as e:
        print(f"Connection failed with error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test()) 