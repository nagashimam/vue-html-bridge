import { parse as parseSfc } from "@vue/compiler-sfc";
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
import { parse as babelParse } from "@babel/parser";

// ==========================================
// 1. Type Definitions
// ==========================================

export type BridgeOutput = {
  plain: string;
  annotated: string;
};

const IMPLICIT_ELSE = Symbol("IMPLICIT_ELSE");
type Branch = TemplateChildNode | typeof IMPLICIT_ELSE;

type Segment =
  | { type: "IF_BLOCK"; branches: Branch[] }
  | { type: "SHOW_BLOCK"; node: ElementNode }
  | { type: "FOR_BLOCK"; node: ElementNode; iterator: string; source: string }
  | { type: "STATIC"; node: TemplateChildNode };

type RenderContext = Record<string, string | number | boolean | unknown[]>;

type ValueDefinitions = Record<
  string,
  (string | number | boolean)[] | unknown[][]
>;

// ==========================================
// 2. Logic: Analyzer (Props & Variables)
// ==========================================

function extractValuesFromType(
  typeNode: any,
): (string | number | boolean)[] | null {
  if (!typeNode) return null;
  if (typeNode.type === "TSUnionType") {
    const values: (string | number | boolean)[] = [];
    typeNode.types.forEach((t: any) => {
      if (t.type === "TSLiteralType") values.push(t.literal.value);
      if (t.type === "TSBooleanKeyword") values.push(true, false);
    });
    return values.length > 0 ? values : null;
  }
  if (typeNode.type === "TSLiteralType") return [typeNode.literal.value];
  if (typeNode.type === "TSBooleanKeyword") return [true, false];
  return null;
}

