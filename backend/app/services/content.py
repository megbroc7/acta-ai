import os
import re
import random
import markdown
import logging
from typing import Dict, List, Any, Optional, Tuple
from openai import OpenAI
from ..core.config import settings
from ..models.prompt_template import PromptTemplate
from ..models.blog_schedule import BlogSchedule

logger = logging.getLogger(__name__)

class ContentGenerator:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.client = OpenAI(api_key=self.api_key)

    def pick_random_idea(self, topics: List[str]) -> str:
        """Pick a random idea from the provided topics."""
        return random.choice(topics) if topics else "content creation"

    def prepare_prompt(self, template: str, replacements: Dict[str, Any]) -> str:
        """Replace placeholders in prompt template with actual values."""
        result = template
        for key, value in replacements.items():
            placeholder = f"{{{key}}}"
            if placeholder in result:
                result = result.replace(placeholder, str(value))
        return result

    async def generate_blog_topic(
        self, 
        idea: str, 
        prompt_template: PromptTemplate,
        custom_replacements: Dict[str, Any] = None
    ) -> Tuple[str, str]:
        """
        Generate a blog topic based on the idea.
        Returns the generated topic and the actual prompt used.
        """
        # Build replacements dictionary
        replacements = {}
        if prompt_template.placeholders:
            replacements.update(prompt_template.placeholders)
        if custom_replacements:
            replacements.update(custom_replacements)
        
        replacements["idea"] = idea
        
        # Prepare prompts
        system_prompt = self.prepare_prompt(prompt_template.system_prompt, replacements)
        topic_prompt = self.prepare_prompt(prompt_template.topic_generation_prompt, replacements)
        
        # Generate topic
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": topic_prompt}
                ],
                temperature=0.7
            )
            generated_topic = response.choices[0].message.content.strip()
            return generated_topic, topic_prompt
        except Exception as e:
            logger.error(f"Topic generation error: {str(e)}")
            raise

    async def generate_blog_post(
        self, 
        topic: str, 
        prompt_template: PromptTemplate,
        custom_replacements: Dict[str, Any] = None
    ) -> Tuple[str, str]:
        """
        Generate a full blog post based on the topic.
        Returns the generated content and the actual prompt used.
        """
        # Build replacements dictionary
        replacements = {}
        if prompt_template.placeholders:
            replacements.update(prompt_template.placeholders)
        if custom_replacements:
            replacements.update(custom_replacements)
        
        replacements["topic"] = topic
        replacements["word_count"] = custom_replacements.get("word_count", prompt_template.default_word_count)
        replacements["tone"] = custom_replacements.get("tone", prompt_template.default_tone)
        
        # Prepare prompts
        system_prompt = self.prepare_prompt(prompt_template.system_prompt, replacements)
        content_prompt = self.prepare_prompt(prompt_template.content_generation_prompt, replacements)
        
        # Generate content
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content_prompt}
                ],
                temperature=0.7,
                max_tokens=4000
            )
            generated_content = response.choices[0].message.content.strip()
            return generated_content, content_prompt
        except Exception as e:
            logger.error(f"Content generation error: {str(e)}")
            raise

    def format_content_for_wordpress(
        self, 
        content: str, 
        sign_off: str = None,
        include_styles: bool = False
    ) -> str:
        """Format the content for WordPress with HTML."""
        # Convert markdown to HTML
        content_html = markdown.markdown(content, extensions=['tables'])
        
        # Remove any leading H1 tag to avoid duplicate titles
        content_html = re.sub(r'^<h1>.*?</h1>', '', content_html, flags=re.DOTALL).strip()
        
        # Add custom styles if requested
        if include_styles:
            styles = """
            <style>
            .wp-block-table table {width: 100%; border-collapse: collapse;}
            .wp-block-table td, .wp-block-table th {padding: 8px; border: 1px solid #ddd;}
            .wp-block-table th {background-color: #f2f2f2;}
            blockquote {border-left: 4px solid #ccc; padding-left: 15px; color: #555;}
            </style>
            """
            content_html = f"{styles}\n{content_html}"
        
        # Add sign-off if provided
        if sign_off:
            content_html += f"\n<p>{sign_off}</p>"
            
        return content_html

    def extract_excerpt(self, content: str, max_length: int = 160) -> str:
        """Extract an excerpt from the content for SEO meta description."""
        # Remove HTML tags
        plain_text = re.sub(r'<[^>]+>', '', content)
        
        # Get first paragraph or portion of text
        if len(plain_text) <= max_length:
            return plain_text
        
        # Try to find a sentence break
        excerpt = plain_text[:max_length]
        last_period = excerpt.rfind('.')
        
        if last_period > max_length * 0.5:  # If we found a good break point
            return plain_text[:last_period + 1]
        
        # Otherwise truncate and add ellipsis
        return excerpt.rsplit(' ', 1)[0] + '...' 