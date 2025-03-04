import requests
import base64
from typing import Dict, List, Optional, Any
import logging

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
            response = requests.get(f"{self.api_url}/wp/v2/users/me", headers=self.headers)
            response.raise_for_status()
            return {"success": True, "data": response.json()}
        except Exception as e:
            logger.error(f"WordPress connection error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_categories(self) -> List[Dict[str, Any]]:
        """Get all categories from WordPress site."""
        try:
            response = requests.get(
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
            response = requests.get(
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
            response = requests.post(
                f"{self.api_url}/wp/v2/posts",
                json=post_data,
                headers=self.headers
            )
            response.raise_for_status()
            return {"success": True, "data": response.json()}
        except Exception as e:
            logger.error(f"Failed to create post: {str(e)}")
            return {"success": False, "error": str(e)} 