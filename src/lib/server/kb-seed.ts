/**
 * Seed manuals for the fictional company "Meridian Group".
 * Written like real internal SOPs: short sections, numbered steps, one owner each.
 * Every "## " heading becomes one retrievable chunk.
 */
export const KB_SEED: { title: string; category: string; content: string }[] = [
  {
    title: "Connecting to the Office VPN",
    category: "Network",
    content: `# Connecting to the Office VPN
Meridian uses GlobalConnect VPN for access to internal systems (intranet, shared drives, finance tools) from outside the office.

## First-time VPN setup
1. Open the Company Portal app and install **GlobalConnect VPN**.
2. Launch GlobalConnect and enter the portal address \`vpn.meridian.example\`.
3. Sign in with your Meridian email and password, then approve the MFA prompt on your phone.
4. Wait for the shield icon in the taskbar to turn solid. You are now connected.

## VPN will not connect or keeps disconnecting
1. Check that your internet works without the VPN (open any public website).
2. Quit GlobalConnect fully (right-click the tray icon, then Exit) and reopen it.
3. Switch the gateway from **Auto** to **Manila-2** or **Singapore-1** in Settings.
4. If you see "certificate expired" or "profile invalid", your VPN profile needs to be re-issued. The helpdesk assistant can reset your VPN profile automatically.
5. Hotel and café Wi-Fi often block VPN. Try your phone hotspot to confirm.

## VPN is connected but internal sites do not load
1. Disconnect and reconnect once.
2. Clear your browser cache or try a private window.
3. Run \`ipconfig /flushdns\` in Command Prompt (Windows) or restart your Mac.
4. If only one site fails, the problem is that site, not the VPN. Check the status page.`,
  },
  {
    title: "Resetting a Forgotten Password",
    category: "Accounts",
    content: `# Resetting a Forgotten Password
Your Meridian password unlocks email, Teams, the VPN and most business apps (single sign-on).

## Self-service password reset
1. Go to \`password.meridian.example\` from any browser, or ask the helpdesk assistant to send you a reset link.
2. Enter your work email and complete the MFA check.
3. Choose a new password: at least 14 characters, not used in your last 10 passwords.
4. Sign out and back in on your laptop and phone so every app picks up the new password.

## Password rules
- Minimum 14 characters. A short sentence is easier to remember than random symbols.
- Passwords expire every 180 days. You get a reminder 14 days before.
- Never share your password with anyone, including IT staff. IT will never ask for it.

## After resetting, apps still ask for the old password
1. On Windows, lock the screen (Win + L) and unlock with the new password while connected to the office network or VPN.
2. On phones, remove and re-add your work account in Outlook and Teams.
3. Saved Wi-Fi profiles for **Meridian-Secure** must be forgotten and re-joined with the new password.`,
  },
  {
    title: "Account Lockout",
    category: "Accounts",
    content: `# Account Lockout
Accounts lock automatically after 5 failed sign-in attempts within 15 minutes. This protects you from password-guessing attacks.

## How to tell your account is locked
- The sign-in page says "Your account has been locked" or "Too many attempts".
- Correct passwords are rejected on every app at once.

## Unlocking your account
1. Wait 15 minutes; most lockouts clear on their own.
2. For an immediate unlock, ask the helpdesk assistant. It verifies your identity through your active session and clears the lockout.
3. After unlocking, update the password on any old device (a forgotten phone or tablet is the most common cause of repeated lockouts).

## Repeated lockouts
If your account locks again within a day, an old device or saved credential is still trying the wrong password. Check mapped drives, phone mail apps and saved Wi-Fi. If it keeps happening, a ticket will be opened so IT can trace the source.`,
  },
  {
    title: "Requesting Software Access",
    category: "Access",
    content: `# Requesting Software Access
All software is requested through the Software Catalog so licenses are tracked and approved.

## Pre-approved software (installed instantly)
Zoom, Slack, Visual Studio Code, 7-Zip, Notepad++, Google Chrome and Mozilla Firefox are pre-approved. Install them from the Company Portal or ask the helpdesk assistant to provision them.

## Software that needs approval
Figma, Adobe Creative Cloud, Tableau, Salesforce, Jira and Power BI need your manager's approval because they use paid licenses.
1. Ask the helpdesk assistant for access and name the application.
2. Your manager receives an approval request by email and Teams.
3. Once approved, the license is assigned and the app appears in the Company Portal within 30 minutes.

## Software not in the catalog
Submit a ticket with the software name, vendor website and business reason. Security reviews new software within 5 working days.`,
  },
  {
    title: "Multi-Factor Authentication (MFA)",
    category: "Accounts",
    content: `# Multi-Factor Authentication (MFA)
Meridian requires MFA for email, VPN and all cloud apps using the Authenticator app.

## Setting up MFA
1. Install the Microsoft Authenticator app on your phone.
2. Go to \`mysignins.meridian.example\` and choose **Add sign-in method**.
3. Scan the QR code with the Authenticator app and approve the test notification.

## New phone or lost phone
1. If you still have the old phone, add the account to the new phone first, then remove it from the old one.
2. If the old phone is lost or wiped, ask the helpdesk assistant to reset your MFA. It removes the old method and issues a fresh enrollment QR code that is valid for 24 hours.
3. Report a lost company phone the same day so it can be remotely wiped.

## Not receiving MFA prompts
1. Open the Authenticator app manually; pending requests appear there.
2. Check that notifications are allowed for the app and that the phone time is set automatically.
3. Use the 6-digit code in the app instead of the push notification.`,
  },
  {
    title: "Office Wi-Fi",
    category: "Network",
    content: `# Office Wi-Fi
## Which network to use
- **Meridian-Secure**: company laptops and phones. Sign in with your work email and password.
- **Meridian-Guest**: visitors and personal devices. The daily password is shown at reception.

## Cannot join Meridian-Secure
1. Forget the network and join again.
2. When asked, accept the certificate \`radius.meridian.example\`.
3. If you recently changed your password, use the new one.
4. Restart Wi-Fi or the laptop.

## Slow or dropping Wi-Fi
1. Move closer to an access point (the white discs on the ceiling).
2. Disconnect from VPN while in the office; it is not needed on Meridian-Secure.
3. If a whole floor is slow, check the status page; there may be a known incident.`,
  },
  {
    title: "Printers and Scanning",
    category: "Devices",
    content: `# Printers and Scanning
## Adding an office printer
1. Open the Company Portal and install **Meridian Print**.
2. Every printer appears as one queue called \`FollowMe\`. Print to it, then tap your ID badge on any printer to release the job.

## Print job stuck or printer shows offline
1. Open the print queue on your computer and cancel stuck jobs.
2. The helpdesk assistant can clear your print queue and restart the print spooler for you.
3. Make sure you are on Meridian-Secure Wi-Fi or the VPN.

## Scanning to email
Tap your badge, choose **Scan to Me**, and the PDF arrives in your inbox within a minute. Large scans over 25 MB are sent as a OneDrive link instead.

## Paper jams and toner
Follow the diagram on the printer door. Toner is replaced by Facilities; report it at reception. Physical repairs are not handled by the helpdesk assistant.`,
  },
  {
    title: "Email and Outlook",
    category: "Email",
    content: `# Email and Outlook
## Outlook keeps asking for a password
1. Close Outlook completely and reopen it.
2. Sign out of Office (File > Office Account > Sign out) and sign back in.
3. If you recently reset your password, restart the laptop on the office network or VPN.

## Mailbox is full
Each mailbox holds 50 GB. Older mail can be moved to the Online Archive, which is unlimited. The helpdesk assistant can run the mailbox cleanup, which archives items older than 12 months.

## Shared mailboxes
Shared mailboxes (for example \`support@\` or \`finance@\`) appear automatically in Outlook within 60 minutes of access being granted. Request access from the mailbox owner.

## Suspicious email
Do not click links or open attachments. Use the **Report Phishing** button in Outlook. If you already clicked or entered your password, tell the helpdesk assistant immediately so the incident is escalated to Security.`,
  },
  {
    title: "Laptop Running Slow",
    category: "Devices",
    content: `# Laptop Running Slow
## Quick fixes
1. Restart. Laptops left on for weeks slow down. A full restart (not sleep) fixes most cases.
2. Check for updates in Software Center and install pending ones.
3. Close browser tabs you do not need; each tab uses memory.
4. Free disk space: keep at least 15% free. Empty the Downloads folder and Recycle Bin.

## Check what is using resources
Open Task Manager (Ctrl + Shift + Esc) on Windows or Activity Monitor on Mac and sort by CPU or Memory. Close anything unexpected.

## When to request a replacement
Laptops older than 4 years are eligible for a refresh. If your laptop is still slow after the quick fixes, the helpdesk assistant will open a ticket for a hardware check.`,
  },
  {
    title: "Reporting a Security Incident",
    category: "Security",
    content: `# Reporting a Security Incident
Report security problems immediately. Speed matters more than certainty; reporting a false alarm is always fine.

## What counts as an incident
- You clicked a link or opened an attachment in a suspicious email.
- You entered your password on a page you no longer trust.
- Your laptop or phone was lost or stolen.
- You see files, messages or sign-ins you do not recognise.

## What to do right now
1. Disconnect the affected laptop from Wi-Fi if you suspect malware.
2. Tell the helpdesk assistant. Security incidents are escalated as Priority 1 to the Security team.
3. Do not delete the suspicious email; Security needs it for the investigation.
4. Reset your password from a different, trusted device.`,
  },
  {
    title: "Remote Desktop and File Shares",
    category: "Network",
    content: `# Remote Desktop and File Shares
## Opening the shared drive
1. Connect to the VPN if you are outside the office.
2. Open File Explorer and go to \`\\\\files.meridian.example\\departments\`.
3. Your department folder appears automatically. Access to other folders is requested from the folder owner.

## Remote desktop to your office PC
1. Connect to the VPN.
2. Open **Remote Desktop Connection** and enter your PC name (printed on the sticker, for example \`MNL-PC-0412\`).
3. Sign in with your Meridian email and password.

## Access denied on a folder
Folder permissions are owned by the department, not IT. Ask the folder owner listed in the folder properties to add you.`,
  },
  {
    title: "New Employee IT Onboarding",
    category: "Onboarding",
    content: `# New Employee IT Onboarding
## Your first day
1. Collect your laptop and ID badge from reception.
2. Sign in with the temporary password sent to your manager, then set a new password.
3. Set up MFA with the Authenticator app.
4. Open Outlook and Teams once so your mailbox and chats load.

## Accounts you get automatically
Email, Teams, OneDrive, the intranet and the Company Portal. Department tools such as Salesforce or Figma are requested through the Software Catalog.

## Help in your first week
The helpdesk assistant can answer most setup questions any time. For anything it cannot solve, it opens a ticket for the IT team, who reply within one working day.`,
  },
];
