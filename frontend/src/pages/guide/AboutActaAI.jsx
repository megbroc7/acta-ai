import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Stack, Paper, Divider,
} from '@mui/material';
import { keyframes } from '@mui/system';
import {
  AutoAwesome, Shield, Psychology, FormatQuote, Speed, Language,
  Search, Visibility, CheckCircleOutline, TipsAndUpdates, Compare,
  East as ArrowIcon,
} from '@mui/icons-material';

// ---------------------------------------------------------------------------
// Keyframe animations
// ---------------------------------------------------------------------------

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const gradientBorder = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const strikeAcross = keyframes`
  from { width: 0; }
  to { width: 100%; }
`;

const countUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

function BannedWord({ word, delay }) {
  return (
    <Box
      sx={{
        display: 'inline-block',
        position: 'relative',
        px: 1.5,
        py: 0.5,
        m: 0.5,
        border: '1px solid #D4A0A0',
        bgcolor: 'rgba(160, 82, 45, 0.04)',
        fontFamily: 'monospace',
        fontSize: '0.82rem',
        fontWeight: 600,
        color: '#8B5E5E',
        transition: 'all 0.3s',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '50%',
          left: 4,
          height: 2,
          bgcolor: '#A0522D',
          animation: `${strikeAcross} 0.6s ${delay}s ease-out forwards`,
          width: 0,
        },
        '&:hover': {
          bgcolor: 'rgba(160, 82, 45, 0.1)',
          borderColor: '#A0522D',
          transform: 'scale(1.05)',
        },
      }}
    >
      {word}
    </Box>
  );
}

function StatBlock({ number, label, delay }) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        animation: `${countUp} 0.6s ${delay}s ease-out both`,
      }}
    >
      <Typography
        sx={{
          fontWeight: 900,
          fontSize: { xs: '2.5rem', md: '3.2rem' },
          lineHeight: 1,
          background: 'linear-gradient(135deg, #2D5E4A, #4A7C6F, #6B9E8A)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          letterSpacing: '-0.03em',
        }}
      >
        {number}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#B08D57',
          fontSize: '0.7rem',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function PipelineStep({ num, title, desc, isLast }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
      {/* Vertical connector line */}
      {!isLast && (
        <Box
          sx={{
            position: 'absolute',
            left: 23,
            top: 48,
            width: 2,
            height: 'calc(100% - 24px)',
            background: 'linear-gradient(180deg, #4A7C6F, #B08D57)',
            opacity: 0.3,
          }}
        />
      )}
      {/* Number circle */}
      <Box
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          width: 48,
          height: 48,
          minWidth: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: hovered
            ? 'linear-gradient(135deg, #2D5E4A, #4A7C6F)'
            : 'linear-gradient(135deg, #4A7C6F, #6B9E8A)',
          color: '#fff',
          fontWeight: 900,
          fontSize: '1.2rem',
          mr: 2.5,
          flexShrink: 0,
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: hovered ? 'scale(1.15) rotate(-5deg)' : 'scale(1)',
          boxShadow: hovered ? '0 4px 20px rgba(74, 124, 111, 0.4)' : 'none',
        }}
      >
        {num}
      </Box>
      {/* Content */}
      <Box
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          pb: 3.5,
          transition: 'transform 0.3s',
          transform: hovered ? 'translateX(4px)' : 'translateX(0)',
        }}
      >
        <Typography
          sx={{
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontSize: '0.9rem',
            mb: 0.5,
            color: hovered ? '#2D5E4A' : '#2A2A2A',
            transition: 'color 0.3s',
          }}
        >
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">{desc}</Typography>
      </Box>
    </Box>
  );
}

