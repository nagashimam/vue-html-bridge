import type { ElementNode, TemplateChildNode } from "@vue/compiler-dom";
import type { TSTypeLiteral } from "@babel/types";

/**
 * Map of interface names to their type literal bodies
 */
export type InterfaceMap = Map<string, TSTypeLiteral>;

/**
 * Output from the bridge function containing both plain and annotated HTML
 */
export type BridgeOutput = {
  plain: string;
  annotated: string;
};

/**
 * Symbol representing an implicit else branch in v-if chains
 */
export const IMPLICIT_ELSE = Symbol("IMPLICIT_ELSE");

/**
 * A branch in a v-if/v-else-if/v-else chain
 */
export type Branch = TemplateChildNode | typeof IMPLICIT_ELSE;

/**
 * Segment representing a v-for block
 */
export type ForBlockSegment = {
  type: "FOR_BLOCK";
  node: ElementNode;
  iterator: string;
  source: string;
  inlineArray?: (string | number)[];
};

/**
 * Discriminated union of all segment types in template permutation
 */
export type Segment =
  | { type: "IF_BLOCK"; branches: Branch[] }
  | { type: "SHOW_BLOCK"; node: ElementNode }
  | ForBlockSegment
  | { type: "STATIC"; node: TemplateChildNode };

/**
 * Context for rendering, containing variable values
 */
export type RenderContext = Record<string, string | number | boolean | unknown[]>;

/**
 * Definitions of variable values extracted from script analysis
 */
export type ValueDefinitions = Record<
  string,
  (string | number | boolean)[] | unknown[][]
>;

/**
 * Result of script analysis
 */
export type ScriptAnalysis = {
  definitions: ValueDefinitions;
  staticArrays: Set<string>;
};

/**
 * Extracted value from an initializer expression
 */
export type ExtractedValue = {
  value: string | number | boolean | (string | number)[];
  isRefArray: boolean;
};

/**
 * A node in the permuted template tree
 */
export type PermutedNode = {
  node: TemplateChildNode;
  loopContext?: Record<string, string>;
  children?: PermutedNode[];
};

/**
 * Result of template permutation - an array of permuted nodes
 */
export type PermutationResult = PermutedNode[];
