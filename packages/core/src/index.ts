import {
  parse as parseSfc,
  compileScript,
  type SFCDescriptor,
  type BindingMetadata,
} from "@vue/compiler-sfc";
import { BindingTypes } from "@vue/compiler-core";
import {
  parse as parseDom,
  NodeTypes,
  ElementNode,
  TemplateChildNode,
  TextNode,
  AttributeNode,
  DirectiveNode,
  SimpleExpressionNode,
} from "@vue/compiler-dom";
import type {
  TSType,
  TSUnionType,
  TSLiteralType,
  TSTypeLiteral,
  TSPropertySignature,
  TSTypeReference,
  Expression,
  CallExpression,
  ObjectExpression,
  ObjectPattern,
  ArrayExpression,
  Identifier,
  Statement,
} from "@babel/types";
import prettierSync from "@prettier/sync";
import {
  IMPLICIT_ELSE,
  type BridgeOutput,
  type Branch,
  type ForBlockSegment,
  type Segment,
  type RenderContext,
  type ValueDefinitions,
  type ScriptAnalysis,
  type ExtractedValue,
  type PermutedNode,
  type PermutationResult,
  type InterfaceMap,
} from "./types.js";

export type { BridgeOutput } from "./types.js";

const { format: formatSync } = prettierSync;

// ==========================================
// 1. Constants
// ==========================================

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

// ==========================================
// 2. Logic: Analyzer (Props & Variables)
// ==========================================

const extractValuesFromType = (
  typeNode: TSType | null | undefined
): (string | number | boolean)[] | null => {
  if (!typeNode) return null;
  if (typeNode.type === "TSUnionType") {
    const unionNode = typeNode as TSUnionType;
    const values: (string | number | boolean)[] = [];
    unionNode.types.forEach((t: TSType) => {
      if (t.type === "TSLiteralType") {
        const literal = (t as TSLiteralType).literal;
        if ("value" in literal)
          values.push(literal.value as string | number | boolean);
      }
      if (t.type === "TSBooleanKeyword") values.push(true, false);
    });
    return values.length > 0 ? values : null;
  }
  if (typeNode.type === "TSLiteralType") {
    const literal = (typeNode as TSLiteralType).literal;
    if ("value" in literal) return [literal.value as string | number | boolean];
    return null;
  }
  if (typeNode.type === "TSBooleanKeyword") return [true, false];
  return null;
};

const parseArrayExpression = (
  arrayNode: Expression | null | undefined
): (string | number)[] | null => {
  if (!arrayNode || arrayNode.type !== "ArrayExpression") return null;
  const arr = arrayNode as ArrayExpression;
  const items: (string | number)[] = [];
  for (const el of arr.elements) {
    if (el && el.type === "StringLiteral") items.push(el.value);
    else if (el && el.type === "NumericLiteral") items.push(el.value);
  }
  return items.length > 0 ? items : null;
};

const extractInitialValue = (
  initNode: Expression | null | undefined
): ExtractedValue | null => {
  if (!initNode) return null;
  if (
    ["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(
      initNode.type
    )
  ) {
    const literalNode = initNode as { value: string | number | boolean };
    return { value: literalNode.value, isRefArray: false };
  }
  if (initNode.type === "CallExpression") {
    const callExpr = initNode as CallExpression;
    if (
      callExpr.callee.type === "Identifier" &&
      callExpr.callee.name === "ref"
    ) {
      const arg = callExpr.arguments[0];
      if (arg && arg.type !== "SpreadElement") {
        if (
          ["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(
            arg.type
          )
        ) {
          const literalArg = arg as { value: string | number | boolean };
          return { value: literalArg.value, isRefArray: false };
        }
        // Handle ref arrays: ref([1, 2, 3])
        const refArray = parseArrayExpression(arg as Expression);
        if (refArray) return { value: refArray, isRefArray: true };
      }
    }
  }
  if (initNode.type === "ArrayExpression") {
    const items = parseArrayExpression(initNode);
    if (items) return { value: items, isRefArray: false };
  }
  return null;
};

