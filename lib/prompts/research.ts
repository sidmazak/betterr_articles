import type { ResearchPromptParams } from "./types";

export function buildResearchPrompt(body: ResearchPromptParams): string {
  const articleTypeNote = body.articleType
    ? `\n- **Article Type**: ${body.articleType} (adapt research structure accordingly)`
    : "";
  const intentNote = body.contentIntent
    ? `\n- **Content Intent**: ${body.contentIntent}`
    : "";

  return `# Comprehensive Research & Strategic Topic Analysis

## Executive Brief
You are tasked with conducting an exhaustive research and analysis initiative for a high-impact content development project. This research will serve as the foundational intelligence for creating authoritative, data-driven content.

**Domain-Agnostic Scope**: This research applies to ANY domain or industry—entertainment, technology, finance, healthcare, lifestyle, news, B2B, B2C, or any other vertical. Adapt your methodology, sources, and framing to match the specific domain (${body.category}). Do not assume a particular industry; let the category and keyword guide your approach.

## Primary Research Parameters
- **Core Subject Matter**: "${body.keyword}"
- **Source URL Reference**: ${body.url ?? "No primary URL specified - conduct independent research"}
- **Content Vertical / Domain**: ${body.category}
- **Geographic Market Focus**: ${body.geoFocus}
- **Primary Target Demographic**: ${body.targetAudience}${articleTypeNote}${intentNote}

## Research Methodology & Scope
${body.includeTrendingTopics ? "**Trending Intelligence Required**: Conduct comprehensive analysis of current trending topics, viral discussions, emerging conversations, and real-time social sentiment analysis" : "**Standard Research Protocol**: Focus on established data, proven methodologies, and foundational knowledge"}

${body.contentFreshness === "Last week" ? "**Ultra-Fresh Content Priority**: Prioritize developments from the last 7 days. Source breaking news, recent studies, latest domain announcements, and immediate reactions" :
body.contentFreshness === "Last month" ? "**Recent Development Focus**: Emphasize content and insights from the past 30 days, including monthly reports, recent case studies, and evolving domain trends" :
body.contentFreshness === "Last quarter" ? "**Quarterly Focus**: Emphasize developments from the past 90 days with quarterly reports and seasonal trends" :
body.contentFreshness === "Evergreen" ? "**Evergreen Content Priority**: Focus on timeless, enduring information that remains relevant regardless of recency" :
"**Current Relevance Standard**: Balance recent developments with established authority, ensuring information accuracy and contemporary applicability"}

## Specialized Research Directives
${body.customInstructions ? `**Mission-Critical Requirements**: ${body.customInstructions}\n\nThese requirements are non-negotiable and must be integrated throughout every aspect of the research output.` : "**Standard Operating Procedure**: Follow established research protocols without additional constraints"}

## Comprehensive Deliverable Structure
Your research output must be delivered in professional markdown format with the following exhaustive sections:

### Strategic Topic Intelligence
**Objective**: Establish authoritative foundation and market positioning
- **Definitional Framework**: Provide comprehensive definitions, terminology clarification, and conceptual boundaries
- **Market Significance Analysis**: Quantify the topic's current market impact, economic implications, and strategic importance
- **Statistical Intelligence**: Present verified data points, market sizing, growth metrics, and comparative benchmarks
- **Relevance Scoring**: Assess current relevance against domain priorities and audience needs

### Competitive Landscape & Market Intelligence
**Objective**: Identify market gaps and strategic positioning opportunities
- **Content Competitor Analysis**: Audit top-performing content from domain leaders, analyzing messaging strategies, content gaps, and positioning approaches
- **Market Whitespace Identification**: Pinpoint underserved content areas, unexplored angles, and audience needs not adequately addressed by existing content
- **Competitive Advantage Mapping**: Identify unique value propositions and differentiation opportunities
- **Content Performance Benchmarking**: Analyze engagement metrics, sharing patterns, and audience response to similar content

### Real-Time Market Dynamics & Trending Intelligence
${body.includeTrendingTopics ? `
**Objective**: Capture market momentum and capitalize on trending opportunities
- **Trending Topic Analysis**: Identify and analyze current trending subtopics, hashtag performance, and viral content patterns
- **Social Media Intelligence**: Comprehensive analysis of discussions across platforms (LinkedIn, Twitter, Reddit, etc.)
- **News Cycle Integration**: Latest domain news, press releases, regulatory changes, and significant announcements
- **Influencer Sentiment Analysis**: Key opinion leader perspectives, domain expert commentary, and thought leader positioning
- **Search Trend Analysis**: Rising search queries, seasonal patterns, and emerging search intent
` : "**Established Market Analysis**: Focus on proven trends, historical patterns, and validated market dynamics"}

### Advanced Audience Psychology & Behavioral Insights
**Objective**: Develop deep audience understanding for precision content targeting
- **Pain Point Analysis**: Comprehensive mapping of audience challenges, frustrations, and unmet needs
- **Content Consumption Preferences**: Preferred formats, optimal length, engagement patterns, and platform preferences
- **Question Intelligence**: Most frequently asked questions, knowledge gaps, and information-seeking behaviors
- **Decision-Making Factors**: Key considerations that influence audience choices and behaviors
- **Engagement Triggers**: Psychological and emotional drivers that prompt sharing, commenting, and conversion

### Strategic Content Opportunity Matrix
**Objective**: Identify high-impact content development opportunities
- **Unique Angle Development**: Proprietary perspectives, contrarian viewpoints, and fresh approaches to established topics
- **Controversy & Debate Mapping**: Identify productive controversies, domain debates, and discussion-worthy perspectives
- **Expert Authority Opportunities**: Potential for expert interviews, thought leader quotes, and authoritative sourcing
- **Content Series Potential**: Opportunities for multi-part content, pillar page development, and topic clustering
- **Multimedia Integration Points**: Visual content opportunities, infographic potential, and interactive element suggestions

### Research Methodology & Source Validation
**Objective**: Ensure research integrity and credibility
- **Primary Source Documentation**: List of authoritative sources, domain reports, and verified data providers
- **Fact-Checking Protocol**: Verification methods used and cross-reference sources
- **Recency Validation**: Publication dates, data freshness, and information currency assessment
- **Bias Assessment**: Potential source bias identification and mitigation strategies

### Executive Summary & Strategic Recommendations
**Objective**: Provide actionable intelligence for content strategy
- **Key Research Findings**: Top 5-7 most significant insights discovered
- **Strategic Recommendations**: Specific guidance for content development approach
- **Risk Assessment**: Potential challenges, sensitive topics, or areas requiring careful handling
- **Success Metrics Suggestion**: Proposed KPIs and measurement frameworks for content performance

**Data Integration Protocol**: All research inputs will be processed through advanced analytical frameworks to ensure comprehensive coverage and strategic alignment with content goals across any domain.`;
}
