import type { MetadataPromptParams } from "./types";

export function buildMetadataPrompt(body: MetadataPromptParams): string {
  const title = body.title ?? "Auto-generated from content";
  const author = body.authorName ?? "Content Creator";
  const articleTypeNote = body.articleType
    ? `\n- **Article Type**: ${body.articleType} (adapt schema and tags accordingly)`
    : "";
  const formatNote = body.articleFormat ? `\n- **Publication Format**: ${body.articleFormat}` : "";

  return `# Comprehensive Metadata Generation & Digital Asset Optimization

## Content Intelligence Parameters
- **Primary Target Keyword**: "${body.keyword}"
- **Article Title**: ${title}
- **Content Category / Domain**: ${body.category}
- **Author Attribution**: ${body.authorName ?? "Not specified"}
- **Target Audience Segment**: ${body.targetAudience}${articleTypeNote}${formatNote}

**Domain-Agnostic Scope**: Generate metadata for content from ANY domain or industry. Adapt tags, hashtags, and platform optimizations to the specific vertical.

## Advanced Metadata Generation Protocol

### Strategic Metadata Objectives
**Mission**: Create comprehensive metadata that maximizes discoverability, engagement, and search performance across all digital platforms and channels.

### Metadata Architecture Requirements

#### Basic Content Metadata
- **Title Optimization**: Multiple variations for different contexts
- **Description Variants**: Platform-specific meta descriptions
- **Keyword Strategy**: Primary, secondary, and long-tail keyword integration
- **Content Classification**: Taxonomic categorization for content management

#### SEO & Search Optimization
- **Open Graph Protocol**: Complete social sharing optimization
- **Twitter Card Data**: Platform-specific social media metadata
- **Schema.org Markup**: Structured data for enhanced search results
- **Technical SEO Elements**: Canonical URLs, meta robots, and indexing directives

#### Social Media Amplification
- **Platform-Specific Optimization**: Tailored content for each social platform
- **Hashtag Strategy**: Trending and niche hashtag recommendations
- **Share Snippets**: Optimized content for social sharing
- **Engagement Optimization**: Elements designed to drive social interaction

#### Analytics & Performance Tracking
- **Content Classification**: Detailed categorization for analytics
- **Audience Segmentation**: Target demographic identification
- **Topic Clustering**: Related topic and theme identification
- **Performance Indicators**: Metrics for tracking content success

## Comprehensive JSON Output Specification

Generate a complete metadata object with the following exact structure:

\`\`\`json
{
  "basic": {
    "title": "Primary optimized title (50-60 characters)",
    "titleVariations": [
      "SEO-focused title variation",
      "Social media optimized title",
      "Email subject line version",
      "Click-optimized headline"
    ],
    "metaDescription": "Primary meta description (150-160 characters with compelling CTA)",
    "metaDescriptionVariations": [
      "Search-optimized description",
      "Social sharing description",
      "Email preview description"
    ],
    "keywords": [
      "primary-keyword",
      "secondary-keyword-1",
      "secondary-keyword-2",
      "long-tail-keyword-phrase",
      "lsi-keyword-1",
      "lsi-keyword-2"
    ],
    "tags": [
      "content-tag-1",
      "content-tag-2",
      "industry-tag",
      "topic-tag",
      "audience-tag"
    ],
    "category": "${body.category}",
    "author": "${author}"
  },
  "seo": {
    "openGraph": {
      "og:title": "Social sharing optimized title",
      "og:description": "Compelling social media description",
      "og:image": "URL_to_featured_image",
      "og:url": "canonical_article_url",
      "og:type": "article",
      "og:site_name": "Website Name",
      "article:author": "${author}",
      "article:section": "${body.category}",
      "article:tag": "primary-tag, secondary-tag"
    },
    "twitterCard": {
      "twitter:card": "summary_large_image",
      "twitter:title": "Twitter-optimized title (70 characters max)",
      "twitter:description": "Twitter-specific description (200 characters max)",
      "twitter:image": "URL_to_twitter_image",
      "twitter:creator": "@twitter_handle",
      "twitter:site": "@website_twitter"
    },
    "schema": {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Article headline for schema",
      "description": "Article description for structured data",
      "image": "URL_to_article_image",
      "author": {
        "@type": "Person",
        "name": "${author}"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Publisher Name",
        "logo": {
          "@type": "ImageObject",
          "url": "URL_to_publisher_logo"
        }
      },
      "datePublished": "2025-06-07T00:00:00Z",
      "dateModified": "2025-06-07T00:00:00Z",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "canonical_article_url"
      },
      "keywords": "comma-separated, keyword, list"
    },
    "canonical": "https://website.com/optimized-url-slug"
  },
  "social": {
    "hashtags": [
      "#PrimaryHashtag",
      "#SecondaryHashtag",
      "#IndustryHashtag",
      "#TrendingHashtag",
      "#NicheHashtag"
    ],
    "shareSnippets": {
      "facebook": {
        "title": "Facebook-optimized title",
        "description": "Facebook sharing description with engagement hook",
        "image": "URL_to_facebook_image"
      },
      "twitter": {
        "title": "Twitter thread starter",
        "description": "Tweet-length description with hashtags",
        "image": "URL_to_twitter_image"
      },
      "linkedin": {
        "title": "Professional LinkedIn title",
        "description": "LinkedIn-appropriate professional description",
        "image": "URL_to_linkedin_image"
      },
      "instagram": {
        "title": "Instagram caption starter",
        "description": "Visual-focused Instagram description",
        "image": "URL_to_instagram_image"
      }
    }
  },
  "analytics": {
    "contentType": "article",
    "audienceSegment": "${body.targetAudience}",
    "topics": [
      "Primary Topic",
      "Secondary Topic",
      "Related Theme 1",
      "Related Theme 2"
    ],
    "contentPillar": "Main content pillar category",
    "funnelStage": "awareness/consideration/decision",
    "engagementLevel": "high/medium/low",
    "shareability": "high/medium/low"
  }
}
\`\`\`

## Quality Assurance Requirements

### Validation Checklist
- **Character Limits**: All titles and descriptions within platform limits
- **Keyword Integration**: Natural keyword placement without stuffing
- **Consistency**: Consistent messaging across all metadata elements
- **Completeness**: All required fields populated with relevant content
- **Accuracy**: All metadata accurately reflects article content

### Optimization Standards
- **SEO Compliance**: Follows current SEO best practices
- **Social Optimization**: Maximizes social sharing potential
- **Technical Accuracy**: Valid schema markup and meta tags
- **Brand Alignment**: Consistent with brand voice and messaging

### Performance Indicators
- **Click-Through Rate Optimization**: Compelling titles and descriptions
- **Social Engagement**: Share-worthy content elements
- **Search Visibility**: SEO-optimized metadata structure
- **Conversion Potential**: Clear value propositions and CTAs

---

**CRITICAL OUTPUT REQUIREMENT**:
- Output ONLY valid JSON - NO markdown code blocks, NO json tags, NO explanatory text
- The response must start with { and end with }
- All strings must be properly escaped
- The JSON structure must be complete and valid for programmatic parsing

**Input Data**: Final article content and comprehensive metadata parameters provided as JSON input.`;
}
