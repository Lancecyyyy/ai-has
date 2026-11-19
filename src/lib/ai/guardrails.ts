/**
 * Safety shields that run before any text reaches the model or the database.
 * Pure functions: easy to unit test and to demo on the Security page.
 */

export type RedactionType = "password" | "card" | "phone" | "gov_id" | "secret" | "email";

export interface GuardResult {
  text: string;
  redactions: { type: RedactionType; count: number }[];
  injection: string | null;
  abuse: string | null;
  outOfScope: string | null;
}

const NOT_A_PASSWORD = new Set(
  "expired wrong incorrect not locked too still the invalid correct working forgotten reset changed blank empty weak rejected different same new old asking a my being ko ay mali ayaw hindi nakalimutan nag-expire na".split(" "),
);

function luhn(num: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function redactPII(input: string): { text: string; redactions: GuardResult["redactions"] } {
  const counts = new Map<RedactionType, number>();
  const bump = (t: RedactionType) => counts.set(t, (counts.get(t) ?? 0) + 1);
  let text = input;

  // Secrets / API keys / tokens
  text = text.replace(/\b(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,})\b/g, () => {
    bump("secret");
    return "[REDACTED-SECRET]";
  });

  // "my password is hunter2", "pw: abc", "passcode = 1234"
  text = text.replace(
    /\b(password|passwd|pwd|pw|passcode|pin|passphrase)((?:\s+(?:ko|namin|niya|nya))?(?:\s+(?:is|was|ay|=)\s+|\s*[:=]\s*))(["']?)([^\s"',;]+)\3/gi,
    (m, key: string, sep: string, _q: string, value: string) => {
      if (NOT_A_PASSWORD.has(value.toLowerCase())) return m;
      bump("password");
      return `${key}${sep}[REDACTED-PASSWORD]`;
    },
  );

  // Payment cards (13-19 digits, Luhn-valid)
  text = text.replace(/\b(?:\d[ -]?){13,19}\b/g, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) {
      bump("card");
      return "[REDACTED-CARD]";
    }
    return m;
  });

  // Government IDs: US SSN, PH TIN / SSS style
  text = text.replace(/\b\d{3}-\d{2}-\d{4}\b|\b\d{3}-\d{3}-\d{3}(?:-\d{3})?\b|\b\d{2}-\d{7}-\d\b/g, () => {
    bump("gov_id");
    return "[REDACTED-ID]";
  });

  // Phone numbers: PH mobiles (09xx / +639xx) and generic international formats
  text = text.replace(
    /(?:\+?63|\b0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b|\+\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b|\(\d{3}\)\s?\d{3}-\d{4}\b/g,
    () => {
      bump("phone");
      return "[REDACTED-PHONE]";
    },
  );

  // Personal (non-company) email addresses
  text = text.replace(/\b[A-Za-z0-9._%+-]+@(gmail|yahoo|outlook|hotmail|icloud|proton(?:mail)?)\.[a-z.]{2,}\b/gi, () => {
    bump("email");
    return "[REDACTED-EMAIL]";
  });

  return { text, redactions: [...counts.entries()].map(([type, count]) => ({ type, count })) };
}

const INJECTION: [RegExp, string][] = [
  [/\b(ignore|disregard|forget|override)\b[^.]{0,40}\b(previous|prior|above|earlier|all|your|system)\b[^.]{0,30}\b(instructions?|rules|prompts?|guidelines|directions)\b/i, "Instruction override attempt"],
  [/\b(reveal|show|print|repeat|leak|tell me)\b[^.]{0,30}\b(system prompt|hidden prompt|instructions you were given|your prompt|initial prompt)\b/i, "System prompt extraction"],
  [/\b(you are now|from now on you are|act as|pretend (to be|you are)|roleplay as)\b[^.]{0,40}\b(dan|jailbreak|unfiltered|developer mode|evil|no restrictions|admin|root)\b/i, "Persona jailbreak"],
  [/\b(developer|god|sudo|admin|debug) mode\b/i, "Privilege escalation phrasing"],
  [/<\|?(im_start|im_end|system|endoftext)\|?>|\[\/?INST\]|###\s*system/i, "Prompt delimiter injection"],
  [/\b(give|grant|make)\b[^.]{0,20}\b(me|my account)\b[^.]{0,20}\b(admin|domain admin|global admin|superuser)\b/i, "Unauthorised privilege request"],
  [/\b(kalimutan|balewalain|huwag\s+(mong\s+)?sundin|wag\s+(mong\s+)?sundin|i-?ignore)\b[^.]{0,30}\b(instructions?|utos|rules|patakaran|bilin)\b/i, "Instruction override attempt"],
  [/\b(ipakita|sabihin|ibigay)\b[^.]{0,20}\b(system prompt|instructions\s+mo|prompt\s+mo)\b/i, "System prompt extraction"],
  [/\b(i-?reset|palitan|i-?unlock|reset|change|unlock)\b[^.]{0,25}\b(password|account|mfa)\b[^.]{0,20}\b(ng|ni)\s+(boss|manager|kaibigan|katrabaho|officemate|ka-?officemate|kasama|kapatid|iba|ibang\s+tao)\b/i, "Action on another user's account"],
  [/\b(reset|change|unlock)\b[^.]{0,25}\b(password|account|mfa)\b[^.]{0,15}\b(for|of)\b\s+(my\s+)?(boss|manager|colleague|co-?worker|friend|teammate|someone else|another (user|employee|person)|[a-z0-9._-]+@[a-z0-9.-]+)/i,"Action on another user's account"],
];

export function detectInjection(text: string): string | null {
  for (const [re, label] of INJECTION) if (re.test(text)) return label;
  return null;
}

const PROFANITY = /\b(fuck\w*|shit\w*|bitch\w*|asshole|bastard|dickhead|cunt|putang\s?ina|tang\s?ina|gago|bobo|tarantado|ulol|punyeta)\b/i;

export function detectAbuse(text: string): string | null {
  const t = text.trim();
  if (t.length > 2000) return "Message too long";
  if (PROFANITY.test(t)) return "Abusive language";
  if (/(.)\1{11,}/.test(t)) return "Character spam";
  const words = t.toLowerCase().split(/\s+/);
  if (words.length >= 8) {
    const uniq = new Set(words).size;
    if (uniq / words.length < 0.25) return "Repeated-word spam";
  }
  const letters = t.replace(/[^a-z]/gi, "");
  if (letters.length >= 12) {
    const vowels = (letters.match(/[aeiou]/gi) ?? []).length / letters.length;
    const rows = (t.toLowerCase().match(/asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|zxcv|xcvb/g) ?? []).length;
    if (vowels < 0.12 || rows >= 2) return "Keyboard mash";
  }
  return null;
}

const OUT_OF_SCOPE: [RegExp, string][] = [
  [/\b(payroll|payslip|pay slip|salary|salaries|13th month|overtime pay|bonus|wage|sahod|sweldo|suweldo|kaltas)\b/i, "Payroll"],
  [/\b(hiring|job interview|interview schedule|recruit\w*|applicant|resignation|leave balance|vacation leave|sick leave|maternity|benefits|hmo|leave credits|mag-?resign|aplikante)\b/i, "HR"],
  [/\b(tax|bir|itr|withholding|sss contribution|pag-?ibig|philhealth|buwis)\b/i, "Government / tax"],
  [/\b(bank account|loan|credit limit|wire transfer|remittance|gcash|crypto|utang|pautang)\b/i, "Banking / finance"],
];

export function detectOutOfScope(text: string): string | null {
  for (const [re, label] of OUT_OF_SCOPE) if (re.test(text)) return label;
  return null;
}

export function runGuardrails(input: string): GuardResult {
  const { text, redactions } = redactPII(input);
  return {
    text,
    redactions,
    injection: detectInjection(input),
    abuse: detectAbuse(input),
    outOfScope: detectOutOfScope(input),
  };
}

/** Very small sliding-window rate limiter (per server instance). */
const windows = new Map<string, number[]>();
export function rateLimit(key: string, limit = 15, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    windows.set(key, arr);
    return false;
  }
  arr.push(now);
  windows.set(key, arr);
  return true;
}
