import type { FactCheckPromptParams } from "./types";

export function buildFactCheckPrompt(body: FactCheckPromptParams): string {
  const citationNote = body.citationStyle
    ? `\n- **Citation Style**: ${body.citationStyle}`
    : "";
  const articleTypeNote = body.articleType
    ? `\n- **Article Type**: ${body.articleType} (select domain-appropriate sources)`
    : "";

  return `# Content Verification & Accuracy Enhancement

## Verification Parameters
- **Primary Keyword**: "${body.keyword}"
- **Content Category / Domain**: ${body.category}${citationNote}${articleTypeNote}

**Domain-Agnostic Scope**: Fact-check content from ANY domain or industry. Use domain-appropriate authoritative sources (e.g., trade publications, academic journals, official records, industry bodies) based on the article's category.

## Critical Verification Requirements

### Comprehensive Fact-Checking Process
**Objective**: Ensure 100% factual accuracy while maintaining content flow and readability

#### Verification Standards
- **Statistical Accuracy**: Verify all numbers, percentages, dates, and quantitative claims
- **Source Credibility**: Cross-reference information with authoritative, recent sources
- **Attribution Verification**: Confirm all quotes, citations, and references are accurate
- **Timeline Accuracy**: Ensure all dates, sequences, and chronological information is correct
- **Technical Accuracy**: Verify domain-specific terms, processes, and technical details

#### Error Identification & Correction
- **Factual Inconsistencies**: Identify and correct any inaccurate information
- **Outdated Information**: Update any obsolete data or references
- **Misleading Statements**: Clarify or correct potentially misleading claims
- **Source Misattribution**: Fix any incorrect attributions or citations

## Output Requirements

### Corrected Article Content
**Deliver the complete corrected article with:**
- **Clean, Readable Format**: Standard markdown formatting without meta-comments
- **Factual Accuracy**: All errors corrected with verified information
- **Maintained Flow**: Original tone, style, and structure preserved
- **No Verification Labels**: Remove any "fact-checked" or "verified" labels from content

### Professional Fact-Check Implementation
**Industry-Standard Fact-Checking with Academic Footnotes:**

#### Inline Footnote Integration
- **Numerical Footnotes**: Add superscript numbers [^1] after verified claims
- **Source Attribution**: Each footnote links to authoritative sources
- **Professional Format**: Follow academic citation standards
- **Seamless Integration**: Footnotes enhance credibility without disrupting flow

#### Footnote Reference Section
**At the end of the article, include comprehensive footnote references:**

---

### References & Fact-Check Sources

[^1]: [Source Title] - [Publication/Organization], [Date]. [URL if available]
[^2]: [Source Title] - [Publication/Organization], [Date]. [URL if available]
[^3]: [Additional sources as needed]

**Verification Standards:**
- All statistical claims verified against primary sources
- Dates and timelines cross-referenced with authoritative records
- Expert quotes confirmed through original publications
- Technical specifications validated through official documentation

---

#### Correction Summary (if corrections were made)
<details>
<summary>Editorial Corrections</summary>

**Factual Updates Made:**
- [Specific corrections with before/after details]
- [Updated statistics with source references]
- [Corrected dates/timelines with verification]

**Primary Verification Sources:**
- [Government databases and official records]
- [Academic institutions and research papers]
- [Domain authorities and expert publications]
- [News agencies with established credibility]

</details>

## Critical Output Rules
1. **NO fact-check sections** in the main article content
2. **NO verification labels** or meta-comments in the article
3. **Clean article content** that reads naturally
4. **Correction summary** only appears in the details block if changes were made
5. **If no corrections needed**, output the original article without any details block

**Input Data**: Content requiring fact-checking and verification parameters provided as JSON input.`;
}