function BattleCard({ icon, title, acta, others }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Card
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #4A7C6F, #B08D57, #4A7C6F)',
          backgroundSize: '200% 100%',
          animation: `${gradientBorder} 3s ease infinite`,
        },
      }}
    >
      <CardContent sx={{ pt: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5 }}>
          <Box
            sx={{
              color: '#4A7C6F',
              transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: hovered ? 'scale(1.2) rotate(-10deg)' : 'scale(1)',
            }}
          >
            {icon}
          </Box>
          <Typography
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontSize: '0.9rem',
            }}
          >
            {title}
          </Typography>
        </Stack>

        {/* Acta AI side */}
        <Box
          sx={{
            p: 2,
            mb: 1.5,
            border: '1px solid',
            borderColor: hovered ? '#4A7C6F' : '#E0DCD5',
            borderLeft: '4px solid #4A7C6F',
            bgcolor: 'rgba(74, 124, 111, 0.03)',
            transition: 'all 0.3s',
          }}
        >
          <Chip
            label="ACTA AI"
            size="small"
            sx={{
              bgcolor: '#4A7C6F',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.65rem',
              letterSpacing: '0.1em',
              height: 22,
              mb: 1,
            }}
          />
          <Typography variant="body2" sx={{ lineHeight: 1.7 }}>{acta}</Typography>
        </Box>

        {/* Others side */}
        <Box
          sx={{
            p: 2,
            border: '1px dashed #D5D0C8',
            borderLeft: '4px solid #BFBFBF',
            bgcolor: 'rgba(0, 0, 0, 0.015)',
          }}
        >
          <Chip
            label="OTHERS"
            size="small"
            sx={{
              bgcolor: '#BFBFBF',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.65rem',
              letterSpacing: '0.1em',
              height: 22,
              mb: 1,
            }}
          />
          <Typography variant="body2" sx={{ color: '#888', lineHeight: 1.7 }}>
            {others}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function EEATLetter({ letter, label, desc, color, delay }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        position: 'relative',
        cursor: 'default',
        animation: `${countUp} 0.5s ${delay}s ease-out both`,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          height: '100%',
          borderColor: hovered ? color : '#E0DCD5',
          borderWidth: hovered ? 2 : 1,
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
          overflow: 'hidden',
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: hovered ? 4 : 0,
            bgcolor: color,
            transition: 'height 0.3s',
          },
        }}
      >
        {/* Giant background letter */}
        <Typography
          sx={{
            position: 'absolute',
            top: -10,
            right: -5,
            fontSize: '8rem',
            fontWeight: 900,
            color: color,
            opacity: hovered ? 0.1 : 0.04,
            lineHeight: 1,
            transition: 'opacity 0.4s',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {letter}
        </Typography>
        {/* Foreground content */}
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: color,
              color: '#fff',
              fontWeight: 900,
              fontSize: '1.3rem',
              mb: 1.5,
              transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: hovered ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            {letter}
          </Box>
          <Typography
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontSize: '0.85rem',
              mb: 1,
            }}
          >
            {label}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            {desc}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

function CapabilityCard({ icon, title, description, delay }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Card
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        height: '100%',
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        animation: `${countUp} 0.5s ${delay}s ease-out both`,
        position: 'relative',
        overflow: 'hidden',
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: hovered ? '100%' : '0%',
          height: 3,
          background: 'linear-gradient(90deg, #4A7C6F, #B08D57)',
          transition: 'width 0.4s ease',
        },
      }}
    >
      <CardContent>
        <Box
          sx={{
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: hovered
              ? 'linear-gradient(135deg, #4A7C6F, #6B9E8A)'
              : 'rgba(74, 124, 111, 0.08)',
            color: hovered ? '#fff' : '#4A7C6F',
            mb: 2,
            transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: hovered ? 'rotate(-8deg) scale(1.1)' : 'rotate(0)',
          }}
        >
          {icon}
        </Box>
        <Typography
          sx={{
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontSize: '0.85rem',
            mb: 1,
          }}
        >
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const BANNED_WORDS = [
  'delve', 'harness', 'leverage', 'holistic', 'synergy', 'paradigm',
  'robust', 'tapestry', 'landscape', 'multifaceted', 'crucial',
  'streamline', 'Moreover,', 'Furthermore,', 'In conclusion,',
  "In today's fast-paced world,", 'game-changer', 'utilize',
];

const PIPELINE = [
  { num: 1, title: 'Title Generation', desc: '5 headline variants: How-To, Contrarian, Listicle, Experience-Led, Direct Benefit. You pick the angle, not the AI.' },
  { num: 2, title: 'Experience Interview', desc: 'The AI asks you 3-5 targeted questions about your real experience with the topic. Your answers become the article\'s backbone.' },
  { num: 3, title: 'Structured Outline', desc: 'A full outline is generated from your chosen title, ensuring logical flow and argument structure before any prose is written.' },
  { num: 4, title: 'Full Draft', desc: 'The article is generated with your voice settings, SEO targets, experience context, and all guardrails active. Every section starts answer-first.' },
  { num: 5, title: 'AI Review', desc: 'A second AI pass reviews the draft for quality, coherence, banned phrase compliance, and alignment with your style rules.' },
];

