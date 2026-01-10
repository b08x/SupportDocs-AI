
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export const INITIAL_PLACEHOLDERS = [
    "SOP for server room power failure",
    "How to troubleshoot VPN connection timeouts",
    "Provisioning a new developer workstation",
    "LDAP schema update guide",
    "Incident report: database lock contention",
    "Zero Trust network migration plan",
    "Patching critical vulnerabilities in Linux fleet",
    "Explain DNS propagation like I'm five"
];

const KB_STYLES = `
<style>
    body { 
        font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
        line-height: 1.6; 
        color: #333; 
        max-width: 800px; 
        margin: 0 auto; 
        padding: 20px; 
    }
    h1 { color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; font-size: 24px; }
    h2 { color: #1e40af; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-top: 24px; font-size: 20px; }
    h3 { color: #1e3a8a; margin-top: 20px; font-size: 18px; }
    .metadata { 
        background: #f3f4f6; 
        padding: 10px 15px; 
        border-radius: 4px; 
        font-size: 12px; 
        color: #6b7280; 
        margin-bottom: 20px;
        display: flex;
        justify-content: space-between;
    }
    .metadata span { font-weight: bold; }
    ul, ol { margin-bottom: 16px; padding-left: 20px; }
    li { margin-bottom: 8px; }
    code { background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
    pre { background: #1e293b; color: #f8fafc; padding: 15px; border-radius: 8px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
    th { background: #f9fafb; font-weight: 600; }
    .ai-diagram { margin: 25px 0; text-align: center; background: #fff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; }
    .lesson-learned { 
        background: #fffbeb; 
        border: 1px solid #fcd34d;
        border-left: 5px solid #f59e0b; 
        padding: 15px; 
        margin: 25px 0; 
        border-radius: 0 8px 8px 0; 
    }
    .lesson-learned h4 { margin-top: 0; color: #b45309; }
</style>
`;

const RESPONSE_FORMAT = `
---
**CRITICAL OUTPUT RULES:**
1.  **Output ONLY VALID HTML**: NEVER output markdown symbols like "###", "**", or "\` \` \`". 
2.  **Start with HTML Declaration**: Your response must begin with \`<!DOCTYPE html>\` and include \`<html>\`, \`<head>\`, and \`<body>\` tags.
3.  **Include Styles**: You MUST include the following CSS block in the \`<head>\` to ensure the document matches the Service Now KB theme:
${KB_STYLES}
4.  **No Explanations**: Do not provide any conversational text before or after the HTML.
5.  **Technical Graphics**: Use inline **SVG** within \`<div class="ai-diagram">\` for any visual processes.
`;

export const KB_SOP_SYSTEM_INSTRUCTION = `You are a Senior Systems Engineer. Create a high-fidelity Service Now Standard Operating Procedure (SOP). 
Use the provided context to build a detailed, step-by-step procedure. 
Sections: Purpose, Scope, Roles/Responsibilities, Procedure, and Verification.` + RESPONSE_FORMAT;

export const KB_TROUBLESHOOTING_SYSTEM_INSTRUCTION = `You are a Tier 3 Support Engineer. Create a Service Now Troubleshooting KB Article based on the user's technical input.
Follow the "Triage-First" Linear Flow.
1.  **Title (H1)**
2.  **Metadata Header**: Use \`<div class="metadata">\` with "KB" and "Version" identifiers.
3.  **Sections (H2)**: "Introduction", "Troubleshooting Steps".
4.  **Steps (H3)**: Concrete steps derived from the context.
5.  **Actions**: Bulleted lists with UI elements in **bold** using \`<strong>\`.` + RESPONSE_FORMAT;

export const KB_HOW_TO_SYSTEM_INSTRUCTION = `You are a Technical Trainer. Create a Service Now "How-To" KB Article using the provided input as the source of truth.
1.  **Title (H1)**: Must start with "How to..."
2.  **Overview (H2)**: Summary of what the user will achieve.
3.  **Prerequisites (H2)**: Hardware/Software requirements.
4.  **Procedure (H2)**: Chronological steps.
5.  **Verification (H2)**: Confirmation steps.` + RESPONSE_FORMAT;

export const KB_ANECDOTE_SYSTEM_INSTRUCTION = `You are a grizzly, experienced IT veteran who has seen it all. 
Tell a specific, colorful 'war story' (anecdote) from your career that is inspired by the user's topic but takes a creative, non-sequitur detour. 
Do not just summarize the instructions. Tell a story about a 'time when things went weird' or an 'edge case disaster' related to this topic. 
Format it as a Service Now "Lessons Learned" article. 
Include a specific \`<div class="lesson-learned">\` section at the end with a pithy take-away.` + RESPONSE_FORMAT;

export const KB_CHECKLIST_SYSTEM_INSTRUCTION = `You are a meticulous Quality Assurance Lead. 
Create an actionable, high-density checklist for the provided topic. 
Use clean HTML tables or structured lists. Each item must be a specific check derived from the input context.` + RESPONSE_FORMAT;

export const KB_INCIDENT_SYSTEM_INSTRUCTION = `You are an SRE Lead. Create a professional Service Now Incident Report.
Sections: Summary, Timeline, Impact, Root Cause (RCA), and Action Items. 
Use the input context to populate the specific details of the failure.` + RESPONSE_FORMAT;