const collectInterfaces = (ast: Statement[]): InterfaceMap => {
  const interfaces: InterfaceMap = new Map();
  for (const stmt of ast) {
    if (stmt.type === "TSInterfaceDeclaration" && stmt.id?.name) {
      // TSInterfaceBody has `body` array, TSTypeLiteral has `members` array
      // Convert TSInterfaceBody to TSTypeLiteral-like structure
      const interfaceBody = stmt.body as { body: TSTypeLiteral["members"] };
      const typeLiteral = {
        type: "TSTypeLiteral",
        members: interfaceBody.body,
      } as TSTypeLiteral;
      interfaces.set(stmt.id.name, typeLiteral);
    }
  }
  return interfaces;
};

const resolvePropsType = (
  typeParam: TSType | undefined,
  interfaces: InterfaceMap
): TSTypeLiteral | null => {
  if (!typeParam) return null;

  // Inline: defineProps<{ status: 'open' | 'closed' }>()
  if (typeParam.type === "TSTypeLiteral") {
    return typeParam as TSTypeLiteral;
  }

  // Reference: defineProps<Props>()
  if (typeParam.type === "TSTypeReference") {
    const typeName = (typeParam as TSTypeReference).typeName;
    if (typeName.type === "Identifier") {
      return interfaces.get(typeName.name) ?? null;
    }
  }

  return null;
};

const findDefinePropsCall = (
  node: Expression
): { call: CallExpression; defaults?: ObjectExpression } | null => {
  // Pattern 1: defineProps<T>()
  if (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "defineProps"
  ) {
    return { call: node as CallExpression };
  }

  // Pattern 2: withDefaults(defineProps<T>(), { ... })
  if (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "withDefaults"
  ) {
    const definePropsArg = node.arguments[0];
    if (definePropsArg?.type === "CallExpression") {
      const defaults = node.arguments[1];
      return {
        call: definePropsArg as CallExpression,
        defaults:
          defaults?.type === "ObjectExpression"
            ? (defaults as ObjectExpression)
            : undefined,
      };
    }
  }

  return null;
};

const extractDefaultValue = (
  defaults: ObjectExpression | undefined,
  propName: string
): (string | number | boolean)[] | null => {
  if (!defaults) return null;

  for (const prop of defaults.properties) {
    if (prop.type !== "ObjectProperty") continue;
    if (prop.key.type !== "Identifier" || prop.key.name !== propName) continue;

    const value = prop.value;
    if (value.type === "StringLiteral") return [value.value];
    if (value.type === "NumericLiteral") return [value.value];
    if (value.type === "BooleanLiteral") return [value.value];
  }
  return null;
};

const extractDestructureDefaults = (
  pattern: ObjectPattern
): Map<string, string | number | boolean> => {
  const defaults = new Map<string, string | number | boolean>();

  for (const prop of pattern.properties) {
    if (prop.type !== "ObjectProperty") continue;
    if (prop.key.type !== "Identifier") continue;

    const propName = prop.key.name;

    // Check if value is AssignmentPattern (has default value)
    if (prop.value.type === "AssignmentPattern") {
      const defaultExpr = prop.value.right;
      if (defaultExpr.type === "StringLiteral") {
        defaults.set(propName, defaultExpr.value);
      } else if (defaultExpr.type === "NumericLiteral") {
        defaults.set(propName, defaultExpr.value);
      } else if (defaultExpr.type === "BooleanLiteral") {
        defaults.set(propName, defaultExpr.value);
      }
    }
  }

  return defaults;
};

const processPropsFromTypeLiteral = (
  typeLiteral: TSTypeLiteral,
  definitions: ValueDefinitions,
  defaults?: ObjectExpression,
  destructureDefaults?: Map<string, string | number | boolean>
): void => {
  typeLiteral.members.forEach((member) => {
    if (member.type !== "TSPropertySignature") return;
    const propSig = member as TSPropertySignature;
    if (propSig.key.type !== "Identifier") return;

    const key = (propSig.key as Identifier).name;
    const typeAnn = propSig.typeAnnotation?.typeAnnotation as
      | TSType
      | undefined;
    const typeValues = extractValuesFromType(typeAnn);

    if (typeValues) {
      definitions[key] = typeValues;
    } else {
      // Check destructure defaults first, then withDefaults
      const destructureDefault = destructureDefaults?.get(key);
      if (destructureDefault !== undefined) {
        definitions[key] = [destructureDefault];
      } else {
        const defaultValue = extractDefaultValue(defaults, key);
        definitions[key] = defaultValue ?? [`mock-${key}`];
      }
    }
  });
};

