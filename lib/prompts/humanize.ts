import type { HumanizePromptParams } from "./types";

export function buildHumanizePrompt(body: HumanizePromptParams): string {
  const articleTypeNote = body.articleType
    ? `\n- **Article Type**: ${body.articleType} (adapt humanization style accordingly)`
    : "";
  const povNote = body.pointOfView ? `\n- **Point of View**: ${body.pointOfView}` : "";

  return `# Advanced Content Humanization & Engagement Enhancement

## Humanization Parameters
- **Target Tone**: ${body.tone}
- **Primary Audience**: ${body.targetAudience}
- **Reading Comprehension Level**: ${body.readingLevel}
- **Content Category / Domain**: ${body.category}${articleTypeNote}${povNote}

**Domain-Agnostic Scope**: Humanize content from ANY domain or industry. Match vocabulary, examples, and engagement style to the specific domain—whether entertainment, tech, finance, healthcare, or any other vertical.

## Comprehensive Humanization Objectives

### Primary Goals
**Mission**: Transform content into naturally engaging, human-written material that maintains all SEO benefits while dramatically improving readability and connection with readers.

### Advanced Conversational Enhancement
**Objective**: Create authentic, engaging dialogue with readers

#### Voice & Tone Optimization
- **Active Voice Dominance**: Convert passive constructions to active voice
- **Conversational Flow**: Integrate natural speech patterns and rhythm
- **Audience-Appropriate Language**: Match vocabulary and complexity to target demographic
- **Emotional Resonance**: Add appropriate emotional undertones and connections

#### Engagement Amplification
- **Strategic Questions**: Include thought-provoking rhetorical and direct questions
- **Reader Involvement**: Create opportunities for mental participation and reflection
- **Relatable Examples**: Incorporate scenarios and analogies that resonate with the audience
- **Storytelling Elements**: Weave narrative techniques throughout the content

### Structural & Flow Enhancement
**Objective**: Optimize content architecture for maximum engagement

#### Sentence & Paragraph Dynamics
- **Varied Sentence Length**: Mix short, punchy sentences with longer, detailed ones
- **Rhythm Creation**: Establish natural reading cadence and flow
- **Transition Mastery**: Seamless connections between ideas and sections
- **Paragraph Balance**: Optimal paragraph length for sustained attention

#### Readability Optimization
- **Complexity Management**: Simplify without dumbing down
- **Jargon Translation**: Explain technical terms in accessible language
- **Visual Breaks**: Strategic use of formatting for easier scanning
- **Information Hierarchy**: Clear progression from simple to complex concepts

### Personality & Authenticity Integration
**Objective**: Inject human personality while maintaining professionalism

#### Authentic Voice Development
- **Personal Touch**: Add subtle personal insights and perspectives
- **Domain Expertise**: Demonstrate deep knowledge through nuanced commentary
- **Balanced Formality**: Professional yet approachable communication style
- **Cultural Sensitivity**: Appropriate tone for diverse audience segments

#### Engagement Psychology
- **Curiosity Triggers**: Elements that compel continued reading
- **Value Reinforcement**: Clear articulation of reader benefits
- **Action Inspiration**: Motivational elements that encourage engagement
- **Trust Building**: Credibility signals woven naturally into content

## Critical Output Requirements

### Humanized Article Delivery
**Provide clean, engaging content that:**

#### Content Quality Standards
- **Natural Reading Experience**: Flows like expert human writing
- **Maintained Accuracy**: All facts, data, and technical details preserved
- **Enhanced Engagement**: Significantly more compelling than original
- **SEO Preservation**: All optimization benefits retained without obvious SEO language

#### Formatting & Structure
- **Clean Markdown**: Proper formatting without meta-comments
- **No Humanization Labels**: Remove any references to "humanized" or "optimized"
- **Professional Presentation**: Publication-ready content
- **Consistent Voice**: Unified tone throughout the entire piece

### Strict Exclusion Rules
**The final output must NOT contain:**
- References to "humanized content" or "humanization"
- Meta-comments about optimization or enhancement
- Labels indicating content processing or generation
- Technical SEO terminology visible to readers
- Any indication that content was artificially enhanced

### Quality Validation Checklist
- **Readability**: Flows naturally without forced elements
- **Engagement**: Compelling and interesting throughout
- **Authenticity**: Sounds like genuine expert writing
- **Accuracy**: All factual content preserved and correct
- **Professionalism**: Maintains appropriate standards for the domain

---

**CRITICAL REQUIREMENT**: Output only the final humanized article content in clean markdown format. No explanatory text, no meta-comments, no processing notes - just the polished, engaging article that reads as if written by a skilled human expert.

**Input Data**: Content to humanize and comprehensive audience parameters provided as JSON input.`;
}
