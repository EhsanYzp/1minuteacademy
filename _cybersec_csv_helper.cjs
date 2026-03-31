const fs = require('fs');
const ce = s => '"' + s.replace(/"/g, '""') + '"';
const courses = [
  'anatomy-of-cyber-attacks',
  'cryptography-secrets-and-ciphers',
  'cyber-warfare-and-digital-espionage',
  'cybersecurity-law-and-ethics',
  'identity-and-authentication',
  'network-security-fundamentals',
  'privacy-in-the-digital-age',
  'social-engineering-the-human-hack',
  'the-dark-web-and-cybercrime',
  'the-history-of-hacking'
];

const issues = {};
const a = (ci, tp, beats, it) => {
  const course = courses[ci];
  for (const b of beats) {
    const bt = {h:'hook',b:'buildup',d:'discovery',t:'twist',c:'climax',p:'punchline'}[b];
    const key = course + '/' + tp + '/' + bt;
    if (!issues[key]) issues[key] = [];
    issues[key].push(it || 'truncated');
  }
};

// Course 0: anatomy-of-cyber-attacks (19 truncated)
a(0,'vulnerability-scanning','b');
a(0,'ddos-attacks-death','d');
a(0,'man-in-the-middle-intercepting','bdt');
a(0,'ransomware-your-files','bt');
a(0,'rootkits','t');
a(0,'spyware','t');
a(0,'trojans','t');
a(0,'worms','t');
a(0,'cross-site-scripting','dt');
a(0,'phishing-pages','c');
a(0,'command-and-control','t');
a(0,'data-exfiltration','t');
a(0,'lateral-movement','t');
a(0,'living-off-the-land','dc');

// Course 1: cryptography (3 truncated)
a(1,'post-quantum-cryptography-preparing-for-the','b');
a(1,'quantum-computing','tc');

// Course 2: cyber-warfare (12 truncated + 1 wrong_emoji)
a(2,'the-estonia','dt');
a(2,'lazarus','d');
a(2,'pegasus','bt');
a(2,'the-solarwinds','t');
a(2,'notpetya','t');
a(2,'notpetya','t','wrong_emoji');
a(2,'cyber-deterrence','t');
a(2,'disinformation','t');
a(2,'election-interference','d');
a(2,'ai-powered-cyber','t');
a(2,'cyber-mercenaries-hackers','d');

// Course 3: cybersecurity-law (88 trunc + 5 double_period + 1 extra_period + 1 grammatical)
a(3,'computer-crime','btc');
a(3,'hacking-back','hd');
a(3,'jurisdiction','dt');
a(3,'the-budapest','hbtc');
a(3,'the-computer-fraud','dt');
a(3,'children-s','hbdc');
a(3,'data-breach','bd');
a(3,'gdpr-europe','bdc');
a(3,'hipaa','hbdtc');
a(3,'the-right-to-be-forgotten','hbtc');
a(3,'bug-bounty','hbdtc');
a(3,'responsible-disclosure','hbt');
a(3,'the-ethics','hbc');
a(3,'the-ethics','d','extra_period');
a(3,'the-whistleblower','bc');
a(3,'the-whistleblower','t','double_period');
a(3,'white-hat','bd');
a(3,'digital-sovereignty','bdtc');
a(3,'free-speech','hd');
a(3,'free-speech','b','double_period');
a(3,'hacktivism','b');
a(3,'net-neutrality','t');
a(3,'surveillance-capitalism','bdtc');
a(3,'the-encryption-debate','bc');
a(3,'cyber-insurance','bdc');
a(3,'cyber-insurance','h','double_period');
a(3,'cyber-insurance','t','double_period');
a(3,'section-230','hbdtc');
a(3,'the-silk-road','hbd');
a(3,'the-yahoo','hbdtc');
a(3,'ai-governance','bdt');
a(3,'autonomous','bt');
a(3,'autonomous','h','grammatical_error');
a(3,'cyber-norms','h');
a(3,'quantum-computing-and','dtc');
a(3,'quantum-computing-and','h','double_period');
a(3,'the-future-of-cyber','bdt');

// Course 4: identity-and-authentication (52 trunc + 1 double_period)
a(4,'brute-force','b');
a(4,'credential-stuffing','hbt');
a(4,'password-hashing','b');
a(4,'password-managers','c');
a(4,'why-people','t');
a(4,'hardware-security','t');
a(4,'mfa-fatigue','b');
a(4,'sms-codes','t');
a(4,'totp','h');
a(4,'two-factor','c');
a(4,'behavioral-biometrics','bd');
a(4,'behavioral-biometrics','t','double_period');
a(4,'fingerprint-scanning','bt');
a(4,'iris-and-retina','ht');
a(4,'spoofing-biometrics','bt');
a(4,'active-directory','btc');
a(4,'identity-federation','d');
a(4,'oauth','bc');
a(4,'privileged-access','b');
a(4,'single-sign-on','c');
a(4,'golden-ticket','hbdt');
a(4,'phishing-the-1','hbdc');
a(4,'session-hijacking','t');
a(4,'sim-swapping','hd');
a(4,'continuous-auth','bt');
a(4,'decentralized-identity','htc');
a(4,'passkeys','hb');
a(4,'the-death-of-the-password','hbdtc');
a(4,'zero-knowledge','t');

// Course 5: network-security (38 truncated)
a(5,'dns-the','b');
a(5,'nat','b');
a(5,'tcp-ip','bc');
a(5,'the-osi-model','b');
a(5,'dmz','bd');
a(5,'intrusion-prevention','dt');
a(5,'tls-ssl','bd');
a(5,'vpn-tunnels','t');
a(5,'what-is-a-firewall','t');
a(5,'bluetooth','t');
a(5,'evil-twin','dt');
a(5,'wep-to-wpa3','t');
a(5,'arp-spoofing','b');
a(5,'bgp-hijacking','bc');
a(5,'packet-sniffing','t');
a(5,'honeypots','b');
a(5,'network-forensics','d');
a(5,'network-segmentation','t');
a(5,'siem','btc');
a(5,'threat-intel','dt');
a(5,'cloud-security','dtc');
a(5,'defense-in-depth','c');
a(5,'iot-security','bt');
a(5,'microsegmentation','h');
a(5,'sd-wan','d');
a(5,'zero-trust','t');

// Course 6: privacy (21 truncated)
a(6,'data-brokers','d');
a(6,'browser-fingerprinting-tracked','c');
a(6,'cookies-and-trackers','t');
a(6,'facial-recognition-the-end','b');
a(6,'metadata-surveillance','h');
a(6,'facebook-and-cambridge','b');
a(6,'google-s-data-empire-what-google','t');
a(6,'smart-speakers','d');
a(6,'surveillance-capitalism-you','dt');
a(6,'china-s-social','b');
a(6,'gdpr-europe','d');
a(6,'massive-data-breaches','hbt');
a(6,'the-right-to-be-forgotten-erasing','t');
a(6,'privacy-vs-security','ht');
a(6,'tor','c');
a(6,'vpns-privacy-shield','ht');

// Course 7: social-engineering (3 truncated)
a(7,'watering-hole-attacks-poisoning-trusted','btc');

// Course 8: dark-web (35 trunc + 1 double_period)
a(8,'cryptocurrency-and-crime','t');
a(8,'dark-web-forums-the','hdtc');
a(8,'how-tor','bt');
a(8,'i2p','bt');
a(8,'surface-deep','b');
a(8,'alphabay','d');
a(8,'exploit-brokers','bt');
a(8,'silk-road-the','t');
a(8,'stolen-data','d');
a(8,'weapons-and-counterfeit','d');
a(8,'ransomware-as-a-service-crime-made','t');
a(8,'ransomware-as-a-service-crime-made','b','double_period');
a(8,'the-ransomware-kill-chain-20','bt');
a(8,'business-email-compromise','bt');
a(8,'credential-stuffing-profiting','hdt');
a(8,'identity-theft','t');
a(8,'romance-scams','t');
a(8,'blockchain-forensics','dt');
a(8,'operation-onymous','t');
a(8,'takedowns','b');
a(8,'ai-powered-cybercrime-the-next-generation','hdtc');
a(8,'cybercrime-as-a-service','d');

// Course 9: history-of-hacking (2 truncated)
a(9,'ransomware-revolution','bt');

// ===== Process TSV =====
const lines = fs.readFileSync('beat-audit-by-subject/Cybersecurity.tsv', 'utf8').trim().split('\n');
let csv = '';
let count = 0;

for (const line of lines) {
  const parts = line.split('\t');
  if (parts.length < 5) continue;
  const [subj, tid, bt, text, emoji] = parts;
  const segments = tid.split('--');
  if (segments.length < 3) continue;
  const courseSlug = segments[1];
  const topicSlug = segments[2].replace(/^t-/, '');

  for (const [key, issueTypes] of Object.entries(issues)) {
    const [specCourse, specPrefix, specBeat] = key.split('/');
    if (specCourse === courseSlug && topicSlug.startsWith(specPrefix) && bt === specBeat) {
      for (const issueType of issueTypes) {
        csv += 'Cybersecurity,' + courseSlug + ',' + tid + ',' + bt + ',' + issueType + ',' + ce(text) + '\n';
        count++;
      }
    }
  }
}

fs.appendFileSync('beat-audit-results.csv', csv);
console.log('Appended ' + count + ' Cybersecurity issues to CSV');
