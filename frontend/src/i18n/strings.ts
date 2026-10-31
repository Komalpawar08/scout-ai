/** UI string translations. Quotes stay in their original language. */

export type Lang = "en" | "hi";

export const STRINGS = {
  en: {
    // Nav / header
    appTagline: "Scout: find what's missing before you decide.",
    newResearch: "New research",
    contents: "Contents",

    // Landing hero
    heroLabel: "Information gap detection — news events & scholarships",
    heroH1Part1: "Find out what your sources",
    heroH1Italic: "don't say.",
    heroLead:
      "Give it a topic, a few links or a PDF notice. Scout reads them side by side, quotes every claim back to its page, and reports the eligibility rule, the death toll or the deadline that nobody actually states.",
    getStarted: "Get started",
    tryDemo: "Try demo",

    // Landing index section
    inEveryReport: "In every report",
    coverageMatrix: "Coverage matrix",
    coverageMatrixText:
      "Ten expected fields against every source. An empty cell reads \u201cNot found in the sources reviewed\u201d, never a guess.",
    possibleConflicts: "Possible conflicts",
    possibleConflictsText:
      "Flagged only when subject, unit, period and scope line up. A 2025\u201326 PDF does not contradict a 2026\u201327 notice.",
    freshness: "Freshness",
    freshnessText:
      "Academic cycles and closing dates for scholarships; later reporting and official updates for news.",
    evidenceConfidence: "Evidence confidence",
    evidenceConfidenceText:
      "Five scored parts per claim \u2014 authority 25, directness 25, freshness 20, relevance 15, corroboration 15.",
    claimGraph: "Claim graph",
    claimGraphText:
      "Sources to claims to gaps, with corroboration and conflict edges you can click through to the quote.",
    verificationChecklist: "Verification checklist",
    verificationChecklistText:
      "What to confirm next, ranked critical to low, exported as PDF or JSON.",

    // Form
    desk: "Desk",
    researchTopic: "Research topic",
    researchQuestion: "Research question",
    sourceUrls: "Source URLs",
    pdfDocuments: "PDF documents",
    automaticWebSearch: "Automatic web search",
    noSearchProvider: "(no search provider configured)",
    maxSources: "Max sources",
    startResearch: "Start Research",
    demoIntro: "No keys yet? Run a labelled demo on fictional sources",
    demoA: "Demo A \u00b7 Scholarship",
    demoAText: "Income limit \u20b92.5 vs \u20b93 lakh, old 2025\u201326 PDF",
    demoB: "Demo B \u00b7 News",
    demoBText: "Bridge collapse, death toll 8 vs 12 vs 15",
    addPdfText: "Add a notice or report \u2014",
    choosePdf: "choose a PDF",
    urlPlaceholder: "https://\u2026 paste one or more, press Enter",
    disclaimerFooter:
      "Results reflect only the sources reviewed and may need further verification. A conflict means two sources disagree, not that one is false. Nothing is stored: refresh or close this tab and the report is gone.",

    // Dashboard nav labels
    overview: "Overview",
    sources: "Sources",
    claimsEvidence: "Claims & Evidence",
    conflicts: "Conflicts",
    informationGaps: "Information Gaps",
    freshnessAnalysis: "Freshness Analysis",
    coverageMatrixNav: "Coverage Matrix",
    claimGraphNav: "Claim Graph",
    evidenceConfidenceNav: "Evidence Confidence",
    checklistNav: "Verification Checklist",
    exportReport: "Export Report",

    // Checklist
    checklistDesc:
      "Prioritised next steps derived from detected gaps, possible conflicts, freshness warnings and unsupported evidence. Completion state lives only in this browser tab.",
    done: "done",
    action: "Action",
    where: "Where",
    nothingToVerify: "Nothing to verify",
    nothingToVerifyDesc:
      "No gaps, conflicts or freshness issues were detected.",
    tasks: "task(s)",

    // Conflicts
    conflictsDisclaimer:
      "Possible conflicts are flagged only after checking that both claims share the same field, subject, unit/definition, period/academic cycle and scope. Scout never decides which source is correct.",
    noConflicts: "No possible conflicts detected",
    noConflictsDesc:
      "No contradictions were found among comparable claims in the sources reviewed. This does not prove the sources agree on everything.",
    scopeChecks: "Scope checks",
    recommendedVerification: "Recommended verification",
    scopeNotTitle:
      "Differences explained by scope \u2014 not flagged as conflicts",

    // Gaps
    gapsDisclaimer: (domain: string) =>
      `Gaps are measured against the ${domain} Intelligence template of expected information. \u201cNot found in the sources reviewed\u201d does not mean the information does not exist.`,
    noGaps: "No potential gaps",
    noGapsDesc:
      "Every expected field was found and corroborated in the sources reviewed.",
    whyItMatters: "Why it matters:",
    sourcesChecked: "Sources checked:",
    relatedClaims: "Related claims:",
    suggestedSearch: "Suggested search",

    // Evidence panel
    evidencePanel: "Evidence viewer",
    sourceText: "Source text",
    highlightedQuote: "Verbatim quote",
    noQuoteFound: "Quote not found verbatim in source text",
    close: "Close",
    dateOrigin: "Date origin",
    pageSection: "Page / section",

    // Ask official draft
    askOfficialDraftLabel: "AI-suggested, verify",
    askOfficialTitle: "Ask the official source",
    copyDraft: "Copy",
    copied: "Copied!",
    draftPreamble: "You can send this question to the official source to clarify:",

    // Draft templates (English)
    gapSubject: (field: string, topic: string) => `Subject: Clarification request \u2014 ${field} for ${topic}`,
    gapIntro: (topic: string) => `Dear Sir/Madam,\n\nI am researching "${topic}" and noticed this point was not stated in the sources reviewed:`,
    gapFieldLabel: "Topic",
    gapWhatFound: "Finding",
    gapWhyMatters: "Why it matters",
    gapRequest: (field: string, verification: string) => `Could you please provide the official, current information regarding "${field}"?\nSpecifically: ${verification}`,
    gapSignoff: "Thank you.\n\n[AI-suggested, verify before sending]",

    conflictSubject: (field: string, topic: string) => `Subject: Clarification request \u2014 Conflicting details on ${field} for ${topic}`,
    conflictIntro: (topic: string) => `Dear Sir/Madam,\n\nI am reviewing official information on "${topic}" and found conflicting figures across sources:`,
    conflictFieldLabel: "Field",
    conflictSource1: "Source 1 states",
    conflictSource2: "Source 2 states",
    conflictRequest: (verification: string) => `Could you please clarify which value is accurate and up to date?\nSpecifically: ${verification}`,
    conflictSignoff: "Thank you.\n\n[AI-suggested, verify before sending]",

    // Misc
    confidence: "confidence",
    newsDesk: "News desk",
    scholarshipDesk: "Scholarship desk",
    complete: "Complete",
    partialResults: "Partial results",
    failed: "Failed",
    backToInput: "\u2190 New research",
    specimenNote: "Same field, same unit, same academic year \u2014 so it is flagged. Scout does not decide which figure is right; it tells you to confirm it against the board's current notice before applying.",
  },

  hi: {
    // Nav / header
    appTagline: "Scout: निर्णय लेने से पहले जानें कि क्या छूट रहा है।",
    newResearch: "नई खोज",
    contents: "विषय-सूची",

    // Landing hero
    heroLabel: "सूचना अंतराल पहचान — समाचार घटनाएं और छात्रवृत्ति",
    heroH1Part1: "जानें आपके स्रोत क्या",
    heroH1Italic: "नहीं बताते।",
    heroLead:
      "एक विषय, कुछ लिंक या PDF नोटिस दें। Scout उन्हें साथ-साथ पढ़ता है, हर दावे को उसके पृष्ठ से उद्धृत करता है, और उन पात्रता नियमों, मृत्यु संख्याओं या समय-सीमाओं की रिपोर्ट करता है जो कोई स्रोत नहीं बताता।",
    getStarted: "शुरू करें",
    tryDemo: "डेमो देखें",

    // Landing index section
    inEveryReport: "हर रिपोर्ट में",
    coverageMatrix: "कवरेज मैट्रिक्स",
    coverageMatrixText:
      "हर स्रोत के विरुद्ध दस अपेक्षित फ़ील्ड। खाली सेल का अर्थ है \u201cसमीक्षित स्रोतों में नहीं मिला\u201d, कभी अनुमान नहीं।",
    possibleConflicts: "संभावित विरोधाभास",
    possibleConflictsText:
      "केवल तब चिह्नित किए जाते हैं जब विषय, इकाई, अवधि और दायरा मेल खाते हों। 2025–26 PDF 2026–27 नोटिस का खंडन नहीं करती।",
    freshness: "ताज़गी",
    freshnessText:
      "छात्रवृत्ति के लिए शैक्षणिक चक्र और अंतिम तिथियां; समाचार के लिए बाद की रिपोर्टिंग और आधिकारिक अपडेट।",
    evidenceConfidence: "साक्ष्य विश्वास",
    evidenceConfidenceText:
      "प्रति दावे पाँच अंकित भाग — प्राधिकार 25, प्रत्यक्षता 25, ताज़गी 20, प्रासंगिकता 15, पुष्टि 15।",
    claimGraph: "दावा ग्राफ",
    claimGraphText:
      "स्रोतों से दावों से अंतरालों तक, पुष्टि और विरोधाभास किनारों के साथ।",
    verificationChecklist: "सत्यापन चेकलिस्ट",
    verificationChecklistText:
      "आगे क्या पुष्टि करनी है, महत्वपूर्ण से लेकर निम्न तक रैंक किया गया।",

    // Form
    desk: "डेस्क",
    researchTopic: "शोध विषय",
    researchQuestion: "शोध प्रश्न",
    sourceUrls: "स्रोत URL",
    pdfDocuments: "PDF दस्तावेज़",
    automaticWebSearch: "स्वचालित वेब खोज",
    noSearchProvider: "(कोई खोज प्रदाता कॉन्फ़िगर नहीं)",
    maxSources: "अधिकतम स्रोत",
    startResearch: "खोज शुरू करें",
    demoIntro: "कोई API कुंजी नहीं? काल्पनिक स्रोतों पर लेबल किया गया डेमो चलाएं",
    demoA: "डेमो A · छात्रवृत्ति",
    demoAText: "आय सीमा ₹2.5 बनाम ₹3 लाख, पुरानी 2025–26 PDF",
    demoB: "डेमो B · समाचार",
    demoBText: "पुल ढहना, मृत्यु संख्या 8 बनाम 12 बनाम 15",
    addPdfText: "एक नोटिस या रिपोर्ट जोड़ें —",
    choosePdf: "PDF चुनें",
    urlPlaceholder: "https://… एक या अधिक पेस्ट करें, Enter दबाएं",
    disclaimerFooter:
      "परिणाम केवल समीक्षित स्रोतों को दर्शाते हैं। एक विरोधाभास का अर्थ है कि दो स्रोत असहमत हैं, न कि कोई एक गलत है। कुछ भी संग्रहीत नहीं है।",

    // Dashboard nav labels
    overview: "अवलोकन",
    sources: "स्रोत",
    claimsEvidence: "दावे और साक्ष्य",
    conflicts: "विरोधाभास",
    informationGaps: "सूचना अंतराल",
    freshnessAnalysis: "ताज़गी विश्लेषण",
    coverageMatrixNav: "कवरेज मैट्रिक्स",
    claimGraphNav: "दावा ग्राफ",
    evidenceConfidenceNav: "साक्ष्य विश्वास",
    checklistNav: "सत्यापन चेकलिस्ट",
    exportReport: "रिपोर्ट निर्यात",

    // Checklist
    checklistDesc:
      "पहचाने गए अंतरालों, संभावित विरोधाभासों, ताज़गी चेतावनियों और असमर्थित साक्ष्यों से प्राप्त प्राथमिकता वाले अगले कदम।",
    done: "पूर्ण",
    action: "कार्रवाई",
    where: "कहाँ",
    nothingToVerify: "सत्यापित करने के लिए कुछ नहीं",
    nothingToVerifyDesc:
      "कोई अंतराल, विरोधाभास या ताज़गी समस्या नहीं पाई गई।",
    tasks: "कार्य",

    // Conflicts
    conflictsDisclaimer:
      "संभावित विरोधाभास केवल तब चिह्नित किए जाते हैं जब दोनों दावे एक ही फ़ील्ड, विषय, इकाई, अवधि और दायरा साझा करते हों। Scout कभी तय नहीं करता कि कौन सा स्रोत सही है।",
    noConflicts: "कोई संभावित विरोधाभास नहीं पाया गया",
    noConflictsDesc:
      "समीक्षित स्रोतों में तुलनीय दावों के बीच कोई विरोधाभास नहीं पाया गया।",
    scopeChecks: "दायरा जाँच",
    recommendedVerification: "अनुशंसित सत्यापन",
    scopeNotTitle:
      "दायरे द्वारा समझाए गए अंतर — विरोधाभास के रूप में चिह्नित नहीं",

    // Gaps
    gapsDisclaimer: (domain: string) =>
      `अंतराल ${domain === "News" ? "समाचार" : "छात्रवृत्ति"} इंटेलिजेंस टेम्पलेट के अपेक्षित सूचना के विरुद्ध मापे जाते हैं। "समीक्षित स्रोतों में नहीं मिला" का अर्थ यह नहीं कि जानकारी मौजूद नहीं है।`,
    noGaps: "कोई संभावित अंतराल नहीं",
    noGapsDesc:
      "हर अपेक्षित फ़ील्ड समीक्षित स्रोतों में पाई और पुष्टि की गई।",
    whyItMatters: "यह क्यों मायने रखता है:",
    sourcesChecked: "जाँचे गए स्रोत:",
    relatedClaims: "संबंधित दावे:",
    suggestedSearch: "सुझाई गई खोज",

    // Evidence panel
    evidencePanel: "साक्ष्य दर्शक",
    sourceText: "स्रोत पाठ",
    highlightedQuote: "हूबहू उद्धरण",
    noQuoteFound: "स्रोत पाठ में उद्धरण शब्दशः नहीं मिला",
    close: "बंद करें",
    dateOrigin: "दिनांक मूल",
    pageSection: "पृष्ठ / खंड",

    // Ask official draft
    askOfficialDraftLabel: "AI-सुझाव, सत्यापित करें",
    askOfficialTitle: "आधिकारिक स्रोत से पूछें",
    copyDraft: "कॉपी करें",
    copied: "कॉपी हो गया!",
    draftPreamble: "स्पष्टीकरण के लिए आधिकारिक स्रोत को यह प्रश्न भेज सकते हैं:",

    // Draft templates (Hindi)
    gapSubject: (field: string, topic: string) => `विषय: स्पष्टीकरण अनुरोध \u2014 ${field} (${topic})`,
    gapIntro: (topic: string) => `आदरणीय महोदय / महोदया,\n\nमैं "${topic}" के संबंध में जानकारी जुटा रहा/रही हूँ और समीक्षित स्रोतों में यह बिंदु स्पष्ट रूप से नहीं मिला:`,
    gapFieldLabel: "विषय",
    gapWhatFound: "प्राप्त जानकारी",
    gapWhyMatters: "यह क्यों महत्वपूर्ण है",
    gapRequest: (field: string, verification: string) => `कृपया "${field}" के संबंध में आधिकारिक एवं नवीनतम जानकारी प्रदान करने की कृपा करें।\nविशेष रूप से: ${verification}`,
    gapSignoff: "सधन्यवाद।\n\n[AI-सुझाव, भेजने से पहले सत्यापित करें]",

    conflictSubject: (field: string, topic: string) => `विषय: स्पष्टीकरण अनुरोध \u2014 ${field} पर विरोधाभासी विवरण (${topic})`,
    conflictIntro: (topic: string) => `आदरणीय महोदय / महोदया,\n\nमैं "${topic}" से संबंधित आधिकारिक सूचना की समीक्षा कर रहा/रही हूँ और विभिन्न स्रोतों में विरोधाभासी विवरण मिले हैं:`,
    conflictFieldLabel: "फ़ील्ड",
    conflictSource1: "स्रोत 1 कहता है",
    conflictSource2: "स्रोत 2 कहता है",
    conflictRequest: (verification: string) => `कृपया स्पष्ट करें कि कौन सा विवरण सही और अद्यतन है?\nविशेष रूप से: ${verification}`,
    conflictSignoff: "सधन्यवाद।\n\n[AI-सुझाव, भेजने से पहले सत्यापित करें]",

    // Misc
    confidence: "विश्वास",
    newsDesk: "समाचार डेस्क",
    scholarshipDesk: "छात्रवृत्ति डेस्क",
    complete: "पूर्ण",
    partialResults: "आंशिक परिणाम",
    failed: "विफल",
    backToInput: "← नई खोज",
    specimenNote: "समान फ़ील्ड, समान इकाई, समान शैक्षणिक वर्ष — इसलिए इसे चिह्नित किया गया है। Scout यह तय नहीं करता कि कौन सा आंकड़ा सही है; यह आपको आवेदन करने से पहले वर्तमान नोटिस से पुष्टि करने की सलाह देता है।",
  },
} as const satisfies Record<Lang, Record<string, unknown>>;

export type StringKey = keyof typeof STRINGS.en;

export type Translations = {
  [K in keyof typeof STRINGS.en]: (typeof STRINGS.en)[K] extends (...args: infer A) => string
    ? (...args: A) => string
    : string;
};

