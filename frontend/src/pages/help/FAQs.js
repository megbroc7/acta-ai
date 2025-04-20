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
        sx={{
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          '&.Mui-expanded': {
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
          }
        }}
      >
        <Typography variant="subtitle1" fontWeight="bold">{question}</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ 
        pt: 2.5, 
        pb: 3,
        px: 3.5,
        backgroundColor: 'rgba(0, 0, 0, 0.01)'
      }}>
        <Typography
          variant="body1"
          component="div"
          sx={{ 
            '& ul, & ol': { 
              pl: 3, 
              mb: 2,
              mt: 1,
              '& li': { mb: 1 } 
            },
            '& p': { 
              mb: 1.5,
              mt: 0 
            },
            '& p:last-child': {
              mb: 0
            },
            '& strong': {
              fontWeight: 600
            },
            '& h4': {
              fontSize: '1.1rem',
              fontWeight: 600,
              mt: 2,
              mb: 1
            }
          }}
        >
          {typeof answer === 'string' ? (
            answer.includes('<p>') || answer.includes('<ul>') || answer.includes('<ol>') ? (
              // If it already has HTML formatting, use it directly
              <div dangerouslySetInnerHTML={{ __html: answer.trim() }} />
            ) : (
              // For markdown-style content, properly format with paragraphs
              <div dangerouslySetInnerHTML={{ 
                __html: answer
                  .trim()
                  .split('\n\n')
                  .map(paragraph => {
                    // Handle lists
                    if (paragraph.includes('\n- ')) {
                      const [listTitle, ...rest] = paragraph.split('\n- ');
                      return `${listTitle ? `<p>${listTitle}</p>` : ''}<ul>${rest.map(item => `<li>${item.substring(item.startsWith('- ') ? 2 : 0)}</li>`).join('')}</ul>`;
                    } 
                    // Handle numbered lists
                    else if (/\n\d+\./.test(paragraph)) {
                      const [listTitle, ...rest] = paragraph.split(/\n\d+\./);
                      return `${listTitle ? `<p>${listTitle}</p>` : ''}<ol>${rest.map(item => `<li>${item}</li>`).join('')}</ol>`;
                    }
                    // Regular paragraphs
                    else {
                      return `<p>${paragraph}</p>`;
                    }
                  })
                  .join('') 
              }} />
            )
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
              <Tab label="SEO" />
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
                answer={`<p>Acta AI is an AI-powered content creation platform that helps you generate high-quality blog posts and articles. It helps you maintain a consistent publishing schedule by automating content creation and publishing directly to your WordPress website.</p>`}
              />
              
              <FAQItem 
                question="Why Acta AI?" 
                answer={`<p><strong>The Historical Significance of Our Name</strong></p>
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
<p><strong>Cost-Effective</strong> - Compared to hiring content writers or using multiple separate tools, Acta AI provides an all-in-one solution at a fraction of the cost.</p>`}
              />
              
              <FAQItem 
                question="How does Acta AI work?" 
                answer={`<p>Acta AI works in three simple steps:</p>
                  <ol>
                    <li><strong>Connect your WordPress site</strong> - Securely connect Acta AI to your WordPress website</li>
                    <li><strong>Create content templates</strong> - Design templates for different types of content with your preferred structure and style</li>
                    <li><strong>Set up publishing schedules</strong> - Configure when and how often you want content to be published</li>
                  </ol>
<p>Acta AI then automatically generates content based on your templates and publishes it according to your schedule. The content includes:</p>
                  <ul>
                    <li>SEO-optimized titles</li>
                    <li>Well-structured body content</li>
                    <li>Relevant images (optional)</li>
                    <li>Meta descriptions</li>
                    <li>FAQ content</li>
                    <li>And more...</li>
</ul>`}
              />
              
              <FAQItem 
                question="Do I need technical skills to use Acta AI?" 
                answer={`<p>While having some basic understanding of WordPress and content marketing concepts is helpful, no coding or AI expertise is required to use the platform effectively.</p>`}
              />
              
              <FAQItem 
                question="What types of content can I create with Acta AI?" 
                answer={`<p>Acta AI can help you create various types of content, including:</p>
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
<p>The flexibility of the template system allows you to create virtually any type of written content that would typically appear on a blog or website.</p>`}
              />
            </Box>
          )}

          {/* SEO */}
          {tabValue === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>Search Engine Optimization in 2025</Typography>
              
              <Typography variant="body1" paragraph sx={{ mb: 3 }}>
                Search engine optimization continues to evolve rapidly with AI advancements, updated algorithms, and changing user behaviors. 
                These comprehensive guidelines will help you stay ahead of SEO trends and maintain your content's visibility in 2025 and beyond.
              </Typography>
              
              <FAQItem 
                question="What are the foundational SEO principles for 2025?" 
                answer={`<h4>Core Web Vitals & User Experience</h4>
<p>Google's Core Web Vitals have expanded to become the primary technical ranking factors:</p>
<ul>
  <li><strong>Loading Performance (LCP):</strong> Pages must achieve Largest Contentful Paint under 1.5 seconds (down from 2.5 seconds in previous years)</li>
  <li><strong>Interactivity (FID):</strong> First Input Delay must be under 50ms for optimal ranking potential</li>
  <li><strong>Visual Stability (CLS):</strong> Zero layout shifts during page loading and interaction</li>
  <li><strong>Responsiveness Score:</strong> A comprehensive metric measuring page reaction time across all user interactions</li>
  <li><strong>Memory Usage:</strong> New in 2025, excessive client-side memory consumption can now negatively impact rankings</li>
</ul>

<h4>Mobile-First Indexing 2.0</h4>
<ul>
  <li><strong>Touch Optimization:</strong> All interactive elements must have appropriate sizing and spacing for touch navigation</li>
  <li><strong>Gesture Navigation:</strong> Sites supporting standard mobile gesture patterns receive preference</li>
  <li><strong>Mobile-Specific Features:</strong> Utilizing device capabilities (location, camera, etc.) when contextually appropriate improves rankings</li>
  <li><strong>Performance Thresholds:</strong> Mobile performance now carries 60% weight in rankings vs. desktop at 40%</li>
</ul>

<h4>AI Detection & Content Evaluation</h4>
<ul>
  <li><strong>Sophistication Metrics:</strong> AI-generated content is evaluated on originality, insight depth, and expert-level analysis</li>
  <li><strong>Human Enhancement Signals:</strong> Content showing evidence of human editorial oversight, fact-checking, and expertise enhancement ranks significantly higher</li>
  <li><strong>Mass Production Penalties:</strong> Sites publishing high volumes of AI content without substantial differentiation face automatic downranking</li>
</ul>`}
              />
              
              <FAQItem 
                question="How should content be structured for maximum SEO impact?" 
                answer={`<h4>Content Architecture</h4>
<ul>
  <li><strong>Topical Authority Clusters:</strong> Content must demonstrate comprehensive coverage across related subtopics with proper internal linking</li>
  <li><strong>Semantic Depth Indicators:</strong> Content showing multiple semantic layers (basic information → advanced analysis → expert application) ranks higher</li>
  <li><strong>Information Hierarchy:</strong> Clear organization with proper heading structure (H1→H6) remains crucial, with additional emphasis on semantically related subheadings</li>
</ul>

<h4>Content Enhancement Requirements</h4>
<ul>
  <li><strong>Multimedia Integration:</strong> Content incorporating relevant images, videos, infographics, and interactive elements receives preference</li>
  <li><strong>Data Visualization:</strong> Original research or data presented through accessible visualizations significantly boosts ranking potential</li>
  <li><strong>Interactive Components:</strong> Elements that engage users (calculators, decision trees, configurators) extend session time and improve rankings</li>
</ul>

<h4>User Intent Alignment</h4>
<ul>
  <li><strong>Intent Matching:</strong> Content must precisely address the specific user intent behind search queries</li>
  <li><strong>Intent Depth:</strong> Coverage must extend beyond the immediate query to address related questions and follow-up needs</li>
  <li><strong>Path Optimization:</strong> Content should guide users through a logical journey from initial query to ultimate goal</li>
</ul>

<h4>E-E-A-T Excellence</h4>
<ul>
  <li><strong>Experience Signals:</strong> Content demonstrating first-hand experience with products, services, or topics (through detailed observations, original photography, specific insights not found elsewhere)</li>
  <li><strong>Expertise Verification:</strong> Author credentials, professional background, and domain expertise must be clearly established</li>
  <li><strong>Authority Building:</strong> Site-wide topical authority demonstrated through depth, breadth, and interconnectedness of content</li>
  <li><strong>Trustworthiness Framework:</strong> Transparent methodologies, clear citations, fact-checking processes, and content update policies</li>
</ul>`}
              />
              
              <FAQItem 
                question="What technical SEO elements are critical in 2025?" 
                answer={`<h4>Advanced Schema Implementation</h4>
<p>Structured data has expanded significantly, with these implementations now considered essential:</p>
<ul>
  <li><strong>ContentExperience Schema:</strong> New in 2025, indicates firsthand experience elements in content</li>
  <li><strong>AuthorExpertise Schema:</strong> Documents author credentials and expertise for E-E-A-T signals</li>
  <li><strong>RelatedContent Schema:</strong> Establishes topical relationships between content pieces</li>
  <li><strong>ProductExperience Schema:</strong> For review content, documents actual usage experience</li>
  <li><strong>FactCheck Schema:</strong> Indicates fact-checked claims and verification methodology</li>
  <li><strong>VideoObject Schema:</strong> Essential for all video content with detailed timestamps</li>
</ul>

<h4>Indexing Optimization</h4>
<ul>
  <li><strong>IndexNow Protocol:</strong> Real-time content indexing through direct API notification to search engines</li>
  <li><strong>URL Structure Optimization:</strong> Clear, concise URLs with semantic meaning and proper categorization</li>
  <li><strong>Internal Linking Architecture:</strong> Strategic linking patterns that establish clear content hierarchies and topical clusters</li>
  <li><strong>XML Sitemaps 2.0:</strong> Enhanced sitemaps with content priority indicators and update frequency metadata</li>
</ul>

<h4>Page Experience Optimization</h4>
<ul>
  <li><strong>HTTPS Requirements:</strong> TLS 1.3 with perfect forward secrecy now standard</li>
  <li><strong>Cookie & Storage Policies:</strong> Transparent data storage practices with user consent mechanisms</li>
  <li><strong>Accessibility Compliance:</strong> WCAG 2.2 Level AA compliance now directly impacts rankings</li>
  <li><strong>Privacy Framework:</strong> Clear privacy policies with user data control options prominently displayed</li>
</ul>

<h4>Technical Debt Mitigation</h4>
<ul>
  <li><strong>JavaScript Optimization:</strong> Minimize render-blocking JS with lazy loading for non-critical components</li>
  <li><strong>CSS Efficiency:</strong> Critical CSS inlined with non-essential styles loaded asynchronously</li>
  <li><strong>Image Optimization:</strong> Next-gen formats (WebP, AVIF) with proper sizing, compression, and lazy loading</li>
  <li><strong>Font Delivery:</strong> System font fallbacks with optimized font loading strategies</li>
  <li><strong>Resource Hints:</strong> Strategic use of preload, prefetch, and preconnect directives</li>
</ul>`}
              />
              
              <FAQItem 
                question="How are backlinks and off-site factors evaluated in 2025?" 
                answer={`<h4>Link Quality Assessment</h4>
<ul>
  <li><strong>Relevance Precision:</strong> Links from sites within the exact same topical ecosystem carry significantly more weight</li>
  <li><strong>Authority Transfer:</strong> Contextual links from recognized authorities transfer more ranking power than generic mentions</li>
  <li><strong>Link Velocity Patterns:</strong> Natural acquisition patterns with sustainable growth rather than sudden spikes</li>
  <li><strong>Co-Citation Signals:</strong> Being linked alongside established authorities strengthens topical relevance</li>
</ul>

<h4>Brand Signals</h4>
<ul>
  <li><strong>Brand Entity Recognition:</strong> Search engines identify brand entities through consistent cross-platform signals</li>
  <li><strong>Brand Sentiment Analysis:</strong> Positive brand mentions and sentiment analysis impact rankings</li>
  <li><strong>Brand Search Volume:</strong> Branded search queries indicate popularity and authority</li>
  <li><strong>Social Verification:</strong> Consistent branding across verified social profiles strengthens entity signals</li>
</ul>

<h4>Authority Establishment</h4>
<ul>
  <li><strong>Topic Velocity:</strong> Consistent publication of authoritative content on specific topics builds subject matter expertise</li>
  <li><strong>Citation Analysis:</strong> Being regularly cited by industry publications and academic sources</li>
  <li><strong>Expert Contributions:</strong> Guest contributions, interviews, and quotes in respected industry publications</li>
  <li><strong>Community Engagement:</strong> Active participation in industry discussions, forums, and community platforms</li>
</ul>

<h4>Local SEO Factors</h4>
<ul>
  <li><strong>Google Business Profile Optimization:</strong> Complete, accurate profiles with regular updates and Q&A engagement</li>
  <li><strong>Review Management:</strong> Consistent positive reviews with thoughtful owner responses</li>
  <li><strong>Local Citation Consistency:</strong> NAP (Name, Address, Phone) consistency across all platforms</li>
  <li><strong>Local Content Signals:</strong> Content demonstrating local expertise and community involvement</li>
  <li><strong>Proximity Factors:</strong> Physical location relative to searcher now weighted for relevance rather than simple distance</li>
</ul>`}
              />
              
              <FAQItem 
                question="What emerging SEO trends should we prepare for beyond 2025?" 
                answer={`<h4>AI-Driven Search Evolution</h4>
<ul>
  <li><strong>Multimodal Search:</strong> Optimization for text, voice, image, and video search interfaces simultaneously</li>
  <li><strong>Conversational Search:</strong> Content structured to address multi-turn conversations rather than single queries</li>
  <li><strong>Predictive Intent:</strong> Search engines anticipating user needs before explicit queries</li>
  <li><strong>AI Content Collaboration:</strong> Human-AI collaborative content creation will become the preferred model</li>
</ul>

<h4>Visual & Multimedia Search</h4>
<ul>
  <li><strong>Visual Element Recognition:</strong> All images must have proper alt text, descriptive filenames, and context signals</li>
  <li><strong>Video Content Optimization:</strong> Full transcripts, chapter markers, and semantic timestamps</li>
  <li><strong>Augmented Reality Integration:</strong> AR-compatible content elements for compatible searches</li>
  <li><strong>3D Object Search:</strong> Product and spatial representations for dimensional search</li>
</ul>

<h4>Privacy-First Optimization</h4>
<ul>
  <li><strong>Cookieless Analytics:</strong> First-party data collection strategies for audience insights</li>
  <li><strong>Privacy-Preserving Measurement:</strong> Attribution models that respect user privacy while demonstrating effectiveness</li>
  <li><strong>Contextual Targeting:</strong> Content optimization for contextual relevance rather than user tracking</li>
  <li><strong>Transparent Data Practices:</strong> Clear disclosure of data collection with user control options</li>
</ul>

<h4>Search Ecosystem Diversification</h4>
<ul>
  <li><strong>Vertical Search Optimization:</strong> Specialized strategies for industry-specific search platforms</li>
  <li><strong>Marketplace SEO:</strong> Optimization techniques for Amazon, Etsy, and other e-commerce platforms</li>
  <li><strong>App Store Optimization:</strong> Visibility strategies for mobile and desktop application marketplaces</li>
  <li><strong>Social Search:</strong> Content discovery optimization within social platforms' search functions</li>
</ul>

<p>As search continues to evolve, the fundamental principle remains: creating genuinely valuable content that serves user needs will outperform any tactical approach. The most successful SEO strategies in 2025 and beyond will balance technical excellence with authentic expertise and user-centered design.</p>`}
              />
              
              <FAQItem 
                question="How should we implement SEO strategies with Acta AI?" 
                answer={`<h4>Prompt Template Optimization</h4>
<p>Acta AI can be configured to produce SEO-optimized content through strategic prompt engineering:</p>
<ul>
  <li><strong>Semantic Depth Prompting:</strong> Structure prompts to generate multiple layers of information, from basic concepts to advanced applications</li>
  <li><strong>Topic Clustering:</strong> Create template families that build comprehensive coverage around central topics</li>
  <li><strong>E-E-A-T Enhancement:</strong> Include specific instructions for experience signals, expertise demonstrations, and citation inclusion</li>
  <li><strong>Intent Matching:</strong> Configure prompts to address specific search intents with comprehensive answers</li>
</ul>

<h4>Content Structure Implementation</h4>
<ul>
  <li><strong>Schema-Ready Formatting:</strong> Generate content with proper HTML structure that supports schema implementation</li>
  <li><strong>Natural Segmentation:</strong> Create logical content sections that address different aspects of the topic</li>
  <li><strong>Multimedia Prompting:</strong> Include instructions for image placement, video embeds, and interactive element positioning</li>
  <li><strong>Featured Snippet Formatting:</strong> Structure key information in formats likely to be selected for featured snippets</li>
</ul>

<h4>Workflow Integration</h4>
<ul>
  <li><strong>Research-Based Generation:</strong> Use Acta AI to generate content based on keyword research and competitive analysis</li>
  <li><strong>Update Automation:</strong> Schedule regular content updates to maintain freshness signals</li>
  <li><strong>Content Expansion:</strong> Automatically generate supporting content that builds topical depth</li>
  <li><strong>Internal Linking:</strong> Configure templates to reference and link to existing content in your library</li>
</ul>

<h4>Quality Assurance Process</h4>
<ul>
  <li><strong>Human Review Integration:</strong> Set up a workflow that includes human editorial oversight and expertise enhancement</li>
  <li><strong>Fact Verification:</strong> Implement a process for verifying factual claims in generated content</li>
  <li><strong>Originality Enhancement:</strong> Add unique insights, original research, or proprietary data to differentiate content</li>
  <li><strong>Voice Consistency:</strong> Ensure all generated content maintains a consistent brand voice while addressing SEO requirements</li>
</ul>

<p>By configuring Acta AI with these SEO principles in mind, you can generate content that satisfies both search engines and human readers—creating valuable resources that earn visibility through genuine utility and expertise.</p>`}
              />
            </Box>
          )}

          {/* Features */}
          {tabValue === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>Features</Typography>
              
              <FAQItem 
                question="What types of content can I create?" 
                answer={`<p>Acta AI can help you create various types of content, including:</p>
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
<p>The flexibility of the template system allows you to create virtually any type of written content that would typically appear on a blog or website.</p>`}
              />
              
              <FAQItem 
                question="How do templates work?" 
                answer={`<p>Templates are the foundation of content creation in Acta AI. They provide structure and guidance for the AI to generate content that matches your requirements.</p>
<p>A template typically includes:</p>
<ul>
  <li>Instructions for the AI about tone, style, and format</li>
  <li>Variables that can be customized for each use</li>
  <li>Sections that define the structure of the content</li>
</ul>
<p>You can create multiple templates for different types of content, such as blog posts, product reviews, or how-to guides.</p>`}
              />
              
              <FAQItem 
                question="What are the SEO best practices for 2025?" 
                answer={`<p>Search engine optimization continues to evolve in 2025, with these key best practices to follow:</p>

<h4>Content Quality & User Experience</h4>
<ul>
  <li><strong>AI-generated content quality</strong> - Search engines now evaluate AI content using sophistication metrics. Content that provides unique insights, expert perspective, and comprehensive coverage ranks higher than generic AI text.</li>
  <li><strong>Semantic depth</strong> - Content must demonstrate genuine topic expertise with original research, case studies, or data visualization. Surface-level coverage is penalized.</li>
  <li><strong>Core Web Vitals 2.0</strong> - Load speeds under 1.5 seconds, zero layout shifts, and fully interactive pages are baseline requirements.</li>
</ul>

<h4>Technical SEO Requirements</h4>
<ul>
  <li><strong>Structured data expansion</strong> - Implementing comprehensive schema markup is mandatory, including the new ContentExperience and AuthorExpertise schemas.</li>
  <li><strong>Mobile-first indexing 2.0</strong> - Mobile page experience now carries 60% weight in rankings, including touch-target spacing and gesture navigation metrics.</li>
  <li><strong>Visual search optimization</strong> - All images must include proper alt text, descriptive filenames, and be properly sized for visual search engines.</li>
</ul>

<h4>E-E-A-T Factors</h4>
<ul>
  <li><strong>Experience signals</strong> - Content must demonstrate first-hand experience with products, services, or topics covered.</li>
  <li><strong>Expertise verification</strong> - Author credentials, citations, and expertise indicators carry more weight than ever.</li>
  <li><strong>Authority building</strong> - Topical authority clusters with comprehensive internal linking structure outperform isolated content.</li>
  <li><strong>Trustworthiness signals</strong> - Citations, references, transparency in content creation processes, and clear fact-checking policies are essential.</li>
</ul>

<p>These practices ensure your content not only reaches your target audience but also maintains visibility as search algorithms continue to prioritize authentic, authoritative content over mass-produced AI text.</p>`}
              />
            </Box>
          )}

          {/* Templates */}
          {tabValue === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>Understanding Prompt Templates</Typography>
              
              <FAQItem 
                question="What is a prompt template?" 
                answer={`<p>A prompt template is a pre-designed set of instructions that guides the AI in generating content. Think of it as a recipe that tells the AI exactly what kind of content to create and how to create it.</p>
<p>Prompt templates in Acta AI consist of several components:</p>
<ul>
  <li><strong>System Prompt:</strong> Sets the overall context and behavior for the AI</li>
  <li><strong>Topic Generation Prompt:</strong> Helps the AI generate relevant topics (if you don't specify one)</li>
  <li><strong>Content Generation Prompt:</strong> Guides the AI in creating the actual content</li>
  <li><strong>Variables:</strong> Customizable elements that can be changed for each use</li>
</ul>
<p>Templates ensure consistency across your content while allowing for customization through variables.</p>`}
              />
              
              <FAQItem 
                question="How do I create a good prompt template?" 
                answer={`<p>Creating an effective prompt template involves the following steps:</p>
<ol>
  <li>Define your content goals clearly</li>
  <li>Specify the tone, style, and voice you want the AI to use</li>
  <li>Provide clear instructions about content structure</li>
  <li>Include details about the target audience</li>
  <li>Add variables for elements you want to customize each time</li>
  <li>Be specific about what to include and what to avoid</li>
  <li>Test and refine based on the results</li>
</ol>
<p>Start with one of our sample templates and modify it to match your needs. This is often easier than starting from scratch.</p>`}
              />
              
              <FAQItem 
                question="What's the difference between the different types of prompts?" 
                answer={`<p>Acta AI uses three different types of prompts in each template:</p>
<ol>
  <li><strong>System Prompt:</strong> This sets the overall behavior, expertise, and tone of the AI. It's like defining the 'character' of the writer, such as 'You are an expert content writer specializing in healthcare with 15+ years of experience.'</li>
  <li><strong>Topic Generation Prompt:</strong> This guides the AI in coming up with relevant topics if you don't specify one. For example, 'Generate 5 blog post topics about {industry} that would interest {target_audience}.'</li>
  <li><strong>Content Generation Prompt:</strong> This gives specific instructions for creating the actual content, including structure, word count, and special requirements. For example, 'Write a {word_count}-word blog post about {topic} in a {tone} tone.'</li>
</ol>
<p>Each serves a different purpose in guiding the AI to produce the best possible content for your needs.</p>`}
              />
              
              <FAQItem 
                question="Can I edit or duplicate existing templates?" 
                answer={`<p>Yes, you can both edit and duplicate templates:</p>
<ul>
  <li>To edit a template, go to the Prompt Templates section, find the template you want to modify, and click the Edit button</li>
  <li>To duplicate a template, use the Duplicate button on an existing template</li>
</ul>
<p>Duplicating templates is useful when you want to create variations of an existing template without starting from scratch. This is especially helpful when you want similar templates for different content types or audiences.</p>`}
              />
              
              <FAQItem 
                question="How specific should my instructions be in the prompts?" 
                answer={`<p>The more specific your instructions, the better the AI will understand what you want. However, there's a balance between being specific and being overly restrictive.</p>
<p>Good instructions should include:</p>
<ul>
  <li>Clear guidance on tone and style</li>
  <li>Content structure (introduction, headings, conclusion, etc.)</li>
  <li>What to include (data, examples, actionable tips, etc.)</li>
  <li>What to avoid (technical jargon, excessive detail, etc.)</li>
  <li>Any special formatting requirements</li>
</ul>
<p>For example, instead of saying 'Write about dog training,' you might say 'Write a beginner-friendly guide to house training puppies, with step-by-step instructions, common mistakes to avoid, and a troubleshooting section.'</p>`}
              />
            </Box>
          )}

          {/* Schedules */}
          {tabValue === 4 && (
            <Box>
              <Typography variant="h6" gutterBottom>Content Scheduling</Typography>
              
              <FAQItem 
                question="How do publishing schedules work?" 
                answer={`<p>Publishing schedules automate the content creation and publishing process. Here's how they work:</p>
<ol>
  <li>You create a schedule specifying:
    <ul>
      <li>Which WordPress site to publish to</li>
      <li>Which prompt template to use</li>
      <li>How often to publish (frequency)</li>
      <li>What time to publish</li>
      <li>Any specific variables for the content</li>
    </ul>
  </li>
  <li>At the scheduled time, Acta AI will:
    <ul>
      <li>Generate a topic (if not specified)</li>
      <li>Create content using the prompt template</li>
      <li>Publish the content to your WordPress site</li>
      <li>Log the activity in your dashboard</li>
    </ul>
  </li>
</ol>
<p>This automation ensures your blog stays regularly updated without manual intervention.</p>`}
              />
              
              <FAQItem 
                question="Can I review content before it's published?" 
                answer={`<p>Yes, you can set up schedules with a review step. You have two options:</p>
<ol>
  <li><strong>Auto-publish:</strong> Content is automatically generated and published without review</li>
  <li><strong>Draft mode:</strong> Content is generated but saved as a draft for your review before publishing</li>
</ol>
<p>If you're new to using Acta AI, we recommend starting with the draft mode until you're confident in the quality of the generated content. Once you're satisfied with the results, you can switch to auto-publish for full automation.</p>`}
              />
              
              <FAQItem 
                question="How far in advance can I schedule content?" 
                answer={`<p>You can schedule content as far in advance as you need. The system supports:</p>
<ul>
  <li>One-time scheduled posts for specific dates</li>
  <li>Recurring schedules (daily, weekly, monthly)</li>
  <li>Custom interval schedules</li>
</ul>
<p>For example, you might set up:</p>
<ul>
  <li>A weekly schedule for industry news every Monday</li>
  <li>A monthly schedule for in-depth guides on the first of each month</li>
  <li>A daily schedule for short tips or updates</li>
</ul>
<p>There's no limit to how many schedules you can create or how far in advance you can plan.</p>`}
              />
              
              <FAQItem 
                question="Can I pause or delete a schedule?" 
                answer={`<p>Yes, you have full control over your schedules:</p>
<ul>
  <li><strong>Pause:</strong> Temporarily stop a schedule without deleting it</li>
  <li><strong>Resume:</strong> Restart a paused schedule</li>
  <li><strong>Edit:</strong> Modify the parameters of an existing schedule</li>
  <li><strong>Delete:</strong> Permanently remove a schedule</li>
</ul>
<p>This flexibility allows you to adjust your content strategy as needed without losing your configuration settings.</p>`}
              />
              
              <FAQItem 
                question="How do I track what's been published?" 
                answer={`<p>Acta AI provides several ways to track your published content:</p>
<ol>
  <li><strong>Dashboard overview:</strong> See recent publications and upcoming scheduled content</li>
  <li><strong>Activity log:</strong> View a detailed history of all content generation and publishing actions</li>
  <li><strong>Schedule reports:</strong> Access performance metrics for each publishing schedule</li>
  <li><strong>WordPress integration:</strong> All published content is also visible in your WordPress dashboard</li>
</ol>
<p>These tracking features help you monitor your content calendar and ensure everything is working as expected.</p>`}
              />
            </Box>
          )}

          {/* WordPress */}
          {tabValue === 5 && (
            <Box>
              <Typography variant="h6" gutterBottom>Managing WordPress Sites</Typography>
              
              <FAQItem 
                question="How do I connect my WordPress site to Acta AI?" 
                answer={`<p>Connecting your WordPress site to Acta AI is a simple process:</p>
<ol>
  <li>Go to the WordPress Sites section in your dashboard</li>
  <li>Click 'Add New Site'</li>
  <li>Enter your WordPress site URL</li>
  <li>Provide your WordPress admin username and password (or API key if you prefer)</li>
  <li>Test the connection to verify it works</li>
  <li>Save the site configuration</li>
</ol>
<p>Once connected, you can start creating schedules to publish content to your site automatically.</p>`}
              />
              
              <FAQItem 
                question="Is it secure to connect my WordPress site?" 
                answer={`<p>Yes, Acta AI prioritizes security when connecting to your WordPress site:</p>
<ul>
  <li>All credentials are encrypted in transit and at rest</li>
  <li>You can use API keys instead of your admin credentials</li>
  <li>We use secure API connections that only have the permissions needed</li>
  <li>You can revoke access at any time</li>
  <li>Regular security audits ensure best practices are followed</li>
</ul>
<p>We recommend using a specific user account with Editor privileges (not Administrator) for added security.</p>`}
              />
              
              <FAQItem 
                question="Can I connect multiple WordPress sites?" 
                answer={`<p>Yes, you can connect as many WordPress sites as you need. This is especially useful if you manage multiple blogs or websites for different purposes or clients.</p>
<p>Each connected site appears in your dashboard, and you can create separate publishing schedules for each one. This allows you to maintain a consistent publishing schedule across all your properties with minimal effort.</p>`}
              />
              
              <FAQItem 
                question="What WordPress settings should I check?" 
                answer={`<p>To ensure the best experience with Acta AI, check these WordPress settings:</p>
<ol>
  <li><strong>Categories and Tags:</strong> Make sure you have categories set up that match your content strategy</li>
  <li><strong>Media Settings:</strong> Configure default image sizes and storage options</li>
  <li><strong>Permalink Structure:</strong> Use SEO-friendly permalinks (e.g., post name)</li>
  <li><strong>User Permissions:</strong> Ensure the connecting user has appropriate permissions</li>
  <li><strong>API Access:</strong> Some security plugins might block API access; whitelist Acta AI if necessary</li>
  <li><strong>Comment Settings:</strong> Configure whether you want comments enabled on AI-generated posts</li>
</ol>
<p>Having these settings properly configured will help the integration work smoothly.</p>`}
              />
              
              <FAQItem 
                question="What if my WordPress site has custom fields or special requirements?" 
                answer={`<p>Acta AI can work with sites that have custom fields or special requirements:</p>
<ol>
  <li><strong>Custom Fields:</strong> You can map variables in your templates to custom fields in WordPress</li>
  <li><strong>Featured Images:</strong> The system can generate or select featured images for posts</li>
  <li><strong>Categories and Tags:</strong> You can specify these in your publishing schedules</li>
  <li><strong>Custom Post Types:</strong> If you need to publish to custom post types, contact our support team</li>
  <li><strong>Special Formatting:</strong> Use the content generation prompt to specify special formatting needs</li>
</ol>
<p>For very specific requirements, our support team can help you configure the system to work with your unique setup.</p>`}
              />
            </Box>
          )}

          {/* Troubleshooting */}
          {tabValue === 6 && (
            <Box>
              <Typography variant="h6" gutterBottom>Troubleshooting Common Issues</Typography>
              
              <FAQItem 
                question="The content quality isn't what I expected. How can I improve it?" 
                answer={`<p>If you're not satisfied with the content quality, try these adjustments:</p>
<ol>
  <li>Be more specific in your prompt instructions</li>
  <li>Use examples to illustrate the style you want</li>
  <li>Break down complex topics into clearer components</li>
  <li>Specify what to avoid or include</li>
  <li>Adjust the tone variable to match your brand voice</li>
  <li>Review and refine your templates based on results</li>
</ol>
<p>Remember that the AI learns from your feedback. The more specific your instructions, the better the results will be.</p>`}
              />
              
              <FAQItem 
                question="My schedule didn't publish as expected. What should I check?" 
                answer={`<p>If a scheduled publication didn't work as expected, check these common issues:</p>
<ol>
  <li>WordPress Connection: Verify your site connection is still working</li>
  <li>Schedule Status: Confirm the schedule is active (not paused)</li>
  <li>Time Zone Settings: Ensure your time zone settings are correct</li>
  <li>Template Errors: Check if there are any errors in the prompt template</li>
  <li>Variable Values: Make sure all required variables have valid values</li>
  <li>WordPress Status: Verify your WordPress site is accessible</li>
  <li>Logs: Check the activity logs for specific error messages</li>
</ol>
<p>Most publishing issues can be resolved by addressing one of these factors.</p>`}
              />
              
              <FAQItem 
                question="How can I make the AI content more unique and less generic?" 
                answer={`<p>To make AI-generated content more unique and less generic:</p>
<ol>
  <li>Use specific instructions about your brand voice and style</li>
  <li>Include unique perspectives or approaches in your prompts</li>
  <li>Specify industry-specific terminology to use</li>
  <li>Include variables for unique aspects of each piece</li>
  <li>Request personal anecdotes or case studies that align with your brand</li>
  <li>Use the system prompt to define a distinctive character or perspective</li>
  <li>Be specific about what generic content to avoid</li>
</ol>
<p>Remember: the more unique and specific your instructions, the less generic the output will be.</p>`}
              />
              
              <FAQItem 
                question="I'm getting error messages. What should I do?" 
                answer={`<p>If you encounter error messages:</p>
<ol>
  <li>Read the full error message for specific details</li>
  <li>Check your internet connection</li>
  <li>Verify that your WordPress site is accessible</li>
  <li>Ensure API permissions are properly set</li>
  <li>Try refreshing the page or logging out and back in</li>
  <li>Check if any variables contain invalid characters</li>
  <li>Contact support if the issue persists</li>
</ol>
<p>Most errors include specific information about what went wrong, which can guide you to the solution.</p>`}
              />
              
              <FAQItem 
                question="How do I get more help if I need it?" 
                answer={`<p>If you need additional help:</p>
<ol>
  <li>Contact our support team through the Help button in the dashboard</li>
  <li>Email support@acta-ai.com with specific details about your issue</li>
  <li>Check our knowledge base for tutorials and guides</li>
  <li>Join our monthly webinars for tips and best practices</li>
  <li>Schedule a one-on-one consultation for personalized assistance</li>
</ol>
<p>Our support team is available to help you get the most out of Acta AI and resolve any issues you encounter.</p>`}
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