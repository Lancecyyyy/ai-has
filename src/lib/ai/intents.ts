/**
 * Intent analysis: decides whether a request is routine (automation),
 * informational (answer from manuals) or needs a human (ticket).
 */

export type IntentId =
  | "greeting"
  | "thanks"
  | "resolved"
  | "human"
  | "password_reset"
  | "account_unlock"
  | "mfa_reset"
  | "vpn_reset"
  | "software_access"
  | "print_queue"
  | "mailbox_cleanup"
  | "security_incident"
  | "hardware_repair"
  | "vpn"
  | "wifi"
  | "email"
  | "printer"
  | "performance"
  | "files"
  | "onboarding"
  | "general";

export interface Intent {
  id: IntentId;
  label: string;
  category: string;
  /** automation workflow id when the intent is routine */
  workflow?: string;
  score: number;
}

const DEFS: { id: IntentId; label: string; category: string; workflow?: string; patterns: RegExp[] }[] = [
  { id: "security_incident", label: "Security incident", category: "Security", patterns: [/\b(phish\w*|hacked|malware|virus|ransomware|suspicious (email|link|login|sign-?in)|clicked (a|the|on)? ?(link|attachment)|stolen|lost (my )?(laptop|phone)|compromised)\b/i] },
  { id: "human", label: "Asked for a human", category: "General", patterns: [/\b(talk|speak|chat|connect)\b.{0,20}\b(human|person|agent|someone|technician|it staff)\b|\b(real person|human agent|live agent|escalate|open a ticket|create a ticket|file a ticket)\b/i] },
  { id: "password_reset", label: "Password reset", category: "Accounts", workflow: "password_reset", patterns: [/\b(forgot|forgotten|reset|change|expired|new)\b.{0,25}\bpass(word|code)?\b|\bpassword\b.{0,25}\b(reset|forgot|forgotten|expired|not working|doesn'?t work|wrong)\b/i] },
  { id: "account_unlock", label: "Account unlock", category: "Accounts", workflow: "account_unlock", patterns: [/\b(locked out|account (is )?locked|lockout|too many (attempts|tries)|unlock (my )?account)\b/i] },
  { id: "mfa_reset", label: "MFA reset", category: "Accounts", workflow: "mfa_reset", patterns: [/\b(new|lost|changed|replaced|broke|reset)\b.{0,20}\b(phone|mfa|authenticator|2fa)\b.{0,40}\b(mfa|authenticator|2fa|code|sign|login)?\b|\breset (my )?(mfa|2fa|authenticator)\b/i] },
  { id: "vpn_reset", label: "VPN profile reset", category: "Network", workflow: "vpn_reset", patterns: [/\b(vpn|globalconnect)\b.{0,40}\b(certificate|cert|profile)\b.{0,20}\b(expired|invalid|error|reset)?|\breset (my )?vpn\b/i] },
  { id: "software_access", label: "Software access", category: "Access", workflow: "software_access", patterns: [/\b(access|install|license|licence|request|need|get)\b.{0,30}\b(figma|adobe|photoshop|tableau|salesforce|jira|power ?bi|zoom|slack|vs ?code|visual studio code|chrome|firefox|7-?zip|notepad\+\+)\b/i] },
  { id: "print_queue", label: "Clear print queue", category: "Devices", workflow: "print_queue", patterns: [/\b(print(er)?|printing)\b.{0,30}\b(stuck|queue|offline|not printing|won'?t print|jammed queue|pending)\b|\b(stuck|pending)\b.{0,20}\bprint/i] },
  { id: "mailbox_cleanup", label: "Mailbox cleanup", category: "Email", workflow: "mailbox_cleanup", patterns: [/\b(mailbox|inbox|outlook|email)\b.{0,25}\b(full|storage|quota|out of space|almost full)\b/i] },
  { id: "hardware_repair", label: "Physical repair", category: "Hardware", patterns: [
    /\b(broken|cracked|shattered|spilled|dead pixels?|replace(ment)?|damaged|smashed|loose)\b.{0,30}\b(screen|display|keyboard|laptop|monitor|mouse|charger|battery|trackpad|hinge|keys?)\b/i,
    /\b(screen|display|keyboard|laptop|monitor|mouse|charger|battery|trackpad|hinge)\b.{0,25}\b(broken|cracked|shattered|damaged|swollen|bloated|won'?t turn on|not turning on|dead)\b/i,
    /\bspilled\b/i,
  ] },
  { id: "vpn", label: "VPN", category: "Network", patterns: [/\b(vpn|globalconnect|remote access|work from home|wfh)\b/i] },
  { id: "wifi", label: "Wi-Fi", category: "Network", patterns: [/\b(wi-?fi|wireless|internet|network|meridian-secure|guest network)\b/i] },
  { id: "email", label: "Email & Outlook", category: "Email", patterns: [/\b(outlook|email|e-mail|mailbox|shared mailbox|inbox)\b/i] },
  { id: "printer", label: "Printing", category: "Devices", patterns: [/\b(print\w*|scan\w*|toner|followme)\b/i] },
  { id: "performance", label: "Slow laptop", category: "Devices", patterns: [/\b(slow|lag\w*|freez\w*|hang\w*|sluggish|takes forever|not responding)\b/i] },
  { id: "files", label: "Files & remote desktop", category: "Network", patterns: [/\b(shared drive|file share|folder|remote desktop|rdp|access denied|permission)\b/i] },
  { id: "onboarding", label: "Onboarding", category: "Onboarding", patterns: [/\b(new (hire|employee|joiner)|first day|onboard\w*|just joined|starting (today|this week))\b/i] },
];

const GREETING = /^\s*(hi|hello|hey|good (morning|afternoon|evening)|yo|kumusta|hiya)[\s!.,]*$/i;
const THANKS = /^\s*(thanks?|thank you|ty|salamat|cheers|appreciate it)\b[\s\w!.,]{0,30}$/i;
const RESOLVED = /^\s*(that (fixed|solved|worked)|it works( now)?|solved|fixed it|all good( now)?|problem solved)\b/i;

export function classifyIntent(text: string): Intent {
  if (RESOLVED.test(text)) return { id: "resolved", label: "Confirmed fixed", category: "General", score: 1 };
  if (THANKS.test(text)) return { id: "thanks", label: "Thanks", category: "General", score: 1 };
  if (GREETING.test(text)) return { id: "greeting", label: "Greeting", category: "General", score: 1 };
  for (const d of DEFS) {
    if (d.patterns.some((p) => p.test(text))) {
      return { id: d.id, label: d.label, category: d.category, workflow: d.workflow, score: 0.9 };
    }
  }
  return { id: "general", label: "General question", category: "General", score: 0.3 };
}

export const SOFTWARE_CATALOG: Record<string, { name: string; preApproved: boolean }> = {
  figma: { name: "Figma", preApproved: false },
  adobe: { name: "Adobe Creative Cloud", preApproved: false },
  photoshop: { name: "Adobe Creative Cloud", preApproved: false },
  tableau: { name: "Tableau", preApproved: false },
  salesforce: { name: "Salesforce", preApproved: false },
  jira: { name: "Jira", preApproved: false },
  "power bi": { name: "Power BI", preApproved: false },
  powerbi: { name: "Power BI", preApproved: false },
  zoom: { name: "Zoom", preApproved: true },
  slack: { name: "Slack", preApproved: true },
  "vs code": { name: "Visual Studio Code", preApproved: true },
  vscode: { name: "Visual Studio Code", preApproved: true },
  "visual studio code": { name: "Visual Studio Code", preApproved: true },
  chrome: { name: "Google Chrome", preApproved: true },
  firefox: { name: "Mozilla Firefox", preApproved: true },
  "7-zip": { name: "7-Zip", preApproved: true },
  "7zip": { name: "7-Zip", preApproved: true },
  "notepad++": { name: "Notepad++", preApproved: true },
};

export function extractSoftware(text: string): { name: string; preApproved: boolean } | null {
  const t = text.toLowerCase();
  for (const key of Object.keys(SOFTWARE_CATALOG).sort((a, b) => b.length - a.length)) {
    if (t.includes(key)) return SOFTWARE_CATALOG[key];
  }
  return null;
}

/** Ticket priority from wording + intent. */
export function inferPriority(text: string, intent: IntentId): "P1" | "P2" | "P3" {
  if (intent === "security_incident") return "P1";
  if (/\b(everyone|whole (team|floor|office)|all users|outage|down for|production|urgent|asap|client meeting|cannot work|can'?t work)\b/i.test(text)) return "P1";
  if (/\b(not working|error|broken|can'?t|cannot|failed|fails)\b/i.test(text)) return "P2";
  return "P3";
}
