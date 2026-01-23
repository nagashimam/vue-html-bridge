/**
 * A validation violation reported by markuplint
 */
export type Violation = {
  ruleId: string;
  message: string;
  line: number;
  col: number;
  raw: string;
  relatedInfo: string;
};