const processVariableWithBindings = (
  stmt: Statement,
  bindings: BindingMetadata,
  definitions: ValueDefinitions,
  staticArrays: Set<string>,
  interfaces: InterfaceMap
): void => {
  if (stmt.type !== "VariableDeclaration") return;

  for (const decl of stmt.declarations) {
    // Handle destructured props: const { foo } = defineProps<...>()
    if (decl.id.type === "ObjectPattern" && decl.init) {
      const propsResult = findDefinePropsCall(decl.init);
      if (propsResult) {
        const typeParam = propsResult.call.typeParameters?.params[0];
        const typeLiteral = resolvePropsType(typeParam, interfaces);
        if (typeLiteral) {
          const destructureDefaults = extractDestructureDefaults(
            decl.id as ObjectPattern
          );
          processPropsFromTypeLiteral(
            typeLiteral,
            definitions,
            propsResult.defaults,
            destructureDefaults
          );
        }
        continue;
      }
    }

    // Handle regular variable declarations
    if (decl.id.type !== "Identifier") continue;

    const name = decl.id.name;
    const bindingType = bindings[name];

    // Skip non-setup bindings
    if (
      bindingType === undefined ||
      bindingType === BindingTypes.LITERAL_CONST
    ) {
      // Process regular variables
      const identifier = decl.id as Identifier;
      const typeAnn = identifier.typeAnnotation;
      if (typeAnn?.type === "TSTypeAnnotation") {
        const typeValues = extractValuesFromType(typeAnn.typeAnnotation);
        if (typeValues) {
          definitions[name] = typeValues;
          continue;
        }
      }

      const extracted = extractInitialValue(decl.init);
      if (extracted === null) continue;

      if (Array.isArray(extracted.value)) {
        definitions[name] = [extracted.value] as unknown[][];
        if (!extracted.isRefArray) staticArrays.add(name);
      } else {
        definitions[name] = [extracted.value];
      }
      continue;
    }

    // Handle props binding
    if (bindingType === BindingTypes.PROPS) {
      // Props are processed separately via defineProps
      continue;
    }

    // Handle setup refs and other setup bindings
    if (
      bindingType === BindingTypes.SETUP_REF ||
      bindingType === BindingTypes.SETUP_MAYBE_REF ||
      bindingType === BindingTypes.SETUP_LET ||
      bindingType === BindingTypes.SETUP_CONST
    ) {
      const identifier = decl.id as Identifier;
      const typeAnn = identifier.typeAnnotation;
      if (typeAnn?.type === "TSTypeAnnotation") {
        const typeValues = extractValuesFromType(typeAnn.typeAnnotation);
        if (typeValues) {
          definitions[name] = typeValues;
          continue;
        }
      }

      const extracted = extractInitialValue(decl.init);
      if (extracted === null) continue;

      if (Array.isArray(extracted.value)) {
        definitions[name] = [extracted.value] as unknown[][];
        if (!extracted.isRefArray) staticArrays.add(name);
      } else {
        definitions[name] = [extracted.value];
      }
    }
  }
};

const processDefinePropsStatement = (
  stmt: Statement,
  definitions: ValueDefinitions,
  interfaces: InterfaceMap
): void => {
  if (stmt.type !== "ExpressionStatement") return;

  const propsResult = findDefinePropsCall(stmt.expression);
  if (!propsResult) return;

  const typeParam = propsResult.call.typeParameters?.params[0];
  const typeLiteral = resolvePropsType(typeParam, interfaces);
  if (typeLiteral) {
    processPropsFromTypeLiteral(typeLiteral, definitions, propsResult.defaults);
  }
};

const processVariableDefineProps = (
  stmt: Statement,
  definitions: ValueDefinitions,
  interfaces: InterfaceMap
): void => {
  if (stmt.type !== "VariableDeclaration") return;

  for (const decl of stmt.declarations) {
    if (!decl.init) continue;

    const propsResult = findDefinePropsCall(decl.init);
    if (!propsResult) continue;

    const typeParam = propsResult.call.typeParameters?.params[0];
    const typeLiteral = resolvePropsType(typeParam, interfaces);
    if (typeLiteral) {
      processPropsFromTypeLiteral(typeLiteral, definitions, propsResult.defaults);
    }
  }
};

