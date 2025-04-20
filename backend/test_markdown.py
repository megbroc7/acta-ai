from app.services.content import ContentGenerator

# Create an instance of ContentGenerator
content_generator = ContentGenerator()

# Test content with Markdown headings
test_content = """# Main Heading

This is a paragraph.

## Secondary Heading

- Bullet point 1
- Bullet point 2

### Third level heading
More text here.
"""

# Format content for WordPress
formatted_content = content_generator.format_content_for_wordpress(test_content)

# Print the formatted content
print("Original Content:")
print("-" * 50)
print(test_content)
print("\nFormatted Content for WordPress:")
print("-" * 50)
print(formatted_content) 