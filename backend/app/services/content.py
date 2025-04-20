import os
import re
import random
import markdown
import logging
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from openai import AsyncOpenAI
from ..core.config import settings
from ..models.prompt_template import PromptTemplate
from ..models.blog_schedule import BlogSchedule

logger = logging.getLogger(__name__)

class ContentGenerator:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        logger.debug(f"Initializing ContentGenerator with API key: {'[VALID]' if self.api_key else '[MISSING]'}")
        if not self.api_key:
            logger.error("No OpenAI API key provided in environment or constructor")
        
        # Create client with timeout settings
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            timeout=30.0,  # 30 second timeout for all API calls
            max_retries=2  # Retry failed requests up to 2 times
        )

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
        
        # Add advanced template fields to the system prompt
        enhanced_system_prompt = prompt_template.system_prompt
        
        # Enhance system prompt with advanced settings if they exist
        if prompt_template.content_type or prompt_template.writing_style or prompt_template.industry or prompt_template.audience_level:
            enhanced_system_prompt += "\n\nAdditional context:"
            
            if prompt_template.content_type:
                enhanced_system_prompt += f"\n- Content Type: {prompt_template.content_type}"
            
            if prompt_template.writing_style:
                enhanced_system_prompt += f"\n- Writing Style: {prompt_template.writing_style}"
            
            if prompt_template.industry:
                enhanced_system_prompt += f"\n- Industry: {prompt_template.industry}"
            
            if prompt_template.audience_level:
                enhanced_system_prompt += f"\n- Audience Level: {prompt_template.audience_level}"
            
            if prompt_template.special_requirements:
                enhanced_system_prompt += f"\n\nSpecial Requirements:\n{prompt_template.special_requirements}"
        
        # Prepare prompts
        system_prompt = self.prepare_prompt(enhanced_system_prompt, replacements)
        topic_prompt = self.prepare_prompt(prompt_template.topic_generation_prompt, replacements)
        
        # Generate topic
        try:
            print(f"DEBUG: Calling OpenAI API for topic generation with idea: {idea}")
            response = await self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": topic_prompt}
                ],
                temperature=0.7
            )
            generated_topic = response.choices[0].message.content.strip()
            print(f"DEBUG: Successfully generated topic: {generated_topic}")
            
            # Clean up the title if it contains formatting markers
            # Check for "Title:" pattern
            if "Title:" in generated_topic:
                # Extract just the title part
                title_match = re.search(r'Title:\s*"?([^"\n]+)"?', generated_topic)
                if title_match:
                    generated_topic = title_match.group(1).strip()
                    print(f"DEBUG: Cleaned up title from 'Title:' pattern: {generated_topic}")
            
            # If the title has quotes and then a newline, extract just the quoted part
            elif re.search(r'^"[^"]+"\s*\n', generated_topic):
                title_match = re.search(r'^"([^"]+)"', generated_topic)
                if title_match:
                    generated_topic = title_match.group(1).strip()
                    print(f"DEBUG: Cleaned up title from quoted pattern: {generated_topic}")
            
            # If there's a newline, take just the first line as the title
            elif "\n" in generated_topic:
                generated_topic = generated_topic.split("\n")[0].strip()
                # Remove quotes if present
                generated_topic = generated_topic.strip('"')
                print(f"DEBUG: Cleaned up title by taking first line: {generated_topic}")
            
            # Final cleanup to ensure consistent formatting
            # Remove any remaining quotes at beginning and end
            generated_topic = generated_topic.strip('"\'')
            # Remove Markdown heading symbols (# followed by space) from the beginning of titles
            generated_topic = re.sub(r'^#+\s+', '', generated_topic)
            # Normalize spacing (replace multiple spaces with a single space)
            generated_topic = re.sub(r'\s+', ' ', generated_topic)
            print(f"DEBUG: Final cleaned title: {generated_topic}")
            
            return generated_topic, topic_prompt
        except asyncio.TimeoutError:
            error_message = "OpenAI API request timed out after 30 seconds. The service might be experiencing high load."
            print(f"DEBUG ERROR: {error_message}")
            logger.error(error_message)
            raise Exception(error_message)
        except Exception as e:
            error_message = f"Topic generation error: {str(e)}"
            print(f"DEBUG ERROR: {error_message}")
            logger.error(error_message)
            if "MissingGreenlet" in str(e):
                error_message = "OpenAI API call failed: Using synchronous client in async function. Please check ContentGenerator implementation."
            elif "api_key" in str(e).lower():
                error_message = "OpenAI API authentication failed: Invalid API key or no API key provided."
            elif "rate limit" in str(e).lower():
                error_message = "OpenAI API rate limit exceeded. Please try again later."
            elif "timeout" in str(e).lower():
                error_message = "OpenAI API request timed out. The service might be experiencing high load."
            else:
                error_message = f"Failed to generate topic: {str(e)}"
            logger.error(f"Detailed error: {error_message}")
            raise Exception(error_message)

    async def generate_blog_post(
        self, 
        topic: str, 
        prompt_template: PromptTemplate,
        custom_replacements: Dict[str, Any] = None
    ) -> Tuple[str, str]:
        """
        Generate a blog post based on the topic.
        Returns the generated content and the actual prompt used.
        """
        # Build replacements dictionary
        replacements = {}
        if prompt_template.placeholders:
            replacements.update(prompt_template.placeholders)
        if custom_replacements:
            replacements.update(custom_replacements)
        
        replacements["topic"] = topic
        replacements["word_count"] = replacements.get("word_count", prompt_template.default_word_count)
        replacements["tone"] = replacements.get("tone", prompt_template.default_tone)
        
        # Add advanced template fields to the system prompt
        enhanced_system_prompt = prompt_template.system_prompt
        
        # Enhance system prompt with advanced settings if they exist
        if prompt_template.content_type or prompt_template.writing_style or prompt_template.industry or prompt_template.audience_level:
            enhanced_system_prompt += "\n\nAdditional context:"
            
            if prompt_template.content_type:
                enhanced_system_prompt += f"\n- Content Type: {prompt_template.content_type}"
            
            if prompt_template.writing_style:
                enhanced_system_prompt += f"\n- Writing Style: {prompt_template.writing_style}"
            
            if prompt_template.industry:
                enhanced_system_prompt += f"\n- Industry: {prompt_template.industry}"
            
            if prompt_template.audience_level:
                enhanced_system_prompt += f"\n- Audience Level: {prompt_template.audience_level}"
            
            if prompt_template.special_requirements:
                enhanced_system_prompt += f"\n\nSpecial Requirements:\n{prompt_template.special_requirements}"
        
        # Prepare prompts
        system_prompt = self.prepare_prompt(enhanced_system_prompt, replacements)
        content_prompt = self.prepare_prompt(prompt_template.content_generation_prompt, replacements)
        
        # Generate content
        try:
            print(f"DEBUG: Calling OpenAI API for content generation with topic: {topic}")
            response = await self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content_prompt}
                ],
                temperature=0.7,
                max_tokens=4000
            )
            generated_content = response.choices[0].message.content.strip()
            print(f"DEBUG: Successfully generated content of length: {len(generated_content)}")
            return generated_content, content_prompt
        except asyncio.TimeoutError:
            error_message = "OpenAI API request timed out after 30 seconds. The service might be experiencing high load."
            print(f"DEBUG ERROR: {error_message}")
            logger.error(error_message)
            raise Exception(error_message)
        except Exception as e:
            error_message = f"Content generation error: {str(e)}"
            print(f"DEBUG ERROR: {error_message}")
            logger.error(error_message)
            if "MissingGreenlet" in str(e):
                error_message = "OpenAI API call failed: Using synchronous client in async function. Please check ContentGenerator implementation."
            elif "api_key" in str(e).lower():
                error_message = "OpenAI API authentication failed: Invalid API key or no API key provided."
            elif "rate limit" in str(e).lower():
                error_message = "OpenAI API rate limit exceeded. Please try again later."
            elif "timeout" in str(e).lower():
                error_message = "OpenAI API request timed out. The service might be experiencing high load."
            elif "token" in str(e).lower() and "limit" in str(e).lower():
                error_message = "Generated content exceeded token limit. Try reducing the requested word count."
            else:
                error_message = f"Failed to generate content: {str(e)}"
            logger.error(f"Detailed error: {error_message}")
            raise Exception(error_message)

    def format_content_for_wordpress(
        self, 
        content: str, 
        sign_off: str = None,
        include_styles: bool = False
    ) -> str:
        """Format the content for WordPress with HTML."""
        # Pre-process to handle Markdown headings properly
        
        # Strip any leading whitespace first
        content = content.lstrip()
        
        # Check the content before processing
        print(f"DEBUG - Content before Markdown conversion: {content[:100]}...")
            
        # Convert markdown to HTML using Python-Markdown
        # Use the 'extra' extension which adds tables, code highlighting, etc.
        # Also add 'nl2br' to convert newlines to <br> tags
        content_html = markdown.markdown(
            content, 
            extensions=['extra', 'nl2br']
        )
        
        # Debug the HTML output
        print(f"DEBUG - Content after Markdown conversion: {content_html[:100]}...")
        
        # Remove any leading H1 tag to avoid duplicate titles
        # This helps prevent duplicate titles when the content already includes a heading
        content_html = re.sub(r'^<h1>.*?</h1>', '', content_html, flags=re.DOTALL).strip()
        
        # Add custom styles if requested
        if include_styles:
            styles = """
            <style>
            .wp-block-table table {width: 100%; border-collapse: collapse;}
            .wp-block-table td, .wp-block-table th {padding: 8px; border: 1px solid #ddd;}
            </style>
            """
            content_html = styles + content_html
        
        # Add sign-off if provided
        if sign_off:
            content_html += f"\n<p>{sign_off}</p>"
            
        return content_html

    def extract_excerpt(self, content: str, max_length: int = 160) -> str:
        """Extract an excerpt from the content for SEO meta description."""
        # First convert Markdown to HTML
        html_content = markdown.markdown(content, extensions=['extra'])
        
        # Remove HTML tags
        plain_text = re.sub(r'<[^>]+>', '', html_content)
        
        # Remove any remaining Markdown symbols like #
        plain_text = re.sub(r'^#+\s+', '', plain_text)
        
        # Clean up extra whitespace and newlines
        plain_text = re.sub(r'\s+', ' ', plain_text).strip()
        
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