const analyzeScript = (descriptor: SFCDescriptor): ScriptAnalysis => {
  const definitions: ValueDefinitions = {};
  const staticArrays = new Set<string>();

  if (!descriptor.scriptSetup?.content?.trim()) {
    return { definitions, staticArrays };
  }

  try {
    const compiled = compileScript(descriptor, { id: "analysis" });
    const { bindings, scriptSetupAst } = compiled;

    if (!scriptSetupAst) {
      return { definitions, staticArrays };
    }

    // Collect interfaces for type resolution
    const interfaces = collectInterfaces(scriptSetupAst);

    // Process defineProps statements (both expression and variable forms)
    for (const stmt of scriptSetupAst) {
      processDefinePropsStatement(stmt, definitions, interfaces);
      processVariableDefineProps(stmt, definitions, interfaces);
    }

    // Walk AST using bindings as guide for variables
    if (bindings) {
      for (const stmt of scriptSetupAst) {
        processVariableWithBindings(
          stmt,
          bindings,
          definitions,
          staticArrays,
          interfaces
        );
      }
    }
  } catch {
    // Silently ignore compile errors
  }

  return { definitions, staticArrays };
};

// ==========================================
// 3. Logic: Context Permutation (Cartesian)
// ==========================================

const generateContexts = (definitions: ValueDefinitions): RenderContext[] => {
  const keys = Object.keys(definitions);
  if (keys.length === 0) return [{}];

  const results: RenderContext[] = [];

  const recurse = (index: number, current: RenderContext): void => {
    if (index === keys.length) {
      results.push(current);
      return;
    }
    const key = keys[index];
    const values = definitions[key];
    for (const val of values) {
      recurse(index + 1, { ...current, [key]: val as RenderContext[string] });
    }
  };
  recurse(0, {});
  return results;
};

// ==========================================
// 4. Logic: Template Permutation (Recursive)
// ==========================================

const parseArrayPart = (part: string): string | number | null => {
  if (!part) return null;
  const num = Number(part);
  if (!isNaN(num)) return num;

  const isQuoted =
    (part.startsWith("'") && part.endsWith("'")) ||
    (part.startsWith('"') && part.endsWith('"'));
  return isQuoted ? part.slice(1, -1) : part;
};

const parseInlineArray = (arrayExpr: string): (string | number)[] => {
  const inner = arrayExpr.slice(1, -1).trim();
  if (!inner) return [];

  const parts = inner.split(",").map((s) => s.trim());
  const items: (string | number)[] = [];

  for (const part of parts) {
    const parsed = parseArrayPart(part);
    if (parsed !== null) items.push(parsed);
  }
  return items;
};

const collectIfBranches = (
  nodes: TemplateChildNode[],
  startIndex: number
): { branches: Branch[]; nextIndex: number } => {
  const branches: Branch[] = [nodes[startIndex]];
  let j = startIndex + 1;
  while (j < nodes.length) {
    const nextNode = nodes[j];
    if (nextNode.type !== NodeTypes.ELEMENT) break;

    const elseIfDir = nextNode.props.find((p) => p.name === "else-if");
    const elseDir = nextNode.props.find((p) => p.name === "else");

    if (elseIfDir || elseDir) {
      branches.push(nextNode);
      j++;
    } else {
      break;
    }
  }
  return { branches, nextIndex: j };
};

const findIfBlock = (
  nodes: TemplateChildNode[],
  startIndex: number
): { block: Segment; newIndex: number } | null => {
  const node = nodes[startIndex];
  if (node.type !== NodeTypes.ELEMENT) return null;

  if (!node.props.some((p) => p.name === "if")) return null;

  const { branches, nextIndex } = collectIfBranches(nodes, startIndex);
  const lastBranch = branches[branches.length - 1];

  if (
    lastBranch !== IMPLICIT_ELSE &&
    lastBranch.type === NodeTypes.ELEMENT &&
    !lastBranch.props.some((p) => p.name === "else")
  ) {
    branches.push(IMPLICIT_ELSE);
  }

  return { block: { type: "IF_BLOCK", branches }, newIndex: nextIndex };
};

