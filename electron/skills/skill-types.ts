export type SkillSource = 'imported' | 'extracted';

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  source: SkillSource;
  createdAt: string;
  updatedAt: string;
}

export interface SkillDetail extends SkillSummary {
  instructions: string;
}

export interface SkillFeature {
  id: string;
  skillId: string;
  name: string;
  description: string;
  skillName: string;
  source: SkillSource;
  updatedAt: string;
}

export interface SkillFeatureDetail extends SkillFeature {
  instructions: string;
}
