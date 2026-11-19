/**
 * Taglish / Filipino understanding.
 * Rewrites common Filipino and Taglish IT phrasing into the English the intent
 * rules and the manual search already understand, keeping word order so nearby
 * words still line up ("pa-install ng Figma" -> "install Figma").
 * The employee's original text is what gets stored and shown; this is only used
 * to understand it.
 */

const RULES: [RegExp, string][] = [
  // still broken / follow-ups (before the generic "not working" rules)
  [/\b(ayaw|hindi|di|wala)\s+pa\s*rin\b|\b(ganun|ganoon|same|sira)\s+pa\s*rin\b|\b(hindi|di)\s+(gumana|umubra|tumalab)\b/gi, "still not working"],
  [/\bako\s+na\s+lang\b|\b(ipakita|ituro)\s+(mo\s+)?(na\s+lang\s+)?(ang\s+|yung\s+)?(mga\s+)?steps\b|\bturuan\s+mo\s+(na\s+lang\s+)?ako\b/gi, "show me the steps"],
  [/\b(may|meron)\s+(pa\s+)?(akong\s+|isa\s+pang\s+|isang\s+)?tanong(\s+pa)?\b|\bisa\s+pang\s+tanong\b/gi, "I have another question"],
  [/\b(ok|okay|oks|ayos|goods|good)\s+na\b|\b(gumana|gumagana|naayos|nagana|solved|fixed)\s+na\b/gi, "that fixed it"],

  // people
  [/\b(gusto\s+ko|pwede|puwede|paki)\s*.{0,12}\b(makausap|kausapin|maka-?usap)\b.{0,20}\b(tao|agent|it|technician|support|staff)\b/gi, "talk to a human"],
  [/\btao\s+na\s+lang\b|\btotoong\s+tao\b/gi, "real person"],
  [/\bpa-?ticket\b|\bgawa(n|in)?\s+(mo\s+)?(ako\s+)?(ng\s+)?ticket\b|\bmag-?(file|open|bukas)\s+(ng\s+)?ticket\b|\bticket\s+na\s+lang\b/gi, "open a ticket"],

  // accounts
  [/\b(nakalimutan|nalimutan|nakalimot|limot|nakalimutan\s+ko|di\s+ko\s+maalala|hindi\s+ko\s+maalala)\b/gi, "forgot"],
  [/\b(pasword|passwrd|paswrd|passw)\b/gi, "password"],
  [/\b(i-?reset|ireset|pa-?reset|ma-?reset|papalitan|palitan|pa-?palit|mapalitan)\b/gi, "reset"],
  [/\b(na-?lock|nalock|naka-?lock|nakalock|na-?lockout|naka\s+lock|na\s+lock)\b/gi, "locked out"],
  [/\b(hindi|di|ayaw|d)\s+(ako\s+)?(maka-?|makapag-?|mag-?)\s?(login|log\s+in|sign\s+in|signin|pasok)\b/gi, "cannot sign in"],
  [/\b(bagong|bago\s+ang|bago\s+yung)\s+(phone|cellphone|cp|selpon|telepono)\b/gi, "new phone"],
  [/\b(nawala|nawawala|nasira|nanakaw|ninakaw|nabasag)\s+(ko\s+)?(ang\s+|yung\s+)?(phone|cellphone|cp|selpon|telepono)\b/gi, "lost phone"],
  [/\b(nag-?expire|na-?expire|nagexpire|expired\s+na|paso\s+na)\b/gi, "expired"],

  // software
  [/\b(pa-?install|paki-?install|magpa-?install|i-?install|ipa-?install|mag-?install|pakilagay)\b/gi, "install"],
  [/\b(pahingi|paki-?bigay|pabigay|kailangan\s+ko(ng)?|gusto\s+ko(ng)?)\s+(ng\s+)?(access|license|lisensya)\b/gi, "need access"],
  [/\b(kailangan\s+ko(ng)?|gusto\s+ko(ng)?|pahingi)\b/gi, "need"],

  // printing
  [/\b(ayaw|hindi|di)\s+(mag-?print|magprint|maka-?print|lumabas\s+ang\s+print)\b/gi, "won't print"],
  [/\b(na-?stuck|naka-?stuck|nastuck|nakastuck|stuck\s+pa)\b/gi, "stuck"],
  [/\b(nakabinbin|naka-?pila|nakapila)\b/gi, "pending"],

  // mailbox
  [/\b(puno\s+na|napuno|full\s+na|wala\s+nang\s+space|ubos\s+na\s+(ang\s+)?(space|storage))\b/gi, "full"],

  // security
  [/\b(na-?hack|nahack|na-?hacked|hinack)\b/gi, "hacked"],
  [/\b(na-?phish|naphish|na-?scam|nascam)\b/gi, "phished"],
  [/\bmay\s+virus\b/gi, "virus"],
  [/\b(na-?click|naclick|pinindot|pinundot|binuksan)\s+(ko\s+)?(ang\s+|yung\s+)?(link|attachment)\b/gi, "clicked the link"],
  [/\b(nawala|naiwan|nanakaw|ninakaw)\s+(ko\s+)?(ang\s+|yung\s+)?(laptop|computer)\b/gi, "lost my laptop"],

  // hardware
  [/\b(basag|nabasag|may\s+lamat|nalamatan)\b/gi, "cracked"],
  [/\b(natapunan|nabuhusan|natapon|nabasa)\b/gi, "spilled"],
  [/\b(ayaw|hindi|di)\s+(na\s+)?(bumukas|mag-?on|umandar|mag-?boot|nagbu-?boot)\b/gi, "won't turn on"],
  [/\b(namamaga|lumobo)\b/gi, "swollen"],
  [/\b(sira|nasira|sirang|wasak)\b/gi, "broken"],

  // network
  [/\bwalang\s+(internet|wifi|wi-?fi|net|connection|koneksyon)\b/gi, "no internet"],
  [/\b(mahina|mabagal)\s+(ang\s+|yung\s+)?(wifi|wi-?fi|signal|internet|net)\b/gi, "slow wifi"],
  [/\b(nawawala|nawala|naputol|napuputol|nadi-?disconnect|nagdi-?disconnect|nadidisconnect|disconnect\s+nang\s+disconnect)\b/gi, "keeps disconnecting"],
  [/\b(hindi|di|ayaw)\s+(maka-?|makapag-?)?\s?connect\b/gi, "cannot connect"],
  [/\bwalang\s+access\b/gi, "access denied"],

  // performance and generic
  [/\b(mabagal|ang\s+bagal|bumabagal|bumagal|bagal)\b/gi, "slow"],
  [/\b(nagha-?hang|nag-?hang|naghahang|nagfi-?freeze|nag-?freeze|nagfreeze|nagloloko|nag-?lag|naglalag|nagla-?lag)\b/gi, "freezing"],
  [/\b(ayaw|hindi|di)\s+(na\s+)?(gumana|gumagana|mag-?work|nagwo-?work)\b/gi, "not working"],
  [/\b(nag-?e-?error|nag-?error|nageerror|may\s+error)\b/gi, "error"],
  [/\b(bago\s+lang\s+ako|bagong\s+(empleyado|hire|pasok)|first\s+day\s+ko)\b/gi, "new hire"],
];