const createForSegment = (node: ElementNode): Segment | null => {
  const forDir = node.props.find((p) => p.name === "for");
  if (!forDir) return null;

  const forExp = forDir as DirectiveNode;
  const expContent = (forExp.exp as SimpleExpressionNode)?.content || "";
  const match = expContent.match(/(\w+)\s+in\s+(\w+|\[.*\])/);

  if (!match) return { type: "STATIC", node };

  const iterator = match[1];
  const sourceExpr = match[2];
  let inlineArray: (string | number)[] | undefined;

  if (sourceExpr.startsWith("[") && sourceExpr.endsWith("]")) {
    inlineArray = parseInlineArray(sourceExpr);
  }

  return {
    type: "FOR_BLOCK",
    node,
    iterator,
    source: sourceExpr,
    inlineArray,
  };
};

const processElementSegment = (node: ElementNode): Segment => {
  if (node.props.some((p) => p.name === "show")) {
    return { type: "SHOW_BLOCK", node };
  }
  return createForSegment(node) ?? { type: "STATIC", node };
};

const groupSegments = (nodes: TemplateChildNode[]): Segment[] => {
  const segments: Segment[] = [];
  let i = 0;

  while (i < nodes.length) {
    const ifBlockResult = findIfBlock(nodes, i);
    if (ifBlockResult) {
      segments.push(ifBlockResult.block);
      i = ifBlockResult.newIndex;
      continue;
    }

    const node = nodes[i];
    if (node.type === NodeTypes.ELEMENT) {
      segments.push(processElementSegment(node));
    } else {
      segments.push({ type: "STATIC", node });
    }
    i++;
  }

  return segments;
};

const handleStaticSegment = (
  seg: { type: "STATIC"; node: TemplateChildNode },
  context: RenderContext,
  results: PermutationResult[],
  staticArrays: Set<string>
): PermutationResult[] => {
  const nextResults: PermutationResult[] = [];
  const node = seg.node;

  if (node.type === NodeTypes.ELEMENT) {
    const childPerms = permuteNodes(node.children, context, staticArrays);
    for (const res of results) {
      for (const childPerm of childPerms) {
        nextResults.push([
          ...res,
          { node, loopContext: undefined, children: childPerm },
        ]);
      }
    }
  } else {
    for (const res of results) {
      nextResults.push([...res, { node, loopContext: undefined }]);
    }
  }
  return nextResults;
};

const processIfBranch = (
  branch: Branch,
  res: PermutationResult,
  context: RenderContext,
  staticArrays: Set<string>
): PermutationResult[] => {
  if (branch === IMPLICIT_ELSE) {
    return [[...res]];
  }

  if (branch.type !== NodeTypes.ELEMENT) {
    return [[...res, { node: branch, loopContext: undefined }]];
  }

  const el = branch as ElementNode;
  const childPerms = permuteNodes(el.children, context, staticArrays);
  const branchResults: PermutationResult[] = [];

  for (const childPerm of childPerms) {
    if (el.tag === "template") {
      branchResults.push([...res, ...childPerm]);
    } else {
      branchResults.push([
        ...res,
        { node: el, loopContext: undefined, children: childPerm },
      ]);
    }
  }
  return branchResults;
};

const handleIfBlockSegment = (
  seg: { type: "IF_BLOCK"; branches: Branch[] },
  context: RenderContext,
  results: PermutationResult[],
  staticArrays: Set<string>
): PermutationResult[] => {
  const nextResults: PermutationResult[] = [];
  for (const res of results) {
    for (const branch of seg.branches) {
      nextResults.push(...processIfBranch(branch, res, context, staticArrays));
    }
  }
  return nextResults;
};

const handleShowBlockSegment = (
  seg: { type: "SHOW_BLOCK"; node: ElementNode },
  context: RenderContext,
  results: PermutationResult[],
  staticArrays: Set<string>
): PermutationResult[] => {
  const nextResults: PermutationResult[] = [];
  const childPerms = permuteNodes(seg.node.children, context, staticArrays);

  for (const res of results) {
    for (const childPerm of childPerms) {
      nextResults.push([
        ...res,
        { node: seg.node, loopContext: undefined, children: childPerm },
      ]);
    }
    nextResults.push([...res]); // The hidden case
  }
  return nextResults;
};

