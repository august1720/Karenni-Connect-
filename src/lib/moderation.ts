export interface ModerationResult {
  isHarmful: boolean;
  flag: 'none' | 'flag_warn' | 'flag_block';
  category: string;
  reason: string;
  confidence: number;
}

export async function checkContentModeration(text: string, image?: string): Promise<ModerationResult> {
  // AI is disabled as requested by the user. Returning safe passing result immediately.
  return {
    isHarmful: false,
    flag: 'none',
    category: 'none',
    reason: 'Moderation bypassed',
    confidence: 1.0,
  };
}
