/**
 * Server-side utilities for detecting update intent in user messages
 */

interface UpdateDetectionResult {
  isUpdate: boolean;
  method: string;
  confidence: number;
  detectedKeywords?: string[];
}

const UPDATE_KEYWORDS = [
  'update',
  'change',
  'modify',
  'edit',
  'adjust',
  'add',
  'remove',
  'delete',
  'revise',
  'extend',
  'shorten',
  'move',
  'shift',
  'reschedule',
  'rename',
  'replace',
  'merge',
  'combine',
  'split',
  'expand',
  'reduce',
  'push back',
  'bring forward',
  'delay',
  'accelerate',
  'instead',
  'rather',
  'also',
  'additionally',
  'now',
  'actually',
  'concise',
  'shorter',
  'longer',
  'detailed',
  'simplify',
  'make it',
  'rewrite',
  'rephrase',
  'clarify',
  'summarize',
  'elaborate',
  'more detail',
  'less detail',
];

const START_DATE_CHANGE_KEYWORDS = [
  'start date',
  'starting date',
  'begin date',
  'project start',
  'start on',
  'start from',
  'begin on',
  'kick off',
  'kickoff',
];

/**
 * Detect if a user message indicates an intent to update an existing project plan
 */
export function detectUpdateIntent(
  message: string,
  existingProject: any | null,
  hasActiveProject: boolean
): UpdateDetectionResult {
  const lowerMessage = message.toLowerCase();
  
  if (!hasActiveProject && !existingProject) {
    return {
      isUpdate: false,
      method: 'no_existing_project',
      confidence: 1.0,
    };
  }

  const detectedKeywords: string[] = [];
  
  for (const keyword of UPDATE_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      detectedKeywords.push(keyword);
    }
  }

  if (detectedKeywords.length > 0) {
    const confidence = Math.min(0.5 + detectedKeywords.length * 0.1, 0.95);
    return {
      isUpdate: true,
      method: 'keyword_detection',
      confidence,
      detectedKeywords,
    };
  }

  if (existingProject) {
    return {
      isUpdate: true,
      method: 'existing_project_context',
      confidence: 0.7,
    };
  }

  if (hasActiveProject) {
    return {
      isUpdate: true,
      method: 'active_session',
      confidence: 0.6,
    };
  }

  return {
    isUpdate: false,
    method: 'no_update_indicators',
    confidence: 0.8,
  };
}

/**
 * Detect start date change intent and determine the user's preference for handling it
 */
export interface StartDateChangeIntent {
  isStartDateChange: boolean;
  preserveEndDate: boolean | null;
  preserveDuration: boolean | null;
  isAmbiguous: boolean;
  newStartDate?: string;
}

export function detectStartDateChangeIntent(message: string): StartDateChangeIntent {
  const lowerMessage = message.toLowerCase();
  
  const isStartDateChange = START_DATE_CHANGE_KEYWORDS.some(kw => lowerMessage.includes(kw));
  
  if (!isStartDateChange) {
    return {
      isStartDateChange: false,
      preserveEndDate: null,
      preserveDuration: null,
      isAmbiguous: false,
    };
  }

  const preserveEndDatePatterns = [
    'keep end date',
    'keep the end date',
    'do not change end date',
    'don\'t change end date',
    'do not change the end date',
    'don\'t change the end date',
    'end date unchanged',
    'end date must remain',
    'same end date',
    'maintain end date',
    'preserve end date',
    'end date stays',
    'end date should stay',
    'end date should remain',
  ];

  const preserveDurationPatterns = [
    'preserve duration',
    'keep duration',
    'same duration',
    'maintain duration',
    'shift everything',
    'move everything',
    'shift all',
    'move all',
    'shift the entire',
    'move the entire',
    'slide everything',
    'push everything',
    'delay everything',
  ];

  const preserveEndDate = preserveEndDatePatterns.some(p => lowerMessage.includes(p));
  const preserveDuration = preserveDurationPatterns.some(p => lowerMessage.includes(p));

  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}|\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i;
  const dateMatch = message.match(datePattern);

  return {
    isStartDateChange: true,
    preserveEndDate: preserveEndDate || null,
    preserveDuration: preserveDuration || null,
    isAmbiguous: !preserveEndDate && !preserveDuration,
    newStartDate: dateMatch ? dateMatch[0] : undefined,
  };
}