const processKnownArray = (
  seg: {
    node: ElementNode;
    iterator: string;
    source: string;
  },
  sourceArray: unknown[],
  results: PermutationResult[],
  context: RenderContext,
  staticArrays: Set<string>
): PermutationResult[] => {
  const nextResults: PermutationResult[] = [];
  const childPerms = permuteNodes(seg.node.children, context, staticArrays);

  for (const res of results) {
    for (const childPerm of childPerms) {
      const copies: PermutedNode[] = [];
      for (const item of sourceArray) {
        copies.push({
          node: seg.node,
          loopContext: { [seg.iterator]: String(item) },
          children: childPerm,
        });
      }
      nextResults.push([...res, ...copies]);
    }
  }
  return nextResults;
};

const createMockNode = (
  node: ElementNode,
  iterator: string,
  mockValue: string,
  childPerm: PermutedNode[]
): PermutedNode => ({
  node,
  loopContext: { [iterator]: mockValue },
  children: childPerm,
});

const processUnknownArray = (
  seg: { node: ElementNode; iterator: string; source: string },
  results: PermutationResult[],
  context: RenderContext,
  staticArrays: Set<string>
): PermutationResult[] => {
  const nextResults: PermutationResult[] = [];
  const mockValue = `mock-${seg.iterator}`;
  const childPerms = permuteNodes(seg.node.children, context, staticArrays);

  for (const res of results) {
    for (const childPerm of childPerms) {
      // Single item case
      nextResults.push([
        ...res,
        createMockNode(seg.node, seg.iterator, mockValue, childPerm),
      ]);
      // Plural (2 items) case
      const copies = [0, 1].map(() =>
        createMockNode(seg.node, seg.iterator, mockValue, childPerm)
      );
      nextResults.push([...res, ...copies]);
    }
  }
  return nextResults;
};

const handleForBlockSegment = (
  seg: ForBlockSegment,
  context: RenderContext,
  results: PermutationResult[],
  staticArrays: Set<string>
): PermutationResult[] => {
  const nextResults: PermutationResult[] = [];
  const sourceArray = seg.inlineArray ?? context[seg.source];
  const isKnownArray = Array.isArray(sourceArray) && sourceArray.length > 0;
  const isStaticArray =
    seg.inlineArray !== undefined || staticArrays.has(seg.source);

  // Empty case
  if (!isStaticArray) {
    for (const res of results) {
      nextResults.push([...res]);
    }
  }

  if (isKnownArray) {
    nextResults.push(
      ...processKnownArray(
        seg,
        sourceArray as unknown[],
        results,
        context,
        staticArrays
      )
    );
  } else {
    nextResults.push(
      ...processUnknownArray(seg, results, context, staticArrays)
    );
  }
  return nextResults;
};

const permuteNodes = (
  nodes: TemplateChildNode[],
  context: RenderContext,
  staticArrays: Set<string>
): PermutationResult[] => {
  const segments = groupSegments(nodes);
  let results: PermutationResult[] = [[]];

  for (const seg of segments) {
    switch (seg.type) {
      case "STATIC":
        results = handleStaticSegment(seg, context, results, staticArrays);
        break;
      case "IF_BLOCK":
        results = handleIfBlockSegment(seg, context, results, staticArrays);
        break;
      case "SHOW_BLOCK":
        results = handleShowBlockSegment(seg, context, results, staticArrays);
        break;
      case "FOR_BLOCK":
        results = handleForBlockSegment(seg, context, results, staticArrays);
        break;
    }
  }
  return results;
};

// ==========================================
// 5. Logic: Renderer
// ==========================================

const MOCK_VALUE = "{{unresolved}}";

const resolveValue = (
  key: string,
  context: RenderContext,
  loopContext: Record<string, string>
): string => {
  if (loopContext[key] !== undefined) return loopContext[key];
  if (context[key] !== undefined) return String(context[key]);
  return MOCK_VALUE;
};

const addAnnotationAttrs = (
  prop: AttributeNode | DirectiveNode,
  attrs: string[],
  attrName: string
) => {
  attrs.push(`data-${attrName}-start-line="${prop.loc.start.line}"`);
  attrs.push(`data-${attrName}-start-column="${prop.loc.start.column}"`);
  attrs.push(`data-${attrName}-end-line="${prop.loc.end.line}"`);
  attrs.push(`data-${attrName}-end-column="${prop.loc.end.column}"`);
};

