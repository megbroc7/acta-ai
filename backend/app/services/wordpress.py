import httpx
import base64
from typing import Dict, List, Optional, Any
import logging
import asyncio

logger = logging.getLogger(__name__)

class WordPressService:
    def __init__(self, api_url: str, username: str, app_password: str):
        self.api_url = api_url
        self.username = username
        self.app_password = app_password
        self.auth_token = self._generate_auth_token()
        self.headers = {
            "Authorization": f"Basic {self.auth_token}",
            "Content-Type": "application/json"
        }
    
    def _generate_auth_token(self) -> str:
        """Generate base64 encoded auth token."""
        credentials = f"{self.username}:{self.app_password}"
        return base64.b64encode(credentials.encode()).decode()
    
    async def verify_connection(self) -> Dict[str, Any]:
        """Verify connection to WordPress site."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.api_url}/wp/v2/users/me", headers=self.headers)
                response.raise_for_status()
                return {"success": True, "data": response.json()}
        except Exception as e:
            logger.error(f"WordPress connection error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_categories(self) -> List[Dict[str, Any]]:
        """Get all categories from WordPress site."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.api_url}/wp/v2/categories", 
                    headers=self.headers,
                    params={"per_page": 100}
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to fetch categories: {str(e)}")
            return []
    
    async def get_tags(self) -> List[Dict[str, Any]]:
        """Get all tags from WordPress site."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.api_url}/wp/v2/tags", 
                    headers=self.headers,
                    params={"per_page": 100}
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to fetch tags: {str(e)}")
            return []
    
    async def create_post(self, post_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new blog post on WordPress site."""
        try:
            print(f"DEBUG: Creating WordPress post with title: {post_data.get('title')}")
            print(f"DEBUG: Post status: {post_data.get('status')}")
            
            async with httpx.AsyncClient(timeout=30.0) as client:  # Increased timeout
                print(f"DEBUG: Sending POST request to {self.api_url}/wp/v2/posts")
                response = await client.post(
                    f"{self.api_url}/wp/v2/posts",
                    json=post_data,
                    headers=self.headers
                )
                
                # Check for specific status codes and provide better error messages
                if response.status_code != 201:
                    print(f"DEBUG ERROR: WordPress API returned non-success status code: {response.status_code}")
                    try:
                        error_data = response.json()
                        error_message = error_data.get('message', 'Unknown WordPress API error')
                        print(f"DEBUG ERROR: WordPress API error response: {error_data}")
                    except Exception:
                        error_message = f"WordPress API error (HTTP {response.status_code}): {response.text[:200]}"
                    
                    return {"success": False, "error": error_message, "status_code": response.status_code}
                
                result = response.json()
                print(f"DEBUG: Successfully created WordPress post with ID: {result.get('id')}")
                return {"success": True, "data": result}
        except httpx.TimeoutException:
            error_message = "WordPress API request timed out. The site might be down or experiencing high load."
            print(f"DEBUG ERROR: {error_message}")
            logger.error(error_message)
            return {"success": False, "error": error_message}
        except httpx.HTTPStatusError as e:
            error_message = f"WordPress API HTTP error: {e.response.status_code} - {e.response.reason_phrase}"
            print(f"DEBUG ERROR: {error_message}")
            logger.error(error_message)
            try:
                error_data = e.response.json()
                error_detail = error_data.get('message', 'No additional details')
                error_message = f"{error_message} - {error_detail}"
            except Exception:
                pass
            return {"success": False, "error": error_message}
        except Exception as e:
            error_message = f"Failed to create WordPress post: {str(e)}"
            print(f"DEBUG ERROR: {error_message}")
            logger.error(error_message)
            
            # Provide more helpful error messages based on common failure patterns
            if "401" in str(e):
                error_message = "WordPress authentication failed. Please check username and app password."
            elif "404" in str(e):
                error_message = "WordPress API endpoint not found. Please verify the API URL is correct."
            elif "connection" in str(e).lower():
                error_message = "Could not connect to WordPress site. Please check the site URL and connectivity."
            
            return {"success": False, "error": error_message} 