/** Filler words that carry no meaning for IT intent and only get in the way. */
const FILLER = /\b(po|opo|naman|nga|ba|kasi|eh|lang|yung|'yung|ung|ang|ng|sa|ko|ako|mo|ito|iyan|yan|dito|talaga|sana|daw|raw|kaya|pala|din|rin|na|pa)\b/gi;

const TAGALOG_HINT = /\b(po|opo|ako|ko|mo|yung|ang|ng|sa|hindi|di|ayaw|naman|kasi|pa\s*rin|na\s+lang|nakalimutan|paano|pano|bakit|wala|walang|salamat|kumusta|kamusta|gusto|kailangan|pwede|puwede|mabagal|sira|nasira)\b/i;

export function looksTaglish(text: string): boolean {
  return (text.match(new RegExp(TAGALOG_HINT.source, "gi")) ?? []).length >= 1;
}

/** English rendering of a Filipino / Taglish message for intent rules and search. */
export function normalizeTaglish(text: string): string {
  if (!looksTaglish(text)) return text;
  let t = ` ${text} `;
  for (const [re, en] of RULES) t = t.replace(re, ` ${en} `);
  t = t.replace(FILLER, " ");
  return t.replace(/\s+/g, " ").trim();
}

/** Small-talk patterns in Filipino, used directly by the intent classifier. */
export const FIL_GREETING = /^\s*(kumusta|kamusta|musta|magandang\s+(umaga|hapon|gabi|araw)|hello\s+po|hi\s+po|good\s+(morning|afternoon|evening)\s+po)[\s!.,po]*$/i;
export const FIL_THANKS = /^\s*(salamat|maraming\s+salamat|thank\s+you\s+po|thanks\s+po|tnx|ty\s+po|salamuch)\b[\s\w!.,]{0,30}$/i;
