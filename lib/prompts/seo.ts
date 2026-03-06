import type { SEOPromptParams } from "./types";

export function buildSEOPrompt(body: SEOPromptParams): string {
  const articleTypeNote = body.articleType
    ? `\n- **Article Type**: ${body.articleType} (adapt schema and optimization accordingly)`
    : "";

  return `# Advanced SEO Content Optimization & Search Engine Mastery

## Strategic SEO Parameters
- **Primary Target Keyword**: "${body.keyword}"
- **Audience Demographic**: ${body.targetAudience}
- **Geographic Market Focus**: ${body.geoFocus}${body.socialMediaOptimization ? "\n- **Social Media Amplification**: Full social optimization required" : ""}${articleTypeNote}

**Domain-Agnostic Scope**: Optimize content from ANY domain or industry. Apply SEO best practices while adapting to domain-specific search behavior, terminology, and authority sources.

## Comprehensive SEO Enhancement Protocol

### Advanced Keyword Strategy
**Objective**: Achieve optimal keyword density and semantic relevance
- **Primary Keyword Integration**: Natural, contextual placement (1-2% density)
- **LSI Keyword Development**: Semantically related terms and phrases
- **Long-tail Keyword Targeting**: Specific, intent-driven keyword variations
- **Keyword Cannibalization Prevention**: Strategic keyword distribution
- **Search Intent Alignment**: Match content to user search behavior

### Technical SEO Architecture
**Objective**: Optimize for search engine crawling and indexing
- **Header Hierarchy Optimization**: Strategic H1, H2, H3 structure for readability and SEO
- **Meta Tag Enhancement**: Compelling title tags and meta descriptions
- **URL Structure Optimization**: Clean, keyword-rich URL recommendations
- **Internal Linking Strategy**: Strategic link placement for authority distribution
- **Schema Markup Integration**: Structured data recommendations

${body.socialMediaOptimization ? `
### Social Media SEO Integration
**Objective**: Maximize social sharing and engagement signals
- **Social-Optimized Headlines**: Platform-specific title variations
- **Shareable Content Elements**: Quote cards, statistics, and key insights
- **Hashtag Strategy**: Trending and niche hashtag recommendations
- **Social Proof Integration**: Engagement-driving elements
- **Cross-Platform Optimization**: Tailored content for different social platforms
` : ""}

### Content Quality Signals
**Objective**: Enhance E-A-T (Expertise, Authoritativeness, Trustworthiness)
- **Authority Building**: Expert quotes, citations, and credible sources
- **Content Depth**: Comprehensive coverage of topic clusters
- **User Experience Optimization**: Improved readability and engagement
- **Fresh Content Signals**: Current data, recent examples, and timely references

## Comprehensive SEO Output Requirements

### SEO-Optimized Article Content
Deliver a fully optimized version including:

#### Enhanced Article Structure
- **SEO-Optimized Title**: Primary keyword integration with compelling appeal
- **Strategic Header Hierarchy**: H2, H3 tags with keyword variations
- **Optimized Introduction**: Hook + keyword + value proposition
- **Content Body Enhancement**: Natural keyword integration throughout
- **Conclusion Optimization**: Call-to-action with keyword reinforcement

#### Technical SEO Elements
- **Meta Title Suggestions**: 3-5 variations (50-60 characters)
- **Meta Description Options**: Compelling 150-160 character descriptions
- **URL Slug Recommendations**: Clean, keyword-rich URL structures
- **Image Alt Text**: SEO-friendly descriptions for visual content
- **Internal Link Opportunities**: Strategic linking suggestions

### Advanced SEO Intelligence Report

#### Keyword Analysis & Strategy
- **Primary Keywords**: Main target keywords with search volume estimates
- **Secondary Keywords**: Supporting keyword clusters
- **Long-tail Opportunities**: Specific, low-competition keyword phrases
- **Competitor Keyword Gaps**: Underutilized keyword opportunities

#### Content Optimization Metrics
- **Keyword Density Analysis**: Optimal keyword distribution
- **Readability Score**: Flesch-Kincaid and other readability metrics
- **Content Length Optimization**: Ideal word count for topic competitiveness
- **Semantic Richness**: Topic coverage and entity optimization

#### Performance Prediction Framework
- **Search Intent Alignment**: How well content matches user intent (1-10 scale)
- **Ranking Potential Assessment**: Competitive analysis and ranking probability
- **Click-Through Rate Prediction**: Expected CTR based on title and meta optimization
- **Engagement Forecast**: Predicted user engagement metrics

### SEO Implementation Roadmap

#### On-Page SEO Checklist
- Title tag optimization (primary keyword + compelling hook)
- Meta description enhancement (value proposition + call-to-action)
- Header tag hierarchy (H1, H2, H3 with keyword variations)
- Internal linking strategy (3-5 strategic internal links)
- Image optimization (alt text, file names, compression)
- URL structure optimization (clean, keyword-rich slugs)

#### Content Enhancement Recommendations
- **Authority Signals**: Expert quotes, statistics, and credible sources
- **User Experience**: Improved formatting, bullet points, and scannable content
- **Engagement Elements**: Questions, calls-to-action, and interactive components
- **Fresh Content Signals**: Recent data, current examples, and timely references

#### Technical Implementation Notes
- **Schema Markup**: Recommended structured data types
- **Canonical URL**: Duplicate content prevention
- **Mobile Optimization**: Responsive design considerations
- **Page Speed**: Content optimization for faster loading

---

## Critical Output Requirements

### SEO-Optimized Article Content
**Deliver clean, optimized content that:**
- **Natural Integration**: SEO elements woven seamlessly into readable content
- **No Meta-Comments**: Remove any references to "SEO optimized" or "optimized for search engines"
- **Professional Presentation**: Publication-ready content without optimization labels
- **Maintained Quality**: High-quality writing that serves both users and search engines

### SEO Intelligence Report
**Provide comprehensive SEO analysis and recommendations separately**

**CRITICAL REQUIREMENT**: Output only the final SEO-optimized article content in clean markdown format, followed by the SEO intelligence report. No meta-comments about optimization in the article content itself.

**Input Data**: Content and comprehensive SEO parameters provided as JSON input.`;
}
