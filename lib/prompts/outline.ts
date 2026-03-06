import type { OutlinePromptParams } from "./types";

export function buildOutlinePrompt(body: OutlinePromptParams): string {
  const wordCountStrategy = body.targetWordCount
    ? `**Precise Word Count Target**: ${body.targetWordCount} words with section-by-section allocation`
    : `**Length Classification**: ${body.length} format with optimal word count distribution`;

  const articleTypeNote = body.articleType
    ? `\n- **Article Type**: ${body.articleType} (structure must follow conventions for this format)`
    : "";
  const formatNote = body.articleFormat ? `\n- **Publication Format**: ${body.articleFormat}` : "";
  const povNote = body.pointOfView ? `\n- **Point of View**: ${body.pointOfView}` : "";
  const intentNote = body.contentIntent ? `\n- **Content Intent**: ${body.contentIntent}` : "";
  const infographicsNote = body.requireInfographics
    ? `\n- **Infographics**: MANDATORY - Every article section must include at least one infographic. Specify infographic concepts for each major section.`
    : "";
  const languageNote = body.language && body.language !== "en"
    ? `\n- **Output Language**: Structure and outline for content to be written in ${body.language.toUpperCase()}.`
    : "";

  return `# Strategic Article Architecture & Content Blueprint Development

## Content Strategy Parameters
You are architecting a comprehensive content blueprint that will serve as the definitive roadmap for creating authoritative content.

**Domain-Agnostic Scope**: This outline applies to ANY domain or industry—entertainment, technology, finance, healthcare, lifestyle, news, B2B, B2C, or any other vertical. Adapt your structure, tone, and conventions to match the specific domain and audience. Do not assume a particular industry; let the category and keyword guide your approach.

### Content Specifications
- **Stylistic Approach**: ${body.style}
- **Audience Comprehension Level**: ${body.readingLevel}
- **${wordCountStrategy}**
- **Subtopic Integration Strategy**: ${body.includeSubtopics ? "Multi-layered subtopic development required" : "Streamlined focus without subtopic elaboration"}${articleTypeNote}${formatNote}${povNote}${intentNote}${infographicsNote}${languageNote}

## Comprehensive Outline Architecture

### Strategic Title Development
**Objective**: Create compelling, SEO-optimized, and engagement-driven headlines

#### Primary Title Portfolio
${!body.title ? `
**Generate 5-7 Title Variations**:
- **Authority-Based Title**: Establishes expertise and credibility
- **Benefit-Driven Title**: Focuses on reader value proposition
- **Curiosity-Gap Title**: Creates intrigue and click motivation
- **Number/List-Based Title**: Provides specific, digestible promise
- **Question-Based Title**: Directly addresses audience queries
- **Contrarian Title**: Challenges conventional wisdom
- **How-To/Guide Title**: Offers practical, actionable value
` : `**Primary Title**: "${body.title}"\n**Title Optimization Analysis**: Assess SEO potential, emotional impact, and audience alignment`}

#### Title Variation Strategy
- **SEO-Optimized Variants**: Keyword-rich versions for search visibility
- **Social Media Adaptations**: Platform-specific optimizations for sharing
- **Email Subject Line Versions**: Shortened, action-oriented variants
- **Headline A/B Testing Options**: Multiple versions for performance testing

### Strategic Content Architecture

#### 1. High-Impact Introduction Framework (15-20% of total word count)
**Strategic Objective**: Capture attention, establish authority, and create reading momentum
- **Hook Development**: Compelling opening that immediately engages target audience
- Statistical shock value or surprising domain insight
- Relevant anecdote or case study preview
- Provocative question or contrarian statement
- **Context Establishment**: Position the topic within broader domain/vertical context
- **Value Proposition Declaration**: Clear articulation of what readers will gain
- **Content Preview**: Strategic roadmap of upcoming content sections
- **Authority Signals**: Subtle establishment of expertise and credibility

#### 2. Core Content Section Architecture (65-70% of total word count)
**Strategic Objective**: Deliver comprehensive value while maintaining engagement

${body.includeSubtopics ? `
**Multi-Layered Section Development** (3-7 primary sections):
Each section must include:
- **Primary Section Focus**: Core topic with clear learning objective
- **Subtopic Integration**: 2-4 relevant subtopics that enhance understanding
- **Evidence Integration Points**: Where to incorporate statistics, case studies, expert quotes
- **Practical Application Elements**: Real-world examples and actionable insights
- **Transition Strategy**: Seamless connections to subsequent sections
` : `
**Streamlined Section Development** (3-7 focused sections):
Each section must include:
- **Clear Section Objective**: Specific learning outcome or value delivery
- **Key Point Hierarchy**: 3-5 main points with supporting evidence
- **Engagement Maintenance**: Interactive elements, questions, or thought exercises
- **Authority Building**: Expert insights, data points, or case study integration
`}

#### 3. Strategic Conclusion Framework (10-15% of total word count)
**Strategic Objective**: Reinforce value, inspire action, and encourage engagement
- **Key Insight Synthesis**: Comprehensive summary of primary takeaways
- **Action-Oriented Recommendations**: Specific next steps for readers
- **Call-to-Action Strategy**: Engagement prompt aligned with content objectives
- **Future Consideration**: Domain trends or evolving aspects to monitor

### Content Enhancement Strategy

#### Engagement Optimization Elements
- **Quote Integration Strategy**: Identification of expert quote opportunities
- **Statistical Reinforcement**: Data points that support key arguments
- **Case Study Placement**: Real-world examples that illustrate concepts
- **Visual Content Integration**: Infographic opportunities, chart suggestions, image placement
- **Interactive Elements**: Questions, self-assessment tools, or practical exercises

#### SEO & Discoverability Framework
- **Header Hierarchy Strategy**: H2, H3, H4 structure for optimal readability and SEO
- **Keyword Integration Points**: Natural keyword placement opportunities
- **Internal Linking Architecture**: Strategic connections to related content
- **Meta Description Strategy**: Compelling snippet development for search results

### Section-by-Section Intelligence

For each primary content section, provide comprehensive development guidance:

#### Section Analysis Framework
- **Strategic Objective**: What specific goal this section achieves within the overall content strategy
- **Audience Psychology**: How this section addresses specific audience needs or pain points
- **Key Message Hierarchy**: 3-5 primary points with supporting sub-points
- **Word Count Allocation**: Precise word count estimate with justification
- **Engagement Strategy**: Specific techniques for maintaining reader interest
- **Authority Building**: How to establish expertise within this section
- **Transition Planning**: Connection strategy to subsequent sections

#### Content Enhancement Mapping
- **Evidence Requirements**: Types of supporting data, research, or examples needed
- **Expert Voice Integration**: Opportunities for quotes, interviews, or authoritative sourcing
- **Practical Application**: How readers can immediately apply or benefit from this information
- **Potential Objections**: Anticipated reader concerns and how to address them

### Performance Optimization Strategy

#### Content Marketing Integration
- **Shareability Factors**: Elements that encourage social media sharing
- **Email Marketing Potential**: Sections suitable for newsletter repurposing
- **Lead Generation Opportunities**: Natural points for opt-in offers or content upgrades (when applicable to the domain)
- **Conversion Optimization**: Strategic placement of engagement-relevant calls-to-action (when applicable to the domain)

#### Analytics & Measurement Framework
- **Engagement Metrics**: Specific KPIs to track section performance
- **User Behavior Prediction**: Anticipated reading patterns and drop-off points
- **A/B Testing Opportunities**: Elements suitable for performance testing
- **Iteration Strategy**: How to optimize based on performance data

**Strategic Input Integration**: Research data, audience insights, and domain intelligence will be synthesized through this architectural framework to ensure maximum content impact and alignment with content goals.`;
}
