import path from 'node:path';
import ts from 'typescript';

export interface DeadExport {
  file: string;
  name: string;
}

type Input = { files: ReadonlyMap<string, string>; targetDir: string };

function analyze(input: Input): { dead: DeadExport[]; modules: string[] } {
  const exports = new Map<string, Set<string>>();
  const used = new Map<string, Set<string>>();
  const all = new Set<string>();
  const importers = new Map<string, Set<string>>();
  const sourceFile = /\.(?:ts|tsx|astro|mjs)$/;
  const resolve = (file: string, specifier: string): string | undefined => {
    const base = specifier.startsWith('@/')
      ? path.posix.join('apps/blog/src', specifier.slice(2))
      : specifier.startsWith('.')
        ? path.posix.resolve('/', path.posix.dirname(file), specifier).slice(1)
        : '';
    if (!base) return undefined;
    return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(
      (candidate) => input.files.has(candidate),
    );
  };
  for (const [file, text] of input.files) {
    if (!sourceFile.test(file)) continue;
    const source = file.endsWith('.astro')
      ? (text.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? '')
      : text;
    const tree = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    if (
      file.startsWith(`${input.targetDir}/`) &&
      /\.tsx?$/.test(file) &&
      !/\.(?:test|spec|d)\.tsx?$/.test(file)
    ) {
      const names = new Set<string>();
      for (const statement of tree.statements) {
        if (
          ts.isExportDeclaration(statement) &&
          !statement.moduleSpecifier &&
          statement.exportClause &&
          ts.isNamedExports(statement.exportClause)
        ) {
          for (const item of statement.exportClause.elements) names.add(item.name.text);
        }
        if (
          !ts.canHaveModifiers(statement) ||
          !ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        )
          continue;
        if (ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword))
          names.add('default');
        else if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations)
            if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
        } else if (
          (ts.isFunctionDeclaration(statement) ||
            ts.isClassDeclaration(statement) ||
            ts.isInterfaceDeclaration(statement) ||
            ts.isTypeAliasDeclaration(statement) ||
            ts.isEnumDeclaration(statement)) &&
          statement.name
        )
          names.add(statement.name.text);
      }
      exports.set(file, names);
    }
    function mark(specifier: string, names: string[] | null): void {
      const target = resolve(file, specifier);
      if (!target || target === file) return;
      const from = importers.get(target) ?? new Set<string>();
      from.add(file);
      importers.set(target, from);
      if (names === null) all.add(target);
      else {
        const set = used.get(target) ?? new Set<string>();
        for (const name of names) set.add(name);
        used.set(target, set);
      }
    }
    function visit(node: ts.Node): void {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.importClause
      ) {
        const names: string[] = [];
        if (node.importClause.name) names.push('default');
        const bindings = node.importClause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) mark(node.moduleSpecifier.text, null);
        else {
          if (bindings && ts.isNamedImports(bindings))
            for (const item of bindings.elements) names.push((item.propertyName ?? item.name).text);
          mark(node.moduleSpecifier.text, names);
        }
      } else if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        if (!node.exportClause || ts.isNamespaceExport(node.exportClause))
          mark(node.moduleSpecifier.text, null);
        else
          mark(
            node.moduleSpecifier.text,
            node.exportClause.elements.map((item) => (item.propertyName ?? item.name).text),
          );
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1
      ) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) mark(arg.text, null);
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  const dead: DeadExport[] = [];
  for (const [file, names] of exports)
    if (!all.has(file))
      for (const name of names) if (!used.get(file)?.has(name)) dead.push({ file, name });
  const modules = [...exports.keys()]
    .filter((file) => {
      const from = importers.get(file);
      const ownTest = file.replace(/\.tsx?$/, (extension) => `.test${extension}`);
      return from?.size === 1 && from.has(ownTest);
    })
    .sort();
  return {
    dead: dead.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name)),
    modules,
  };
}

export function findDeadExports(input: Input): DeadExport[] {
  return analyze(input).dead;
}
export function findDeadModules(input: Input): string[] {
  return analyze(input).modules;
}