function extractInitialValue(initNode: any): any {
  if (!initNode) return null;
  if (
    ["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(
      initNode.type,
    )
  )
    return initNode.value;
  if (initNode.type === "CallExpression" && initNode.callee.name === "ref") {
    const arg = initNode.arguments[0];
    if (
      arg &&
      ["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(arg.type)
    )
      return arg.value;
  }
  if (initNode.type === "ArrayExpression") {
    const items: any[] = [];
    for (const el of initNode.elements) {
      if (el && el.type === "StringLiteral") items.push(el.value);
      else if (el && el.type === "NumericLiteral") items.push(el.value);
    }
    return items.length > 0 ? items : null;
  }
  return null;
}

function processVariableDeclaration(node: any, definitions: ValueDefinitions) {
  node.declarations.forEach((decl: any) => {
    if (decl.id.type === "Identifier") {
      const key = decl.id.name;
      const typeAnn = decl.id.typeAnnotation?.typeAnnotation;
      const typeValues = extractValuesFromType(typeAnn);

      if (typeValues) {
        definitions[key] = typeValues;
      } else {
        const initVal = extractInitialValue(decl.init);
        if (initVal !== null) {
          if (Array.isArray(initVal)) {
            definitions[key] = [initVal] as unknown[][];
          } else {
            definitions[key] = [initVal];
          }
        }
      }
    }
  });
}

function processDefineProps(node: any, definitions: ValueDefinitions) {
  const typeParam = node.typeParameters?.params[0];
  if (typeParam && typeParam.type === "TSTypeLiteral") {
    typeParam.members.forEach((member: any) => {
      if (
        member.type === "TSPropertySignature" &&
        member.key.type === "Identifier"
      ) {
        const key = member.key.name;
        const typeAnn = member.typeAnnotation?.typeAnnotation;
        const typeValues = extractValuesFromType(typeAnn);

        if (typeValues) {
          definitions[key] = typeValues;
        } else {
          definitions[key] = [`mock-${key}`];
        }
      }
    });
  }
}

function walkScriptAst(node: any, definitions: ValueDefinitions) {
  if (!node) return;

  if (node.type === "VariableDeclaration") {
    processVariableDeclaration(node, definitions);
  }

  if (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "defineProps"
  ) {
    processDefineProps(node, definitions);
  }

  for (const key in node) {
    if (typeof node[key] === "object" && node[key] !== null) {
      walkScriptAst(node[key], definitions);
    }
  }
}

function analyzeScript(scriptContent: string): ValueDefinitions {
  const definitions: ValueDefinitions = {};
  if (!scriptContent.trim()) return definitions;

  try {
    const ast = babelParse(scriptContent, {
      sourceType: "module",
      plugins: ["typescript"],
    });
    walkScriptAst(ast.program, definitions);
  } catch (e) {
    // console.error("Failed to parse script:", e);
    // Silently ignore for now as per original implementation
  }

  return definitions;
}

// ==========================================
// 3. Logic: Context Permutation (Cartesian)
// ==========================================

function generateContexts(definitions: ValueDefinitions): RenderContext[] {
  const keys = Object.keys(definitions);
  if (keys.length === 0) return [{}];

  const results: RenderContext[] = [];

  function recurse(index: number, current: RenderContext) {
    if (index === keys.length) {
      results.push(current);
      return;
    }
    const key = keys[index];
    const values = definitions[key];
    for (const val of values) {
      recurse(index + 1, { ...current, [key]: val as any });
    }
  }
  recurse(0, {});
  return results;
}

// ==========================================
// 4. Logic: Template Permutation (Recursive)
// ==========================================

function findIfBlock(
  nodes: TemplateChildNode[],
  startIndex: number,
): { block: Segment; newIndex: number } | null {
  const node = nodes[startIndex];
  if (node.type !== NodeTypes.ELEMENT) return null;

  const ifDir = node.props.find((p) => p.name === "if");
  if (!ifDir) return null;

  const branches: Branch[] = [node];
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

  const lastBranch = branches[branches.length - 1];
  if (
    lastBranch !== IMPLICIT_ELSE &&
    lastBranch.type === NodeTypes.ELEMENT &&
    !lastBranch.props.some((p) => p.name === "else")
  ) {
    branches.push(IMPLICIT_ELSE);
  }

  return { block: { type: "IF_BLOCK", branches }, newIndex: j };
}

function groupSegments(nodes: TemplateChildNode[]): Segment[] {
  const segments: Segment[] = [];
  let i = 0;

  while (i < nodes.length) {
    const node = nodes[i];
    const ifBlockResult = findIfBlock(nodes, i);

    if (ifBlockResult) {
      segments.push(ifBlockResult.block);
      i = ifBlockResult.newIndex;
      continue;
    }

    if (node.type === NodeTypes.ELEMENT) {
      const showDir = node.props.find((p) => p.name === "show");
      if (showDir) {
        segments.push({ type: "SHOW_BLOCK", node });
        i++;
        continue;
      }

      const forDir = node.props.find((p) => p.name === "for");
      if (forDir) {
        const forExp = forDir as DirectiveNode;
        const expContent = (forExp.exp as SimpleExpressionNode)?.content || "";
        const match = expContent.match(/(\w+)\s+in\s+(\w+)/);
        if (match) {
          segments.push({
            type: "FOR_BLOCK",
            node: node,
            iterator: match[1],
            source: match[2],
          });
        } else {
          segments.push({ type: "STATIC", node });
        }
        i++;
        continue;
      }
    }

    segments.push({ type: "STATIC", node });
    i++;
  }

  return segments;
}

type PermutedNode = {
  node: TemplateChildNode;
  loopContext?: Record<string, string>;
  children?: PermutedNode[];
};

type PermutationResult = PermutedNode[];

function handleStaticSegment(
  seg: { type: "STATIC"; node: TemplateChildNode },
  context: RenderContext,
  results: PermutationResult[],
): PermutationResult[] {
  const nextResults: PermutationResult[] = [];
  const node = seg.node;

  if (node.type === NodeTypes.ELEMENT) {
    const childPerms = permuteNodes(node.children, context);
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
}

function handleIfBlockSegment(
  seg: { type: "IF_BLOCK"; branches: Branch[] },
  context: RenderContext,
  results: PermutationResult[],
): PermutationResult[] {
  const nextResults: PermutationResult[] = [];
  for (const res of results) {
    for (const branch of seg.branches) {
      if (branch === IMPLICIT_ELSE) {
        nextResults.push([...res]);
      } else {
        if (branch.type === NodeTypes.ELEMENT) {
          const el = branch as ElementNode;
          const childPerms = permuteNodes(el.children, context);
          for (const childPerm of childPerms) {
            if (el.tag === "template") {
              nextResults.push([...res, ...childPerm]);
            } else {
              nextResults.push([
                ...res,
                { node: el, loopContext: undefined, children: childPerm },
              ]);
            }
          }
        } else {
          nextResults.push([...res, { node: branch, loopContext: undefined }]);
        }
      }
    }
  }
  return nextResults;
}

function handleShowBlockSegment(
  seg: { type: "SHOW_BLOCK"; node: ElementNode },
  context: RenderContext,
  results: PermutationResult[],
): PermutationResult[] {
  const nextResults: PermutationResult[] = [];
  for (const res of results) {
    const childPerms = permuteNodes(seg.node.children, context);
    for (const childPerm of childPerms) {
      nextResults.push([
        ...res,
        { node: seg.node, loopContext: undefined, children: childPerm },
      ]);
    }
    nextResults.push([...res]); // The hidden case
  }
  return nextResults;
}

function handleForBlockSegment(
  seg: {
    type: "FOR_BLOCK";
    node: ElementNode;
    iterator: string;
    source: string;
  },
  context: RenderContext,
  results: PermutationResult[],
): PermutationResult[] {
  const nextResults: PermutationResult[] = [];
  const sourceArray = context[seg.source];
  const isKnownArray = Array.isArray(sourceArray) && sourceArray.length > 0;

  for (const res of results) {
    // Empty case for v-for
    nextResults.push([...res]);

    if (isKnownArray) {
      const items = sourceArray as unknown[];
      const childPerms = permuteNodes(seg.node.children, context);
      for (const childPerm of childPerms) {
        const copies: PermutedNode[] = [];
        for (const item of items) {
          copies.push({
            node: seg.node,
            loopContext: { [seg.iterator]: String(item) },
            children: childPerm,
          });
        }
        nextResults.push([...res, ...copies]);
      }
    } else {
      // Unknown array
      const mockValue = `mock-${seg.iterator}`;
      const childPerms = permuteNodes(seg.node.children, context);

      // Single item case
      for (const childPerm of childPerms) {
        nextResults.push([
          ...res,
          {
            node: seg.node,
            loopContext: { [seg.iterator]: mockValue },
            children: childPerm,
          },
        ]);
      }

      // Plural (2 items) case
      for (const childPerm of childPerms) {
        const copies: PermutedNode[] = [];
        for (let i = 0; i < 2; i++) {
          copies.push({
            node: seg.node,
            loopContext: { [seg.iterator]: mockValue },
            children: childPerm,
          });
        }
        nextResults.push([...res, ...copies]);
      }
    }
  }
  return nextResults;
}

function permuteNodes(
  nodes: TemplateChildNode[],
  context: RenderContext,
): PermutationResult[] {
  const segments = groupSegments(nodes);
  let results: PermutationResult[] = [[]];

  for (const seg of segments) {
    switch (seg.type) {
      case "STATIC":
        results = handleStaticSegment(seg, context, results);
        break;
      case "IF_BLOCK":
        results = handleIfBlockSegment(seg, context, results);
        break;
      case "SHOW_BLOCK":
        results = handleShowBlockSegment(seg, context, results);
        break;
      case "FOR_BLOCK":
        results = handleForBlockSegment(
          seg as {
            type: "FOR_BLOCK";
            node: ElementNode;
            iterator: string;
            source: string;
          },
          context,
          results,
        );
        break;
    }
  }
  return results;
}

// ==========================================
// 5. Logic: Renderer
// ==========================================

const MOCK_VALUE = "{{unresolved}}";

function resolveValue(
  key: string,
  context: RenderContext,
  loopContext: Record<string, string>,
): string {
  if (loopContext[key] !== undefined) return loopContext[key];
  if (context[key] !== undefined) return String(context[key]);
  return MOCK_VALUE;
}

function addAnnotationAttrs(
  prop: AttributeNode | DirectiveNode,
  attrs: string[],
  attrName: string,
) {
  attrs.push(`data-${attrName}-start-line="${prop.loc.start.line}"`);
  attrs.push(`data-${attrName}-start-column="${prop.loc.start.column}"`);
  attrs.push(`data-${attrName}-end-line="${prop.loc.end.line}"`);
  attrs.push(`data-${attrName}-end-column="${prop.loc.end.column}"`);
}

function renderAttributes(
  el: ElementNode,
  context: RenderContext,
  loopContext: Record<string, string>,
  annotated: boolean,
): string {
  const attrs: string[] = [];

  if (annotated) {
    attrs.push(`data-start-line="${el.loc.start.line}"`);
    attrs.push(`data-start-column="${el.loc.start.column}"`);
    attrs.push(`data-end-line="${el.loc.end.line}"`);
    attrs.push(`data-end-column="${el.loc.end.column}"`);
  }

  for (const prop of el.props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      attrs.push(`${prop.name}="${prop.value?.content || ""}"`);
      if (annotated) addAnnotationAttrs(prop, attrs, prop.name);
    } else if (
      prop.type === NodeTypes.DIRECTIVE &&
      prop.name === "bind" &&
      prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
    ) {
      const attrName = prop.arg.content;
      const varName = (prop.exp as SimpleExpressionNode)?.content;
      const val = varName
        ? resolveValue(varName, context, loopContext)
        : MOCK_VALUE;
      attrs.push(`${attrName}="${val}"`);
      if (annotated) addAnnotationAttrs(prop, attrs, attrName);
    }
  }
  return attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
}

function renderPermutedNode(
  pn: PermutedNode,
  context: RenderContext,
  loopContext: Record<string, string>,
  annotated: boolean,
): string {
  const node = pn.node;
  const currentLoopContext = { ...loopContext, ...(pn.loopContext || {}) };

  if (node.type === NodeTypes.TEXT) {
    const text = (node as TextNode).content;
    return text.trim() ? text : "";
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
      annotated,
    );

    let childrenStr = "";
    if (pn.children) {
      childrenStr = pn.children
        .map((child) =>
          renderPermutedNode(child, context, currentLoopContext, annotated),
        )
        .join("");
    }

    return `<${el.tag}${attrStr}>${childrenStr}</${el.tag}>`;
  }
  return "";
}

function renderNodesToHtml(
  nodes: PermutedNode[],
  context: RenderContext,
  annotated: boolean,
): string {
  return nodes
    .map((pn) => renderPermutedNode(pn, context, {}, annotated))
    .join("");
}

// ==========================================
// 6. Bridge Function (Main Export)
// ==========================================

export function bridge(input: string): BridgeOutput[] {
  const { descriptor } = parseSfc(input);
  const definitions = analyzeScript(descriptor.scriptSetup?.content || "");
  const contexts = generateContexts(definitions);
  const templateAst = parseDom(descriptor.template?.content || "");

  const results: BridgeOutput[] = [];

  for (const ctx of contexts) {
    const templateScenarios = permuteNodes(templateAst.children, ctx);

    for (const nodes of templateScenarios) {
      const plain = renderNodesToHtml(nodes, ctx, false);
      const annotated = renderNodesToHtml(nodes, ctx, true);
      results.push({ plain, annotated });
    }
  }

  return results;
}
