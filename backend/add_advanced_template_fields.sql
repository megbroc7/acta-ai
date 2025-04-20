-- Add advanced template fields to the prompt_templates table
ALTER TABLE prompt_templates ADD COLUMN content_type VARCHAR DEFAULT 'blog_post';
ALTER TABLE prompt_templates ADD COLUMN writing_style VARCHAR DEFAULT 'standard';
ALTER TABLE prompt_templates ADD COLUMN industry VARCHAR;
ALTER TABLE prompt_templates ADD COLUMN audience_level VARCHAR DEFAULT 'general';
ALTER TABLE prompt_templates ADD COLUMN special_requirements TEXT; 