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
  Breadcrumbs,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EmailIcon from '@mui/icons-material/Email';
import PageHeader from '../../components/common/PageHeader';

const FAQs = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // FAQ item component for consistent styling
  const FAQItem = ({ question, answer }) => (
    <Accordion>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="panel1a-content"
        id="panel1a-header"
      >
        <Typography variant="subtitle1" fontWeight="bold">{question}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography
          variant="body1"
          component="div"
          sx={{ 
            '& ul': { pl: 2, mb: 2 },
            '& li': { mb: 1 },
            '& p': { mb: 2 }
          }}
        >
          {typeof answer === 'string' ? (
            <div dangerouslySetInnerHTML={{ __html: answer.replace(/\n/g, '<br />') }} />
          ) : (
            answer
          )}
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
              <Tab label="General" />
              <Tab label="Features" />
              <Tab label="Templates" />
              <Tab label="Schedules" />
              <Tab label="WordPress" />
              <Tab label="Troubleshooting" />
            </Tabs>
          </Box>

          {/* General */}
          {tabValue === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>General Questions</Typography>
              
              <FAQItem 
                question="What is Acta AI?" 
                answer="Acta AI is an AI-powered content creation platform that helps you generate high-quality blog posts and articles. It helps you maintain a consistent publishing schedule by automating content creation and publishing directly to your WordPress website."
              />
              
              <FAQItem 
                question="Why Acta AI?" 
                answer={`
                  <p><strong>The Historical Significance of Our Name</strong></p>
                  
                  <p>In ancient Rome, the Acta Diurna was the world's first recorded newspaper—a daily journal carved onto stone or metal and displayed in public spaces for all to see. It chronicled everything from political events to military victories, legal proceedings, and even social gossip. It was how Rome kept its citizens informed, a testament to the power of recorded words shaping history.</p>
                  
                  <p>Acta AI carries that tradition into the digital age. Just as the Acta Diurna transformed communication in the ancient world, Acta AI automates and refines content creation, ensuring your words are recorded, published, and impactful. Whether generating blog posts, transcribing ideas, or streamlining information, Acta AI is your modern-day scribe—efficient, intelligent, and tireless.</p>
                  
                  <p>From the stone tablets of Rome to the digital pages of today, the act of writing has always driven progress. Let Acta AI take your words further.</p>
                  
                  <p><strong>Why Choose Acta AI?</strong></p>
                  
                  <p>Acta AI stands out from other AI content tools for several key reasons:</p>
                  
                  <p><strong>Seamless WordPress Integration</strong> - Unlike generic AI writing tools, Acta AI is specifically designed to work with WordPress. It handles the entire publishing process from content creation to scheduling and posting.</p>
                  
                  <p><strong>Complete Automation</strong> - Set up your content schedule once, and Acta AI handles everything else. No need to manually copy-paste content or manage publishing dates.</p>
                  
                  <p><strong>Customizable Templates</strong> - Create templates that match your brand voice and content style. Your content remains consistent and on-brand, even when generated by AI.</p>
                  
                  <p><strong>Variable System</strong> - Our advanced variable system allows you to create dynamic templates that can generate unique content for different topics while maintaining your preferred structure.</p>
                  
                  <p><strong>Time Efficiency</strong> - What would take hours of writing, editing, and publishing can be reduced to minutes of setup time. Focus on strategy while Acta AI handles the execution.</p>
                  
                  <p><strong>Cost-Effective</strong> - Compared to hiring content writers or using multiple separate tools, Acta AI provides an all-in-one solution at a fraction of the cost.</p>
                `}
              />
              
              <FAQItem 
                question="How does Acta AI work?" 
                answer={`
                  Acta AI works in three simple steps:
                  
                  <ol>
                    <li><strong>Connect your WordPress site</strong> - Securely connect Acta AI to your WordPress website</li>
                    <li><strong>Create content templates</strong> - Design templates for different types of content with your preferred structure and style</li>
                    <li><strong>Set up publishing schedules</strong> - Configure when and how often you want content to be published</li>
                  </ol>
                  
                  Acta AI then automatically generates content based on your templates and publishes it according to your schedule. The content includes:
                  
                  <ul>
                    <li>SEO-optimized titles</li>
                    <li>Well-structured body content</li>
                    <li>Relevant images (optional)</li>
                    <li>Meta descriptions</li>
                    <li>FAQ content</li>
                    <li>And more...</li>
                  </ul>
                `}
              />
              
              <FAQItem 
                question="Do I need technical skills to use Acta AI?" 
                answer="While having some basic understanding of WordPress and content marketing concepts is helpful, no coding or AI expertise is required to use the platform effectively."
              />
              
              <FAQItem 
                question="What types of content can I create with Acta AI?" 
                answer={`
                  Acta AI can help you create various types of content, including:
                  
                  <ul>
                    <li>Blog posts</li>
                    <li>How-to guides</li>
                    <li>Listicles</li>
                    <li>Product reviews</li>
                    <li>News articles</li>
                    <li>Educational content</li>
                    <li>Industry updates</li>
                    <li>And more...</li>
                  </ul>
                  
                  The flexibility of the template system allows you to create virtually any type of written content that would typically appear on a blog or website.
                `}
              />
            </Box>
          )}

          {/* Features */}
          {tabValue === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>Features</Typography>
              
              <FAQItem 
                question="What types of content can I create?" 
                answer={`Acta AI can help you create various types of content, including:

- Blog posts
- How-to guides
- Listicles
- Product reviews
- News articles
- Educational content
- Industry updates
- And more...

The flexibility of the template system allows you to create virtually any type of written content that would typically appear on a blog or website.`}
              />
              
              <FAQItem 
                question="How do templates work?" 
                answer={`Templates are the foundation of content creation in Acta AI. They provide structure and guidance for the AI to generate content that matches your requirements.

A template typically includes:
- Instructions for the AI about tone, style, and format
- Variables that can be customized for each use
- Sections that define the structure of the content

You can create multiple templates for different types of content, such as blog posts, product reviews, or how-to guides.`}
              />
            </Box>
          )}

          {/* Templates */}
          {tabValue === 2 && (
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

          {/* WordPress */}
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
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<EmailIcon />}
              sx={{ mt: 2 }}
            >
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