const processStaticAttribute = (
  prop: AttributeNode,
  attrs: string[],
  annotated: boolean
): void => {
  attrs.push(`${prop.name}="${prop.value?.content || ""}"`);
  if (annotated) addAnnotationAttrs(prop, attrs, prop.name);
};

const processBindDirective = (
  prop: DirectiveNode,
  attrs: string[],
  context: RenderContext,
  loopContext: Record<string, string>,
  annotated: boolean
): void => {
  if (prop.arg?.type !== NodeTypes.SIMPLE_EXPRESSION) return;
  const attrName = prop.arg.content;
  const varName = (prop.exp as SimpleExpressionNode)?.content;
  const val = varName
    ? resolveValue(varName, context, loopContext)
    : MOCK_VALUE;
  attrs.push(`${attrName}="${val}"`);
  if (annotated) addAnnotationAttrs(prop, attrs, attrName);
};

const addElementAnnotations = (el: ElementNode, attrs: string[]): void => {
  attrs.push(`data-start-line="${el.loc.start.line}"`);
  attrs.push(`data-start-column="${el.loc.start.column}"`);
  attrs.push(`data-end-line="${el.loc.end.line}"`);
  attrs.push(`data-end-column="${el.loc.end.column}"`);
};

const renderAttributes = (
  el: ElementNode,
  context: RenderContext,
  loopContext: Record<string, string>,
  annotated: boolean
): string => {
  const attrs: string[] = [];
  if (annotated) addElementAnnotations(el, attrs);

  for (const prop of el.props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      processStaticAttribute(prop, attrs, annotated);
    } else if (prop.type === NodeTypes.DIRECTIVE && prop.name === "bind") {
      processBindDirective(prop, attrs, context, loopContext, annotated);
    }
  }
  return attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
};

const renderPermutedNode = (
  pn: PermutedNode,
  context: RenderContext,
  loopContext: Record<string, string>,
  annotated: boolean
): string => {
  const node = pn.node;
  const currentLoopContext = { ...loopContext, ...(pn.loopContext || {}) };

  if (node.type === NodeTypes.TEXT) {
    return (node as TextNode).content.trim() || "";
  }
  if (node.type === NodeTypes.COMMENT) return "";

  if (node.type === NodeTypes.INTERPOLATION) {
    const key = (node.content as SimpleExpressionNode).content.trim();
    return resolveValue(key, context, currentLoopContext);
  }

  if (node.type === NodeTypes.ELEMENT) {
    const el = node as ElementNode;
    const attrStr = renderAttributes(
      el,
      context,
      currentLoopContext,
      annotated
    );

    if (VOID_ELEMENTS.has(el.tag)) return `<${el.tag}${attrStr}>`;

    const childrenStr = pn.children
      ? pn.children
          .map((child) =>
            renderPermutedNode(child, context, currentLoopContext, annotated)
          )
          .join("")
      : "";

    return `<${el.tag}${attrStr}>${childrenStr}</${el.tag}>`;
  }
  return "";
};

const renderNodesToHtml = (
  nodes: PermutedNode[],
  context: RenderContext,
  annotated: boolean
): string => {
  return nodes
    .map((pn) => renderPermutedNode(pn, context, {}, annotated))
    .join("");
};

// ==========================================
// 6. HTML Formatting
// ==========================================

const formatHtml = (html: string): string => {
  if (!html.trim()) return html;

  try {
    return formatSync(html, {
      parser: "html",
      printWidth: 80,
      htmlWhitespaceSensitivity: "ignore",
    });
  } catch {
    return html;
  }
};

// ==========================================
// 7. Bridge Function (Main Export)
// ==========================================

export const bridge = (input: string): BridgeOutput[] => {
  const { descriptor } = parseSfc(input);
  const { definitions, staticArrays } = analyzeScript(descriptor);
  const contexts = generateContexts(definitions);
  const templateAst = parseDom(descriptor.template?.content || "");

  const results: BridgeOutput[] = [];

  for (const ctx of contexts) {
    const templateScenarios = permuteNodes(
      templateAst.children,
      ctx,
      staticArrays
    );

    for (const nodes of templateScenarios) {
      const plain = formatHtml(renderNodesToHtml(nodes, ctx, false));
      const annotated = formatHtml(renderNodesToHtml(nodes, ctx, true));
      results.push({ plain, annotated });
    }
  }

  return results;
};
