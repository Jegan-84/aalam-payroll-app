/**
 * Tiny expression language for HR-defined custom pay components.
 *
 * Grammar (precedence, low → high):
 *   expr     := term (('+'|'-') term)*
 *   term     := factor (('*'|'/'|'%') factor)*
 *   factor   := '-' factor | primary
 *   primary  := number | ident | funcCall | '(' expr ')'
 *   funcCall := ident '(' expr (',' expr)* ')'
 *
 * Allowed functions: min, max, round, floor, ceil, abs
 *   (No conditional / boolean ops in V1 — keep it simple.)
 *
 * Allowed variables: whatever the caller passes in `vars`. Unknown identifiers
 * raise an error so HR typos don't silently produce 0.
 *
 * Evaluation is pure and deterministic. The parser never touches `Function` /
 * `eval` — it walks a token stream and computes numbers.
 */

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; value: string }
  | { kind: 'op'; value: '+' | '-' | '*' | '/' | '%' | '(' | ')' | ',' }

const FUNCS: Record<string, (...args: number[]) => number> = {
  min:   (...xs) => Math.min(...xs),
  max:   (...xs) => Math.max(...xs),
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil:  (x) => Math.ceil(x),
  abs:   (x) => Math.abs(x),
}

function tokenize(source: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue }
    if (ch >= '0' && ch <= '9') {
      let j = i
      while (j < source.length && (source[j] >= '0' && source[j] <= '9' || source[j] === '.')) j++
      const n = Number(source.slice(i, j))
      if (!Number.isFinite(n)) throw new Error(`Invalid number at ${i}`)
      out.push({ kind: 'num', value: n })
      i = j; continue
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i
      while (j < source.length && /[a-zA-Z_0-9]/.test(source[j])) j++
      out.push({ kind: 'ident', value: source.slice(i, j) })
      i = j; continue
    }
    if ('+-*/%(),'.includes(ch)) {
      out.push({ kind: 'op', value: ch as '+' })
      i++; continue
    }
    throw new Error(`Unexpected character '${ch}' at position ${i}`)
  }
  return out
}

// -----------------------------------------------------------------------------
// Parser → AST
// -----------------------------------------------------------------------------
type Node =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: string }
  | { kind: 'call'; name: string; args: Node[] }
  | { kind: 'binop'; op: '+' | '-' | '*' | '/' | '%'; left: Node; right: Node }
  | { kind: 'unary'; op: '-'; value: Node }

class Parser {
  private i = 0
  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    const expr = this.parseExpr()
    if (this.i < this.tokens.length) {
      throw new Error(`Unexpected token after expression: ${JSON.stringify(this.tokens[this.i])}`)
    }
    return expr
  }

  private parseExpr(): Node {
    let left = this.parseTerm()
    while (this.peekOp('+') || this.peekOp('-')) {
      const op = this.consumeOp()
      const right = this.parseTerm()
      left = { kind: 'binop', op: op as '+' | '-', left, right }
    }
    return left
  }

  private parseTerm(): Node {
    let left = this.parseFactor()
    while (this.peekOp('*') || this.peekOp('/') || this.peekOp('%')) {
      const op = this.consumeOp()
      const right = this.parseFactor()
      left = { kind: 'binop', op: op as '*' | '/' | '%', left, right }
    }
    return left
  }

  private parseFactor(): Node {
    if (this.peekOp('-')) {
      this.consumeOp()
      return { kind: 'unary', op: '-', value: this.parseFactor() }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Node {
    const t = this.tokens[this.i]
    if (!t) throw new Error('Unexpected end of expression')

    if (t.kind === 'num') { this.i++; return { kind: 'num', value: t.value } }

    if (t.kind === 'op' && t.value === '(') {
      this.i++
      const expr = this.parseExpr()
      if (!this.peekOp(')')) throw new Error('Missing closing parenthesis')
      this.i++
      return expr
    }

    if (t.kind === 'ident') {
      this.i++
      if (this.peekOp('(')) {
        this.i++
        const args: Node[] = []
        if (!this.peekOp(')')) {
          args.push(this.parseExpr())
          while (this.peekOp(',')) {
            this.i++
            args.push(this.parseExpr())
          }
        }
        if (!this.peekOp(')')) throw new Error(`Missing ) after ${t.value}(…`)
        this.i++
        return { kind: 'call', name: t.value, args }
      }
      return { kind: 'var', name: t.value }
    }

    throw new Error(`Unexpected token: ${JSON.stringify(t)}`)
  }

  private peekOp(v: string): boolean {
    const t = this.tokens[this.i]
    return !!t && t.kind === 'op' && t.value === v
  }

  private consumeOp(): string {
    const t = this.tokens[this.i]
    if (!t || t.kind !== 'op') throw new Error('Expected operator')
    this.i++
    return t.value
  }
}

// -----------------------------------------------------------------------------
// Evaluator
// -----------------------------------------------------------------------------
export type FormulaVars = Record<string, number>

function evaluate(node: Node, vars: FormulaVars): number {
  switch (node.kind) {
    case 'num': return node.value
    case 'var': {
      if (!(node.name in vars)) throw new Error(`Unknown variable '${node.name}'`)
      const v = vars[node.name]
      if (!Number.isFinite(v)) throw new Error(`Non-numeric value for '${node.name}'`)
      return v
    }
    case 'unary':
      return -evaluate(node.value, vars)
    case 'binop': {
      const l = evaluate(node.left, vars)
      const r = evaluate(node.right, vars)
      switch (node.op) {
        case '+': return l + r
        case '-': return l - r
        case '*': return l * r
        case '/':
          if (r === 0) throw new Error('Division by zero')
          return l / r
        case '%':
          if (r === 0) throw new Error('Modulo by zero')
          return l % r
      }
      // exhaustive
      return 0
    }
    case 'call': {
      const fn = FUNCS[node.name]
      if (!fn) throw new Error(`Unknown function '${node.name}'`)
      const args = node.args.map((a) => evaluate(a, vars))
      return fn(...args)
    }
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export type FormulaResult =
  | { ok: true; value: number }
  | { ok: false; error: string }

/** Evaluate a formula against a variable map. Safe to call with any string. */
export function evalFormula(source: string, vars: FormulaVars): FormulaResult {
  try {
    const tokens = tokenize(source)
    if (tokens.length === 0) return { ok: false, error: 'Empty formula' }
    const ast = new Parser(tokens).parse()
    return { ok: true, value: evaluate(ast, vars) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

/**
 * Parse-check a formula without running it. Used by the UI to give immediate
 * feedback when HR types a bad expression, without needing real payroll inputs.
 * Returns error string or null.
 */
export function validateFormulaSyntax(source: string): string | null {
  try {
    const tokens = tokenize(source)
    if (tokens.length === 0) return 'Empty formula'
    new Parser(tokens).parse()
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

/** Standard variables exposed to custom pay components. Keep in sync with the engine. */
export const ALLOWED_VARS = [
  'gross',          // full monthly gross from structure
  'grossProrated',  // gross × proration
  'basic',          // full monthly basic
  'basicProrated',  // basic × proration
  'hra',            // hra (full month, not prorated)
  'hraProrated',
  'conv',
  'convProrated',
  'paidDays',
  'daysInMonth',
  'proration',
  'annualCtc',
  'annualGross',
] as const