const BATTLES = [
  {
    icon: <AutoAwesome />,
    title: 'Content Pipeline',
    acta: '5 distinct AI stages: title, interview, outline, draft, review. Each builds on the last with dedicated prompts and context.',
    others: 'Single-prompt generation. One API call, one output, no refinement.',
  },
  {
    icon: <FormatQuote />,
    title: 'First-Hand Experience',
    acta: 'Two-layer experience injection. Your credentials and real anecdotes woven into every article. Reverse interview extracts stories you might not think to include.',
    others: 'No mechanism for injecting real experience. Content generated from general knowledge only.',
  },
  {
    icon: <Shield />,
    title: 'Anti-Robot Detection',
    acta: '80+ hardcoded banned phrases across 6 categories. Forced active voice, varied sentence structure, natural transitions. Always on. Cannot be disabled.',
    others: 'No phrase filtering. Output riddled with AI-isms. Detectable by readers and search engines alike.',
  },
  {
    icon: <Search />,
    title: 'GEO Optimization',
    acta: 'Answer-first format after every H2. Modular passages designed for AI search engine extraction (ChatGPT, Perplexity, Google AI Overview).',
    others: 'Traditional SEO only. No awareness of how AI search engines select and cite content.',
  },
  {
    icon: <Psychology />,
    title: 'Voice Control',
    acta: '10-level personality scale that changes how the AI thinks, not just how it writes. Full control over perspective, tone, humor, anecdotes, and rhetorical questions.',
    others: "Basic tone selector. Pick 'professional' or 'casual.' No granular personality control.",
  },
  {
    icon: <Visibility />,
    title: 'Full Transparency',
    acta: 'Prompt Audit panel shows the exact system prompt, outline, and instructions sent to the AI. See and refine everything under the hood.',
    others: 'Black box. Type a topic, get an article. No insight into what the AI was told.',
  },
];

const EEAT = [
  {
    letter: 'E', label: 'Experience', color: '#2D5E4A',
    desc: 'Your first-hand experience injected at two levels: general credentials on every article, plus specific anecdotes per topic. The reverse interview extracts stories you didn\'t know you had.',
  },
  {
    letter: 'E', label: 'Expertise', color: '#4A7C6F',
    desc: 'Industry, audience level, and system prompt define the AI\'s specialist role. It writes as a subject-matter expert, not a generalist summarizing Wikipedia.',
  },
  {
    letter: 'A', label: 'Authoritativeness', color: '#B08D57',
    desc: 'Specific numbers, named methodologies, real outcomes. The experience system ensures claims are backed by your actual track record, not hallucinations.',
  },
  {
    letter: 'T', label: 'Trustworthiness', color: '#8B7355',
    desc: 'Anti-robot guardrails ensure content reads as genuinely human. No AI-isms, no filler, no hollow authority. Readers and search engines trust what sounds real.',
  },
];

const CAPABILITIES = [
  { icon: <Language />, title: 'Multi-Platform Publishing', description: 'Publish to WordPress, Shopify, and Wix from one dashboard. Native API handling for categories, tags, blog selection, and more.' },
  { icon: <Speed />, title: 'Automated Scheduling', description: 'Daily, weekly, monthly, or custom cron. Topics queued with per-topic experience notes and processed on autopilot.' },
  { icon: <Compare />, title: '5 Title Variants', description: 'Five headline approaches per topic: How-To, Contrarian, Listicle, Experience-Led, Direct Benefit. Pick the angle that fits.' },
  { icon: <Psychology />, title: 'Reverse Interview', description: 'The AI asks 3-5 targeted questions about your real experience before writing. Your answers become authentic content.' },
  { icon: <CheckCircleOutline />, title: 'AI Review Pass', description: 'Second AI review for quality, coherence, and style compliance before anything is saved or published.' },
  { icon: <TipsAndUpdates />, title: 'SEO Keyword Engine', description: 'AI-powered keyword suggestions. Control density, meta description style, and internal linking instructions.' },
];

