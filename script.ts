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

function analyzeScript(scriptContent: string): ValueDefinitions {
  const definitions: ValueDefinitions = {};

  if (!scriptContent.trim()) return definitions;

  try {
    const ast = babelParse(scriptContent, {
      sourceType: "module",
      plugins: ["typescript"],
    });

    const extractValuesFromType = (typeNode: any): any[] | null => {
      if (!typeNode) return null;
      if (typeNode.type === "TSUnionType") {
        const values: any[] = [];
        typeNode.types.forEach((t: any) => {
          if (t.type === "TSLiteralType") values.push(t.literal.value);
          if (t.type === "TSBooleanKeyword") values.push(true, false);
        });
        return values.length > 0 ? values : null;
      }
      if (typeNode.type === "TSLiteralType") return [typeNode.literal.value];
      if (typeNode.type === "TSBooleanKeyword") return [true, false];
      return null;
    };

    const extractInitialValue = (initNode: any): any => {
      if (!initNode) return null;
      if (
        ["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(
          initNode.type,
        )
      )
        return initNode.value;
      if (
        initNode.type === "CallExpression" &&
        initNode.callee.name === "ref"
      ) {
        const arg = initNode.arguments[0];
        if (
          arg &&
          ["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(
            arg.type,
          )
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
    };

    const walk = (node: any) => {
      if (!node) return;

      if (node.type === "VariableDeclaration") {
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

      if (
        node.type === "CallExpression" &&
        node.callee.type === "Identifier" &&
        node.callee.name === "defineProps"
      ) {
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

      for (const k in node) {
        if (typeof node[k] === "object") walk(node[k]);
      }
    };

    walk(ast.program);
  } catch {
    /* ignore */
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

function groupSegments(nodes: TemplateChildNode[]): Segment[] {
  const segments: Segment[] = [];
  let currentIfBlock: Branch[] | null = null;

  const finalizeIfBlock = () => {
    if (!currentIfBlock) return;
    const lastNode = currentIfBlock[currentIfBlock.length - 1];
    let hasElse = false;
    if (lastNode !== IMPLICIT_ELSE && lastNode.type === NodeTypes.ELEMENT) {
      hasElse = lastNode.props.some((p) => p.name === "else");
    }
    if (!hasElse) currentIfBlock.push(IMPLICIT_ELSE);
    segments.push({ type: "IF_BLOCK", branches: currentIfBlock });
    currentIfBlock = null;
  };

  for (const node of nodes) {
    if (node.type !== NodeTypes.ELEMENT) {
      finalizeIfBlock();
      segments.push({ type: "STATIC", node });
      continue;
    }

    const el = node as ElementNode;
    const ifDir = el.props.find((p) => p.name === "if");
    const elseIfDir = el.props.find((p) => p.name === "else-if");
    const elseDir = el.props.find((p) => p.name === "else");
    const showDir = el.props.find((p) => p.name === "show");
    const forDir = el.props.find((p) => p.name === "for");

    if (ifDir) {
      finalizeIfBlock();
      currentIfBlock = [node];
    } else if (elseIfDir || elseDir) {
      if (currentIfBlock) currentIfBlock.push(node);
      else {
        finalizeIfBlock();
        segments.push({ type: "STATIC", node });
      }
    } else if (showDir) {
      finalizeIfBlock();
      segments.push({ type: "SHOW_BLOCK", node: el });
    } else if (forDir) {
      finalizeIfBlock();
      const forExp = forDir as DirectiveNode;
      const expContent = (forExp.exp as SimpleExpressionNode)?.content || "";
      const match = expContent.match(/(\w+)\s+in\s+(\w+)/);
      if (match) {
        segments.push({
          type: "FOR_BLOCK",
          node: el,
          iterator: match[1],
          source: match[2],
        });
      } else {
        segments.push({ type: "STATIC", node });
      }
    } else {
      finalizeIfBlock();
      segments.push({ type: "STATIC", node });
    }
  }
  finalizeIfBlock();
  return segments;
}

function cloneNodeWithChildren(
  node: ElementNode,
  newChildren: TemplateChildNode[],
): ElementNode {
  return { ...node, children: newChildren };
}

type PermutedNode = {
  node: TemplateChildNode;
  loopContext?: Record<string, string>;
  children?: PermutedNode[];
};

type PermutationResult = PermutedNode[];

function permuteNodes(
  nodes: TemplateChildNode[],
  context: RenderContext,
): PermutationResult[] {
  const segments = groupSegments(nodes);
  let results: PermutationResult[] = [[]];

  for (const seg of segments) {
    const nextResults: PermutationResult[] = [];

    if (seg.type === "STATIC") {
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
    } else if (seg.type === "IF_BLOCK") {
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
              nextResults.push([
                ...res,
                { node: branch, loopContext: undefined },
              ]);
            }
          }
        }
      }
    } else if (seg.type === "SHOW_BLOCK") {
      for (const res of results) {
        const childPerms = permuteNodes(seg.node.children, context);
        for (const childPerm of childPerms) {
          nextResults.push([
            ...res,
            { node: seg.node, loopContext: undefined, children: childPerm },
          ]);
        }
        nextResults.push([...res]);
      }
    } else if (seg.type === "FOR_BLOCK") {
      const sourceArray = context[seg.source];
      const isKnownArray = Array.isArray(sourceArray) && sourceArray.length > 0;

      for (const res of results) {
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
          const mockValue = `mock-${seg.iterator}`;
          const childPerms = permuteNodes(seg.node.children, context);
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
    }

    results = nextResults;
  }
  return results;
}

// ==========================================
// 5. Logic: Renderer
// ==========================================

const MOCK_VALUE = "{{unresolved}}";

function renderNodesToHtml(
  nodes: PermutedNode[],
  context: RenderContext,
  annotated: boolean,
): string {
  return nodes
    .map((pn) =>
      renderPermutedNode(pn, context, pn.loopContext || {}, annotated),
    )
    .join("");
}

function renderPermutedNode(
  pn: PermutedNode,
  context: RenderContext,
  loopContext: Record<string, string>,
  annotated: boolean,
): string {
  const node = pn.node;

  if (node.type === NodeTypes.TEXT) {
    const text = (node as TextNode).content;
    return text.trim() ? text : "";
  }
  if (node.type === NodeTypes.COMMENT) return "";

  if (node.type === NodeTypes.INTERPOLATION) {
    const key = (node.content as SimpleExpressionNode).content.trim();
    return resolveValue(key, context, loopContext);
  }

  if (node.type === NodeTypes.ELEMENT) {
    const el = node as ElementNode;
    const { loc } = el;
    const attrs: string[] = [];

    if (annotated) {
      attrs.push(`data-start-line="${loc.start.line}"`);
      attrs.push(`data-start-column="${loc.start.column}"`);
      attrs.push(`data-end-line="${loc.end.line}"`);
      attrs.push(`data-end-column="${loc.end.column}"`);
    }

    for (const prop of el.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        const attr = prop as AttributeNode;
        attrs.push(`${attr.name}="${attr.value?.content || ""}"`);
        if (annotated) {
          attrs.push(`data-${attr.name}-start-line="${prop.loc.start.line}"`);
          attrs.push(
            `data-${attr.name}-start-column="${prop.loc.start.column}"`,
          );
          attrs.push(`data-${attr.name}-end-line="${prop.loc.end.line}"`);
          attrs.push(
            `data-${attr.name}-end-column="${prop.loc.end.column}"`,
          );
        }
      } else if (prop.type === NodeTypes.DIRECTIVE) {
        const dir = prop as DirectiveNode;
        if (
          dir.name === "bind" &&
          dir.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        ) {
          const attrName = dir.arg.content;
          const varName = (dir.exp as SimpleExpressionNode)?.content;
          const val = varName
            ? resolveValue(varName, context, loopContext)
            : MOCK_VALUE;
          attrs.push(`${attrName}="${val}"`);
          if (annotated) {
            attrs.push(`data-${attrName}-start-line="${prop.loc.start.line}"`);
            attrs.push(
              `data-${attrName}-start-column="${prop.loc.start.column}"`,
            );
            attrs.push(`data-${attrName}-end-line="${prop.loc.end.line}"`);
            attrs.push(
              `data-${attrName}-end-column="${prop.loc.end.column}"`,
            );
          }
        }
      }
    }

    const attrStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";

    // Use permuted children if available, otherwise use raw node children
    let childrenStr: string;
    if (pn.children) {
      childrenStr = pn.children
        .map((child) => {
          // Merge parent loopContext with child loopContext
          const mergedLoopContext = {
            ...loopContext,
            ...(child.loopContext || {}),
          };
          return renderPermutedNode(child, context, mergedLoopContext, annotated);
        })
        .join("");
    } else {
      childrenStr = el.children
        .map((c) => renderNode(c, context, loopContext, annotated))
        .join("");
    }

    return `<${el.tag}${attrStr}>${childrenStr}</${el.tag}>`;
  }
  return "";
}

function resolveValue(
  key: string,
  context: RenderContext,
  loopContext: Record<string, string>,
): string {
  if (loopContext[key] !== undefined) return loopContext[key];
  if (context[key] !== undefined) return String(context[key]);
  return MOCK_VALUE;
}

function renderNode(
  node: TemplateChildNode,
  context: RenderContext,
  loopContext: Record<string, string>,
  annotated: boolean,
): string {
  if (node.type === NodeTypes.TEXT) {
    const text = (node as TextNode).content;
    return text.trim() ? text : "";
  }
  if (node.type === NodeTypes.COMMENT) return "";

  if (node.type === NodeTypes.INTERPOLATION) {
    const key = (node.content as SimpleExpressionNode).content.trim();
    return resolveValue(key, context, loopContext);
  }

  if (node.type === NodeTypes.ELEMENT) {
    const el = node as ElementNode;
    const { loc } = el;
    const attrs: string[] = [];

    if (annotated) {
      attrs.push(`data-start-line="${loc.start.line}"`);
      attrs.push(`data-start-column="${loc.start.column}"`);
      attrs.push(`data-end-line="${loc.end.line}"`);
      attrs.push(`data-end-column="${loc.end.column}"`);
    }

    for (const prop of el.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        const attr = prop as AttributeNode;
        attrs.push(`${attr.name}="${attr.value?.content || ""}"`);
        if (annotated) {
          attrs.push(`data-${attr.name}-start-line="${prop.loc.start.line}"`);
          attrs.push(
            `data-${attr.name}-start-column="${prop.loc.start.column}"`,
          );
          attrs.push(`data-${attr.name}-end-line="${prop.loc.end.line}"`);
          attrs.push(
            `data-${attr.name}-end-column="${prop.loc.end.column}"`,
          );
        }
      } else if (prop.type === NodeTypes.DIRECTIVE) {
        const dir = prop as DirectiveNode;
        if (
          dir.name === "bind" &&
          dir.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        ) {
          const attrName = dir.arg.content;
          const varName = (dir.exp as SimpleExpressionNode)?.content;
          const val = varName
            ? resolveValue(varName, context, loopContext)
            : MOCK_VALUE;
          attrs.push(`${attrName}="${val}"`);
          if (annotated) {
            attrs.push(`data-${attrName}-start-line="${prop.loc.start.line}"`);
            attrs.push(
              `data-${attrName}-start-column="${prop.loc.start.column}"`,
            );
            attrs.push(`data-${attrName}-end-line="${prop.loc.end.line}"`);
            attrs.push(
              `data-${attrName}-end-column="${prop.loc.end.column}"`,
            );
          }
        }
      }
    }

    const attrStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
    const childrenStr = el.children
      .map((c) => renderNode(c, context, loopContext, annotated))
      .join("");
    return `<${el.tag}${attrStr}>${childrenStr}</${el.tag}>`;
  }
  return "";
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
