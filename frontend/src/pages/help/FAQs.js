import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Paper,
  Container,
  Button,
  Link,
  Tab,
  Tabs,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PageHeader from '../../components/common/PageHeader';

const FAQs = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // FAQ item component for consistent styling
  const FAQItem = ({ question, answer }) => (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1" fontWeight="medium">{question}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography 
          variant="body1" 
          sx={{ 
            whiteSpace: 'pre-line',
            '& ul, & ol': {
              marginTop: '0.5rem',
              paddingLeft: '1.5rem',
            },
            '& li': {
              marginBottom: '0.5rem',
            }
          }}
        >
          {answer}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );

  return (
    <Box>
      <PageHeader 
        title="Frequently Asked Questions" 
        breadcrumbs={[
          { text: 'Dashboard', link: '/' },
          { text: 'FAQs' },
        ]}
      />

      <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Welcome to Acta AI Help Center
          </Typography>
          <Typography variant="body1" paragraph>
            This guide will help you understand how Acta AI works and how to get the most out of it. 
            Whether you're new to AI content generation or just new to our platform, you'll find answers to common questions here.
          </Typography>

          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="FAQ categories">
              <Tab label="Getting Started" />
              <Tab label="Prompt Templates" />
              <Tab label="Variables" />
              <Tab label="Schedules" />
              <Tab label="WordPress Sites" />
              <Tab label="Troubleshooting" />
            </Tabs>
          </Box>

          {/* Getting Started */}
          {tabValue === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>Getting Started with Acta AI</Typography>
              
              <FAQItem 
                question="What is Acta AI?" 
                answer="Acta AI is an automated content generation platform that uses artificial intelligence to create high-quality blog posts and articles. It helps you maintain a consistent publishing schedule by automating content creation and publishing directly to your WordPress website.

The platform allows you to create customizable templates that guide the AI in generating content specific to your needs. You can schedule content generation and publishing to keep your blog fresh with minimal manual effort."
              />
              
              <FAQItem 
                question="How do I get started with Acta AI?" 
                answer="Getting started with Acta AI is simple:

1. Log in to your Acta AI dashboard
2. Connect your WordPress site(s) using the WordPress Sites section
3. Create prompt templates that will guide the AI in generating content
4. Set up publishing schedules to automate your content generation
5. Monitor and manage your content from the dashboard

We recommend starting with our pre-built templates to get familiar with the system before creating your own custom templates."
              />
              
              <FAQItem 
                question="What can I create with Acta AI?" 
                answer="With Acta AI, you can create various types of content including:

- Blog posts and articles
- Product descriptions
- How-to guides and tutorials
- Listicles
- Industry news and analysis
- FAQ content
- Educational content

The content is generated based on your prompt templates and can be customized to match your brand voice, style, and specific requirements."
              />
              
              <FAQItem 
                question="Do I need technical knowledge to use Acta AI?" 
                answer="No, Acta AI is designed to be user-friendly for non-technical users. The interface is intuitive, and most actions can be completed with simple point-and-click operations. 

While having some basic understanding of WordPress and content marketing concepts is helpful, no coding or AI expertise is required to use the platform effectively."
              />
              
              <FAQItem 
                question="How does the AI know what to write about?" 
                answer="The AI knows what to write based on the prompt templates you create. These templates contain instructions that guide the AI on:

- The topic to write about
- The tone and style to use
- The structure of the content
- Specific requirements or constraints

You can either specify exact topics or let the AI generate topic ideas based on your guidelines. The more specific your templates are, the more tailored the content will be to your needs."
              />
            </Box>
          )}

          {/* Prompt Templates */}
          {tabValue === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>Understanding Prompt Templates</Typography>
              
              <FAQItem 
                question="What is a prompt template?" 
                answer="A prompt template is a pre-designed set of instructions that guides the AI in generating content. Think of it as a recipe that tells the AI exactly what kind of content to create and how to create it.

Prompt templates in Acta AI consist of several components:

- System Prompt: Sets the overall context and behavior for the AI
- Topic Generation Prompt: Helps the AI generate relevant topics (if you don't specify one)
- Content Generation Prompt: Guides the AI in creating the actual content
- Variables: Customizable elements that can be changed for each use

Templates ensure consistency across your content while allowing for customization through variables."
              />
              
              <FAQItem 
                question="How do I create a good prompt template?" 
                answer="Creating an effective prompt template involves the following steps:

1. Define your content goals clearly
2. Specify the tone, style, and voice you want the AI to use
3. Provide clear instructions about content structure
4. Include details about the target audience
5. Add variables for elements you want to customize each time
6. Be specific about what to include and what to avoid
7. Test and refine based on the results

Start with one of our sample templates and modify it to match your needs. This is often easier than starting from scratch."
              />
              
              <FAQItem 
                question="What's the difference between the different types of prompts?" 
                answer="Acta AI uses three different types of prompts in each template:

1. System Prompt: This sets the overall behavior, expertise, and tone of the AI. It's like defining the 'character' of the writer, such as 'You are an expert content writer specializing in healthcare with 15+ years of experience.'

2. Topic Generation Prompt: This guides the AI in coming up with relevant topics if you don't specify one. For example, 'Generate 5 blog post topics about {industry} that would interest {target_audience}.'

3. Content Generation Prompt: This gives specific instructions for creating the actual content, including structure, word count, and special requirements. For example, 'Write a {word_count}-word blog post about {topic} in a {tone} tone.'

Each serves a different purpose in guiding the AI to produce the best possible content for your needs."
              />
              
              <FAQItem 
                question="Can I edit or duplicate existing templates?" 
                answer="Yes, you can both edit and duplicate templates:

- To edit a template, go to the Prompt Templates section, find the template you want to modify, and click the Edit button
- To duplicate a template, use the Duplicate button on an existing template

Duplicating templates is useful when you want to create variations of an existing template without starting from scratch. This is especially helpful when you want similar templates for different content types or audiences."
              />
              
              <FAQItem 
                question="How specific should my instructions be in the prompts?" 
                answer="The more specific your instructions, the better the AI will understand what you want. However, there's a balance between being specific and being overly restrictive.

Good instructions should include:
- Clear guidance on tone and style
- Content structure (introduction, headings, conclusion, etc.)
- What to include (data, examples, actionable tips, etc.)
- What to avoid (technical jargon, excessive detail, etc.)
- Any special formatting requirements

For example, instead of saying 'Write about dog training,' you might say 'Write a beginner-friendly guide to house training puppies, with step-by-step instructions, common mistakes to avoid, and a troubleshooting section.'"
              />
            </Box>
          )}

          {/* Variables */}
          {tabValue === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>Working with Variables</Typography>
              
              <FAQItem 
                question="What are variables in prompt templates?" 
                answer="Variables are customizable elements in your prompt templates that can be changed each time you use the template. They make your templates flexible and reusable.

For example, instead of creating separate templates for different industries, you can create one template with an {industry} variable that you can change for each use.

Variables appear in curly braces like {this} in your prompt text and are replaced with the actual values when the AI generates content."
              />
              
              <FAQItem 
                question="What types of variables can I create?" 
                answer="Acta AI supports several types of variables:

1. Text: For free-form text input (e.g., topic, industry, product name)
2. Number: For numerical values (e.g., word count, number of items in a list)
3. Select (Dropdown): For choosing one option from a predefined list (e.g., tone, content type)
4. Multi-Select: For choosing multiple options from a list (e.g., content formats, target platforms)
5. Boolean (Yes/No): For simple yes/no choices (e.g., include call-to-action, add references)

Each type helps ensure the input is appropriate for its purpose and provides a better user experience when filling in the variable values."
              />
              
              <FAQItem 
                question="How do I use variables in my templates?" 
                answer="To use variables in your templates:

1. Create variables in the Variables section when editing a template
2. Insert the variables into your prompt text using the variable key surrounded by curly braces, like {variable_key}
3. When generating content, you'll be prompted to provide values for each variable

For example, if you create a variable with the key 'industry', you can use it in your prompts like this: 'Write a blog post for the {industry} industry that addresses common challenges.'

When you use the template, you'll be asked to specify the industry (e.g., 'healthcare', 'finance', 'education'), and the AI will use that value in the content generation."
              />
              
              <FAQItem 
                question="What are some common variables to include?" 
                answer="Commonly useful variables include:

- topic: The main subject of the content
- industry: The industry or niche for the content
- word_count: The desired length of the content
- tone: The writing style (professional, casual, persuasive, etc.)
- target_audience: The intended readers of the content
- content_type: The format (blog post, how-to guide, listicle, etc.)
- key_points: Specific points to cover in the content
- include_examples: Whether to include examples (boolean)
- include_statistics: Whether to include statistics (boolean)

Start with these basic variables and add more specific ones as needed for your particular content needs."
              />
              
              <FAQItem 
                question="Can I set default values for variables?" 
                answer="Yes, you can and should set default values for your variables. Default values serve two important purposes:

1. They provide examples of what kind of input is expected
2. They save time when the default is commonly used

For instance, you might set a default word count of 1500, a default tone of 'professional', or a default target audience of 'small business owners'.

Users can always change these values when using the template, but having sensible defaults makes the process more efficient."
              />
            </Box>
          )}

          {/* Schedules */}
          {tabValue === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>Content Scheduling</Typography>
              
              <FAQItem 
                question="How do publishing schedules work?" 
                answer="Publishing schedules automate the content creation and publishing process. Here's how they work:

1. You create a schedule specifying:
   - Which WordPress site to publish to
   - Which prompt template to use
   - How often to publish (frequency)
   - What time to publish
   - Any specific variables for the content

2. At the scheduled time, Acta AI will:
   - Generate a topic (if not specified)
   - Create content using the prompt template
   - Publish the content to your WordPress site
   - Log the activity in your dashboard

This automation ensures your blog stays regularly updated without manual intervention."
              />
              
              <FAQItem 
                question="Can I review content before it's published?" 
                answer="Yes, you can set up schedules with a review step. You have two options:

1. Auto-publish: Content is automatically generated and published without review
2. Draft mode: Content is generated but saved as a draft for your review before publishing

If you're new to using Acta AI, we recommend starting with the draft mode until you're confident in the quality of the generated content. Once you're satisfied with the results, you can switch to auto-publish for full automation."
              />
              
              <FAQItem 
                question="How far in advance can I schedule content?" 
                answer="You can schedule content as far in advance as you need. The system supports:

- One-time scheduled posts for specific dates
- Recurring schedules (daily, weekly, monthly)
- Custom interval schedules

For example, you might set up:
- A weekly schedule for industry news every Monday
- A monthly schedule for in-depth guides on the first of each month
- A daily schedule for short tips or updates

There's no limit to how many schedules you can create or how far in advance you can plan."
              />
              
              <FAQItem 
                question="Can I pause or delete a schedule?" 
                answer="Yes, you have full control over your schedules:

- Pause: Temporarily stop a schedule without deleting it
- Resume: Restart a paused schedule
- Edit: Modify the parameters of an existing schedule
- Delete: Permanently remove a schedule

This flexibility allows you to adjust your content strategy as needed without losing your configuration settings."
              />
              
              <FAQItem 
                question="How do I track what's been published?" 
                answer="Acta AI provides several ways to track your published content:

1. Dashboard overview: See recent publications and upcoming scheduled content
2. Activity log: View a detailed history of all content generation and publishing actions
3. Schedule reports: Access performance metrics for each publishing schedule
4. WordPress integration: All published content is also visible in your WordPress dashboard

These tracking features help you monitor your content calendar and ensure everything is working as expected."
              />
            </Box>
          )}

          {/* WordPress Sites */}
          {tabValue === 4 && (
            <Box>
              <Typography variant="h6" gutterBottom>Managing WordPress Sites</Typography>
              
              <FAQItem 
                question="How do I connect my WordPress site to Acta AI?" 
                answer="Connecting your WordPress site to Acta AI is a simple process:

1. Go to the WordPress Sites section in your dashboard
2. Click 'Add New Site'
3. Enter your WordPress site URL
4. Provide your WordPress admin username and password (or API key if you prefer)
5. Test the connection to verify it works
6. Save the site configuration

Once connected, you can start creating schedules to publish content to your site automatically."
              />
              
              <FAQItem 
                question="Is it secure to connect my WordPress site?" 
                answer="Yes, Acta AI prioritizes security when connecting to your WordPress site:

- All credentials are encrypted in transit and at rest
- You can use API keys instead of your admin credentials
- We use secure API connections that only have the permissions needed
- You can revoke access at any time
- Regular security audits ensure best practices are followed

We recommend using a specific user account with Editor privileges (not Administrator) for added security."
              />
              
              <FAQItem 
                question="Can I connect multiple WordPress sites?" 
                answer="Yes, you can connect as many WordPress sites as you need. This is especially useful if you manage multiple blogs or websites for different purposes or clients.

Each connected site appears in your dashboard, and you can create separate publishing schedules for each one. This allows you to maintain a consistent publishing schedule across all your properties with minimal effort."
              />
              
              <FAQItem 
                question="What WordPress settings should I check?" 
                answer="To ensure the best experience with Acta AI, check these WordPress settings:

1. Categories and Tags: Make sure you have categories set up that match your content strategy
2. Media Settings: Configure default image sizes and storage options
3. Permalink Structure: Use SEO-friendly permalinks (e.g., post name)
4. User Permissions: Ensure the connecting user has appropriate permissions
5. API Access: Some security plugins might block API access; whitelist Acta AI if necessary
6. Comment Settings: Configure whether you want comments enabled on AI-generated posts

Having these settings properly configured will help the integration work smoothly."
              />
              
              <FAQItem 
                question="What if my WordPress site has custom fields or special requirements?" 
                answer="Acta AI can work with sites that have custom fields or special requirements:

1. Custom Fields: You can map variables in your templates to custom fields in WordPress
2. Featured Images: The system can generate or select featured images for posts
3. Categories and Tags: You can specify these in your publishing schedules
4. Custom Post Types: If you need to publish to custom post types, contact our support team
5. Special Formatting: Use the content generation prompt to specify special formatting needs

For very specific requirements, our support team can help you configure the system to work with your unique setup."
              />
            </Box>
          )}

          {/* Troubleshooting */}
          {tabValue === 5 && (
            <Box>
              <Typography variant="h6" gutterBottom>Troubleshooting Common Issues</Typography>
              
              <FAQItem 
                question="The content quality isn't what I expected. How can I improve it?" 
                answer="If you're not satisfied with the content quality, try these adjustments:

1. Be more specific in your prompt instructions
2. Use examples to illustrate the style you want
3. Break down complex topics into clearer components
4. Specify what to avoid or include
5. Adjust the tone variable to match your brand voice
6. Review and refine your templates based on results

Remember that the AI learns from your feedback. The more specific your instructions, the better the results will be."
              />
              
              <FAQItem 
                question="My schedule didn't publish as expected. What should I check?" 
                answer="If a scheduled publication didn't work as expected, check these common issues:

1. WordPress Connection: Verify your site connection is still working
2. Schedule Status: Confirm the schedule is active (not paused)
3. Time Zone Settings: Ensure your time zone settings are correct
4. Template Errors: Check if there are any errors in the prompt template
5. Variable Values: Make sure all required variables have valid values
6. WordPress Status: Verify your WordPress site is accessible
7. Logs: Check the activity logs for specific error messages

Most publishing issues can be resolved by addressing one of these factors."
              />
              
              <FAQItem 
                question="How can I make the AI content more unique and less generic?" 
                answer="To make AI-generated content more unique and less generic:

1. Use specific instructions about your brand voice and style
2. Include unique perspectives or approaches in your prompts
3. Specify industry-specific terminology to use
4. Include variables for unique aspects of each piece
5. Request personal anecdotes or case studies that align with your brand
6. Use the system prompt to define a distinctive character or perspective
7. Be specific about what generic content to avoid

Remember: the more unique and specific your instructions, the less generic the output will be."
              />
              
              <FAQItem 
                question="I'm getting error messages. What should I do?" 
                answer="If you encounter error messages:

1. Read the full error message for specific details
2. Check your internet connection
3. Verify that your WordPress site is accessible
4. Ensure API permissions are properly set
5. Try refreshing the page or logging out and back in
6. Check if any variables contain invalid characters
7. Contact support if the issue persists

Most errors include specific information about what went wrong, which can guide you to the solution."
              />
              
              <FAQItem 
                question="How do I get more help if I need it?" 
                answer="If you need additional help:

1. Contact our support team through the Help button in the dashboard
2. Email support@acta-ai.com with specific details about your issue
3. Check our knowledge base for tutorials and guides
4. Join our monthly webinars for tips and best practices
5. Schedule a one-on-one consultation for personalized assistance

Our support team is available to help you get the most out of Acta AI and resolve any issues you encounter."
              />
            </Box>
          )}

          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="textSecondary" paragraph>
              Still have questions? We're here to help!
            </Typography>
            <Button variant="contained" color="primary">
              Contact Support
            </Button>
          </Box>
        </Paper>

        <Typography variant="body2" color="textSecondary" textAlign="center">
          Last updated: {new Date().toLocaleDateString()}
        </Typography>
      </Container>
    </Box>
  );
};

export default FAQs; 