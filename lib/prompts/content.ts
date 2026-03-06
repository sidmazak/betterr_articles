import type { ContentPromptParams } from "./types";

export function buildContentPrompt(body: ContentPromptParams): string {
  const linkingStrategy: string[] = [];
  if (body.externalLinking) {
    linkingStrategy.push("Strategic external link integration for authority building and user value");
  }
  if (body.internalLinking) {
    linkingStrategy.push("Comprehensive internal linking architecture for SEO optimization and user journey enhancement");
  }

  const articleTypeNote = body.articleType
    ? `\n- **Article Type**: ${body.articleType} (structure and conventions must match this format)`
    : "";
  const formatNote = body.articleFormat ? `\n- **Publication Format**: ${body.articleFormat}` : "";
  const povNote = body.pointOfView ? `\n- **Point of View**: ${body.pointOfView}` : "";
  const intentNote = body.contentIntent ? `\n- **Content Intent**: ${body.contentIntent}` : "";
  const citationNote = body.citationStyle ? `\n- **Citation Style**: ${body.citationStyle}` : "";
  const infographicsNote = body.requireInfographics
    ? `\n- **Infographics**: MANDATORY - Every article MUST include infographics. Specify placement and concept for each major section.`
    : "";
  const existingPagesNote =
    body.existingPages && body.existingPages.length > 0
      ? `\n\n### Internal Linking - Existing Pages (crawled)\n**You MUST include internal links to these existing pages where contextually relevant:**\n${body.existingPages.map((p) => `- [${p.title}](${p.url})`).join("\n")}\n\nIntegrate 3-5 internal links naturally throughout the content.`
      : "";
  const publishedNote =
    body.publishedArticles && body.publishedArticles.length > 0
      ? `\n\n### Published Articles (live on site)\n**These articles are already published. Link to them for backlinks and internal linking:**\n${body.publishedArticles.map((p) => `- [${p.title}](${p.url})`).join("\n")}\n\nInclude links to relevant published articles where it adds value.`
      : "";
  const languageNote = body.language && body.language !== "en"
    ? `\n- **Output Language**: Write the ENTIRE article in ${body.language.toUpperCase()}. All content, headings, and body text must be in this language.`
    : "";

  return `# Industry-Leading Content Creation & Editorial Excellence

## Content Development Mission
You are creating premium, authoritative content that will serve as a definitive resource for its domain.

**Domain-Agnostic Scope**: This content applies to ANY domain or industry—entertainment, technology, finance, healthcare, lifestyle, news, B2B, B2C, or any other vertical. Adapt your tone, examples, conventions, and value proposition to match the specific domain and audience. Do not assume a particular industry; let the category and keyword guide your approach.

## Content Strategy Specifications
- **Tonal Architecture**: ${body.tone} (with strategic variation for optimal engagement)
- **Editorial Style Framework**: ${body.style}
- **Content Scope**: ${body.length}
- **Primary Audience Profile**: ${body.targetAudience}
- **Accessibility Standard**: ${body.readingLevel}
- **Authorial Voice**: ${body.authorName ?? "Brand-aligned thought leadership voice"}${articleTypeNote}${formatNote}${povNote}${intentNote}${citationNote}${infographicsNote}${languageNote}

## Strategic Content Requirements
${existingPagesNote}${publishedNote}

${linkingStrategy.length > 0 ? `
### Linking & Authority Strategy
${linkingStrategy.map((strategy) => `- ${strategy}`).join("\n")}

**Link Integration Protocols**:
- External links must enhance reader value and establish topical authority
- Link placement should feel natural and contextually relevant
- All external sources must be credible, recent, and authoritative
- Internal links should create logical content pathways and improve site engagement
- Link anchor text must be descriptive and SEO-optimized
` : ""}

### Editorial Excellence Framework
**Tonal Consistency**: Maintain **${body.tone.toLowerCase()}** tone while adapting for section-specific requirements
- Introduction: Engaging and authoritative
- Body content: Informative yet accessible
- Conclusion: Inspiring and action-oriented

**Readability Optimization**: Target **${body.readingLevel.toLowerCase()}** reading level through:
- Strategic sentence length variation
- Active voice preference (80%+ of sentences)
- Concrete language over abstract concepts
- Logical information hierarchy
- Smooth transitional elements

**Audience Alignment**: Optimize for **${body.targetAudience.toLowerCase()}** through:
- Domain-appropriate terminology (with clear explanations when needed)
- Relevant examples and case studies from the article's vertical
- Appropriate depth of technical detail for the domain
- Value-focused content organization

## Mission-Critical Content Directives
${body.customInstructions ? `**Non-Negotiable Requirements**: ${body.customInstructions}\n\nThese specifications must be woven throughout the entire content piece and are essential for meeting strategic objectives.` : "**Standard Editorial Protocol**: Apply domain-appropriate best practices for content excellence"}

## Comprehensive Content Deliverable Structure

### Strategic Content Header
**Objective**: Immediate impact and professional presentation

#### Headline Architecture
- **Primary Headline**: Compelling, benefit-focused, and optimized for both SEO and social sharing
- **Subheadline/Deck**: Supporting detail that expands on the primary promise (if strategically beneficial)
- **Editorial Metadata**: Professional byline with author credentials and publication timestamp
- **Content Classification**: Article category and estimated reading time

### Premium Content Body Development

#### Introduction Excellence (Hook + Context + Preview)
**Strategic Requirements**:
- **Attention-Grabbing Hook**: Open with compelling statistic, surprising insight, relevant anecdote, or thought-provoking question
- **Contextual Positioning**: Establish the topic's relevance within broader domain/vertical context
- **Value Proposition Declaration**: Clear statement of what readers will gain from investing their time
- **Content Roadmap**: Brief preview of key sections and primary takeaways
- **Credibility Establishment**: Subtle indicators of expertise and authoritative sourcing

#### Main Content Architecture (Research-Driven + Strategically Structured)
**Content Development Principles**:
- **Logical Flow Progression**: Each section builds upon previous content while standing alone as valuable
- **Evidence-Based Arguments**: Every major claim supported by credible data, research, or expert testimony
- **Practical Application Focus**: Theoretical concepts translated into actionable insights
- **Engagement Maintenance**: Strategic use of questions, examples, and interactive elements
- **Authority Building**: Consistent demonstration of deep subject matter expertise

**Section Enhancement Requirements**:
- **Smooth Transitions**: Every section connection must feel natural and purposeful
- **Supporting Evidence Integration**: Statistics, case studies, expert quotes, and real-world examples
- **Reader Engagement Elements**: Rhetorical questions, self-assessment opportunities, practical exercises
- **Visual Content Integration**: Clear indicators for chart placement, infographic opportunities, and image insertion points

#### Strategic Conclusion Framework (Synthesis + Action + Future)
**Conclusion Architecture**:
- **Key Insight Synthesis**: Comprehensive yet concise summary of primary takeaways
- **Actionable Recommendations**: Specific, implementable next steps for readers
- **Strategic Call-to-Action**: Engagement prompt aligned with content goals that provides additional value
- **Future Consideration**: Domain evolution predictions or emerging trends to monitor
- **Relationship Building**: Invitation for continued engagement or feedback

### Professional Content Formatting & Enhancement

#### Typography & Structure Optimization
- **Header Hierarchy Strategy**: Strategic use of H2, H3, H4 for both readability and SEO optimization
- **List Integration**: Bullet points and numbered lists where they enhance comprehension and scannability
- **Emphasis Techniques**: Strategic use of **bold** and *italic* text for key concepts and important information
- **Quote Integration**: Block quotes for significant insights, expert opinions, or important statistics
- **White Space Management**: Optimal paragraph length and section spacing for digital readability

#### Link Integration Excellence
${body.externalLinking ? `
**External Linking Protocol**:
- Format: [Descriptive anchor text](URL) with strategic placement
- Authority sources only (domain-appropriate publications, research institutions, recognized experts)
- Contextual relevance required for every link
- Link diversity across different authoritative domains
- Strategic placement to enhance rather than interrupt content flow
` : ""}

${body.internalLinking ? `
**Internal Linking Strategy**:
- Format: [Internal: descriptive anchor text] with clear relevance indicators
- Strategic placement for user journey optimization
- Topic clustering and content pillar reinforcement
- Natural integration within content context
- SEO benefit maximization through relevant anchor text
` : ""}

#### Content Enhancement Elements
- **Scannable Content Design**: Subheadings, bullet points, and short paragraphs for easy consumption
- **Key Takeaway Highlighting**: Important concepts emphasized through formatting and placement
- **Action Item Integration**: Clear next steps and practical applications throughout content
- **Expert Voice Integration**: Authoritative quotes and insights from domain leaders and recognized voices
- **Data Visualization Suggestions**: Clear indicators where charts, graphs, or infographics would enhance understanding

### Content Performance Optimization

#### SEO Excellence Integration
- **Keyword Optimization**: Natural integration of target keywords and semantic variations
- **Meta Content Strategy**: Title tags, meta descriptions, and header optimization
- **Featured Snippet Optimization**: Content structured to capture voice search and featured snippets
- **Schema Markup Opportunities**: Structured data implementation suggestions

#### Engagement & Conversion Optimization
- **Social Sharing Optimization**: Compelling quotes and insights formatted for social media sharing
- **Email Marketing Integration**: Content segments suitable for newsletter repurposing
- **Lead Generation Opportunities**: Natural points for content upgrades, downloads, or opt-in offers (when applicable to the domain)
- **Community Building Elements**: Discussion starters and comment-encouraging questions

**Quality Assurance Protocol**: Every content element must meet professional editorial standards, provide genuine reader value, and align with content goals while maintaining an authentic, domain-appropriate voice.`;
}