// ---------------------------------------------------------------------------
// Section divider
// ---------------------------------------------------------------------------

function SectionLabel({ children, color = '#2A2A2A' }) {
  return (
    <Box sx={{ mt: 8, mb: 3, position: 'relative' }}>
      <Typography
        sx={{
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontSize: '1.15rem',
          color,
          position: 'relative',
          display: 'inline-block',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -8,
            left: 0,
            width: '60%',
            height: 3,
            background: `linear-gradient(90deg, ${color}, transparent)`,
          },
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AboutActaAI() {
  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* ----------------------------------------------------------------- */}
      {/* HERO                                                              */}
      {/* ----------------------------------------------------------------- */}
      <Box sx={{ mb: 6, mt: 1 }}>
        <Typography
          variant="h4"
          sx={{
            mb: 1,
            position: 'relative',
            display: 'inline-block',
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: -6,
              left: 0,
              width: '100%',
              height: 3,
              background: 'linear-gradient(90deg, #4A7C6F, #6B9E8A, transparent)',
            },
          }}
        >
          About Acta AI
        </Typography>

        <Box sx={{ mt: 5, mb: 4, position: 'relative' }}>
          {/* Shimmer accent bar */}
          <Box
            sx={{
              position: 'absolute',
              top: -16,
              left: 0,
              width: 120,
              height: 3,
              background: 'linear-gradient(90deg, transparent, #B08D57, #D4A574, transparent)',
              backgroundSize: '200% 100%',
              animation: `${shimmer} 3s linear infinite`,
            }}
          />
          <Typography
            sx={{
              fontSize: { xs: '1.6rem', md: '2.1rem' },
              fontWeight: 900,
              lineHeight: 1.2,
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              maxWidth: 650,
            }}
          >
            Most AI bloggers generate{' '}
            <Box
              component="span"
              sx={{
                color: '#BFBFBF',
                textDecoration: 'line-through',
                textDecorationColor: '#A0522D',
                textDecorationThickness: 3,
              }}
            >
              content
            </Box>
            .
            <br />
            Acta AI generates{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #2D5E4A, #4A7C6F, #B08D57)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              authority
            </Box>
            .
          </Typography>
        </Box>

        <Paper
          variant="outlined"
          sx={{
            p: 3,
            borderColor: '#E0DCD5',
            borderLeft: '4px solid #B08D57',
            maxWidth: 680,
          }}
        >
          <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
            Named after the <strong style={{ color: '#2A2A2A' }}>Acta Diurna</strong>, ancient
            Rome's daily public gazette and one of history's first newspapers. Acta AI is built
            on the principle that published content should carry the weight of real expertise,
            not just fill a page.
          </Typography>
        </Paper>
      </Box>

      {/* ----------------------------------------------------------------- */}
      {/* STATS                                                             */}
      {/* ----------------------------------------------------------------- */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 3,
          py: 4,
          px: 2,
          mb: 2,
          position: 'relative',
          '&::before, &::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, #E0DCD5, #B08D57, #E0DCD5, transparent)',
          },
          '&::before': { top: 0 },
          '&::after': { bottom: 0 },
        }}
      >
        <StatBlock number="5" label="AI Stages" delay={0.1} />
        <StatBlock number="80+" label="Banned Phrases" delay={0.2} />
        <StatBlock number="10" label="Voice Levels" delay={0.3} />
        <StatBlock number="2" label="Experience Layers" delay={0.35} />
        <StatBlock number="3" label="Platforms" delay={0.4} />
      </Box>

      {/* ----------------------------------------------------------------- */}
      {/* THE PROBLEM — Banned phrase wall                                  */}
      {/* ----------------------------------------------------------------- */}
      <SectionLabel color="#A0522D">The Problem with AI Content</SectionLabel>

      <Typography variant="body1" sx={{ mb: 3, maxWidth: 700, lineHeight: 1.8 }}>
        AI blog posts all sound the same. Search engines are getting better at detecting it.
        Readers already can. Here's what AI content sounds like when nobody's paying attention:
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          p: 3,
          mb: 2,
          borderColor: '#D4A0A0',
          bgcolor: 'rgba(160, 82, 45, 0.02)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '"BANNED"',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-12deg)',
            fontSize: '4rem',
            fontWeight: 900,
            color: 'rgba(160, 82, 45, 0.06)',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          {BANNED_WORDS.map((word, i) => (
            <BannedWord key={word} word={word} delay={0.3 + i * 0.1} />
          ))}
        </Box>
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontStyle: 'italic' }}>
        Every one of these is hardcoded as banned in Acta AI. They cannot be turned off.
      </Typography>

      {/* ----------------------------------------------------------------- */}
      {/* PIPELINE                                                          */}
      {/* ----------------------------------------------------------------- */}
      <SectionLabel>5-Stage Content Pipeline</SectionLabel>

      <Typography variant="body1" sx={{ mb: 4, maxWidth: 700, lineHeight: 1.8 }}>
        Every article passes through five distinct AI stages. Each one builds on the last
        with dedicated prompts and accumulated context. This is not a single-prompt tool.
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2.5, md: 4 },
          borderColor: '#E0DCD5',
          mb: 2,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: 4,
            height: '100%',
            background: 'linear-gradient(180deg, #4A7C6F, #B08D57, #4A7C6F)',
            backgroundSize: '100% 200%',
            animation: `${gradientBorder} 4s ease infinite`,
          },
        }}
      >
        {PIPELINE.map((step, i) => (
          <PipelineStep
            key={step.num}
            num={step.num}
            title={step.title}
            desc={step.desc}
            isLast={i === PIPELINE.length - 1}
          />
        ))}
      </Paper>

      {/* ----------------------------------------------------------------- */}
      {/* VS BATTLES                                                        */}
      {/* ----------------------------------------------------------------- */}
      <SectionLabel>How Acta AI Is Different</SectionLabel>

      <Grid container spacing={2.5} sx={{ mb: 2 }}>
        {BATTLES.map((b) => (
          <Grid size={{ xs: 12, md: 6 }} key={b.title}>
            <BattleCard {...b} />
          </Grid>
        ))}
      </Grid>

      {/* ----------------------------------------------------------------- */}
      {/* E-E-A-T                                                           */}
      {/* ----------------------------------------------------------------- */}
      <SectionLabel>Built for E-E-A-T</SectionLabel>

      <Typography variant="body1" sx={{ mb: 4, maxWidth: 700, lineHeight: 1.8 }}>
        Google's ranking framework rewards content that demonstrates real experience.
        Most AI tools ignore it. Acta AI was designed around it.
      </Typography>

      <Grid container spacing={2.5} sx={{ mb: 2 }}>
        {EEAT.map((item, i) => (
          <Grid size={{ xs: 12, sm: 6 }} key={item.label}>
            <EEATLetter {...item} delay={0.1 + i * 0.1} />
          </Grid>
        ))}
      </Grid>

      {/* ----------------------------------------------------------------- */}
      {/* CAPABILITIES                                                      */}
      {/* ----------------------------------------------------------------- */}
      <SectionLabel>Key Capabilities</SectionLabel>

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {CAPABILITIES.map((cap, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={cap.title}>
            <CapabilityCard {...cap} delay={0.1 + i * 0.08} />
          </Grid>
        ))}
      </Grid>

      {/* ----------------------------------------------------------------- */}
      {/* CLOSING                                                           */}
      {/* ----------------------------------------------------------------- */}
      <Box
        sx={{
          mt: 6,
          mb: 2,
          p: 4,
          position: 'relative',
          textAlign: 'center',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            padding: '2px',
            background: 'linear-gradient(135deg, #4A7C6F, #B08D57, #4A7C6F, #B08D57)',
            backgroundSize: '300% 300%',
            animation: `${gradientBorder} 5s ease infinite`,
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          },
        }}
      >
        <Typography
          sx={{
            fontSize: '1.1rem',
            fontWeight: 700,
            lineHeight: 1.8,
            maxWidth: 600,
            mx: 'auto',
          }}
        >
          AI content tools are everywhere.
          <br />
          What's rare is one that treats{' '}
          <Box
            component="span"
            sx={{
              background: 'linear-gradient(135deg, #2D5E4A, #B08D57)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              fontWeight: 900,
            }}
          >
            your expertise
          </Box>{' '}
          as the core ingredient.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Acta AI doesn't just generate articles. It generates articles that sound like{' '}
          <em>you</em> wrote them, because the best parts come from you.
        </Typography>
      </Box>
    </Box>
  );
}
