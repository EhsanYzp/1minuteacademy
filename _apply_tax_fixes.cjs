#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "content", "course-plans");

// Each fix: [file, title, beat, oldText, newText]
const fixes = [
  // === taxes--corporate-tax-strategies.json ===
  [
    "taxes--corporate-tax-strategies.json",
    "What Is Corporate Tax?",
    "buildup",
    "Corporate tax applies to profits, not revenue. A company earning $10 billion in revenue might have $2 billion in taxable profit.",
    "Corporate tax applies to profits, not revenue. A $10B revenue company might have just $2 billion in taxable profit."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "Revenue vs. Profit vs. Taxable Income",
    "climax",
    "The difference between what companies tell Wall Street and what they tell the IRS is the heart of corporate tax strategy.",
    "The gap between what companies tell Wall Street and what they tell the IRS is the heart of corporate tax strategy."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "Who Really Pays Corporate Tax?",
    "discovery",
    "The Congressional Budget Office estimates that about 75% of corporate tax falls on shareholders and 25% on workers through lower wages.",
    "The CBO estimates about 75% of corporate tax falls on shareholders and 25% on workers through lower wages."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "Pass-Through Businesses",
    "hook",
    "Over 90% of US businesses don't pay corporate tax at all. They're 'pass-throughs' where profits flow directly to owners' personal returns.",
    "Over 90% of US businesses skip corporate tax. They're 'pass-throughs' where profits flow directly to owners' returns."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "Pass-Through Businesses",
    "climax",
    "The corporate tax debate overlooks pass-throughs. Most American business profit was never subject to it in the first place.",
    "Corporate tax debates overlook pass-throughs. Most American business profit was never subject to it in the first place."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "Debt vs. Equity: The Tax Bias",
    "hook",
    "Interest on debt is tax-deductible. Dividends on equity are not. This one rule shapes how every corporation finances itself.",
    "Interest on debt is tax-deductible. Dividends are not. This single rule shapes how every corporation finances itself."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "The Stateless Income Problem",
    "twist",
    "The companies aren't breaking laws. They're exploiting the fact that international tax rules were designed for a physical economy, not a digital one.",
    "These companies aren't breaking laws. They exploit tax rules designed for a physical economy, not a digital one."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "How Much Companies Spend on Lobbying",
    "twist",
    "Most of this is legal. Companies hire former congressional staffers who wrote the tax laws to advise them on exploiting those same laws.",
    "Most of this is legal. Firms hire former staffers who wrote tax laws to advise on exploiting those same rules."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "The Revolving Door",
    "buildup",
    "Former IRS commissioners, Treasury officials, and congressional tax staffers command enormous fees from private firms seeking tax advantages.",
    "Former IRS commissioners, Treasury officials, and tax staffers command huge fees from firms seeking tax advantages."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "The Revolving Door",
    "climax",
    "The revolving door ensures that tax expertise flows to those who can pay for it. Public service creates private advantage.",
    "The revolving door ensures tax expertise flows to those who can pay. Public service creates private advantage."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "Tax Industry: TurboTax's Lobbying",
    "discovery",
    "In 2019, investigations revealed Intuit deliberately hid its free filing option from search engines while publicly claiming 'free' filing existed.",
    "In 2019, probes found Intuit hid its free filing option from search engines while claiming 'free' filing existed."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "Country-by-Country Transparency",
    "buildup",
    "Before this, companies reported global totals. You couldn't see that a company earned billions in France but booked profits in Luxembourg.",
    "Before this, companies reported global totals. You couldn't see billions earned in France but booked in Luxembourg."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "Country-by-Country Transparency",
    "discovery",
    "Public reporting creates accountability. Journalists and NGOs can now analyze mismatches between where value is created and where taxes are paid.",
    "Public reporting creates accountability. Journalists can now spot gaps between where value is created and taxes paid."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "Taxing the Digital Economy",
    "discovery",
    "Pillar One of the OECD plan would reallocate taxing rights to countries where customers are\u2014not just where headquarters sit.",
    "Pillar One would reallocate taxing rights to countries where customers are\u2014not just where headquarters sit."
  ],
  [
    "taxes--corporate-tax-strategies.json",
    "The End of Low Corporate Tax?",
    "climax",
    "Corporate tax is in its most turbulent era ever. Whether the system gets fairer or just more complex depends on political will.",
    "Corporate tax is in its most turbulent era. Whether the system gets fairer or more complex depends on political will."
  ],

  // === taxes--cryptocurrency-and-taxes.json ===
  [
    "taxes--cryptocurrency-and-taxes.json",
    "The Coinbase Court Order",
    "punchline",
    "800 reported, 14,000 suspected. One court order changed crypto tax compliance forever.",
    "800 reported, 14,000 suspected. One court order reshaped crypto tax compliance."
  ],
  [
    "taxes--cryptocurrency-and-taxes.json",
    "The Crypto Question on Form 1040",
    "hook",
    "Starting in 2020, the IRS added a crypto question to the top of Form 1040: 'Did you sell or exchange any virtual currency?'",
    "In 2020, the IRS added a crypto question atop Form 1040, asking if you sold or exchanged any virtual currency."
  ],
  [
    "taxes--cryptocurrency-and-taxes.json",
    "The Crypto Question on Form 1040",
    "discovery",
    "Lying on a federal tax return is perjury. The question turned crypto non-reporting from negligence into a potential crime.",
    "Lying on a tax return is perjury. The question turned crypto non-reporting from negligence into a potential crime."
  ],
  [
    "taxes--cryptocurrency-and-taxes.json",
    "Capital Gains on Crypto",
    "discovery",
    "This creates a 'HODL' tax incentive. Holding crypto over a year can save 17 percentage points in taxes over selling quickly.",
    "This creates a 'HODL' incentive. Holding crypto over a year can save 17 percentage points in tax over selling quickly."
  ],
  [
    "taxes--cryptocurrency-and-taxes.json",
    "Capital Gains on Crypto",
    "twist",
    "Unlike stocks, crypto trades 24/7. A midnight New Year's trade could mean the difference between short and long-term rates.",
    "Unlike stocks, crypto trades 24/7. A midnight New Year's trade could decide between short-term and long-term rates."
  ],
  [
    "taxes--cryptocurrency-and-taxes.json",
    "Crypto-to-Crypto Trades",
    "hook",
    "Swapping Bitcoin for Ethereum isn't tax-free. The IRS treats every crypto-to-crypto trade as selling one asset and buying another.",
    "Swapping Bitcoin for Ethereum isn't tax-free. The IRS treats every crypto-to-crypto trade as a sale and new purchase."
  ],
  [
    "taxes--cryptocurrency-and-taxes.json",
    "Lost Wallets and Phantom Gains",
    "twist",
    "If you can't prove the crypto is permanently lost, you can't deduct it. The burden of proof for a negative is nearly impossible.",
    "If you can't prove crypto is permanently lost, you can't deduct it. Proving a negative is nearly impossible."
  ],
  [
    "taxes--cryptocurrency-and-taxes.json",
    "Wrapped Tokens and Tax Events",
    "twist",
    "The IRS hasn't ruled on wrapped tokens. Users choosing DeFi face a legal void where reasonable people reach opposite conclusions.",
    "The IRS hasn't ruled on wrapped tokens. DeFi users face a legal void where reasonable people reach opposite conclusions."
  ],
  [
    "taxes--cryptocurrency-and-taxes.json",
    "Wrapped Tokens and Tax Events",
    "climax",
    "Wrapped tokens show how crypto's layered ecosystem creates tax questions that didn't exist five years ago and have no answers yet.",
    "Wrapped tokens show how crypto's layered ecosystem creates tax questions unknown five years ago that remain unsolved."
  ],
  [
    "taxes--cryptocurrency-and-taxes.json",
    "India's 30% Crypto Tax",
    "buildup",
    "India had debated banning crypto entirely. Instead, it chose the second-harshest approach: tax it so heavily that trading becomes painful.",
    "India debated banning crypto entirely. Instead, it chose the harshest alternative: tax it so heavily that trading hurts."
  ],
  [
    "taxes--cryptocurrency-and-taxes.json",
    "Chainalysis: Following the Money",
    "punchline",
    "$3.5 billion seized in one case. Blockchain analytics made crypto fully traceable.",
    "$3.5 billion seized in one case. Blockchain analytics made crypto traceable."
  ],
  [
    "taxes--cryptocurrency-and-taxes.json",
    "NFT Tax Confusion",
    "climax",
    "NFTs push tax law into absurdity. Classifying infinitely diverse digital tokens into rigid tax categories may be impossible.",
    "NFTs push tax law into absurdity. Classifying infinitely diverse digital tokens into rigid categories may be impossible."
  ],
  [
    "taxes--cryptocurrency-and-taxes.json",
    "Will Crypto Kill Tax Evasion\u2014Or Enable It?",
    "hook",
    "Blockchain records everything forever. Paradoxically, the technology built for freedom might create the most transparent tax system in history.",
    "Blockchain records everything forever. Technology built for freedom might create the most transparent tax system ever."
  ],
  [
    "taxes--cryptocurrency-and-taxes.json",
    "Will Crypto Kill Tax Evasion\u2014Or Enable It?",
    "twist",
    "But privacy technology keeps advancing. Zero-knowledge proofs let users prove they paid tax without revealing the transaction.",
    "But privacy tech keeps advancing. Zero-knowledge proofs let users prove they paid tax without revealing the transaction."
  ],

  // === taxes--famous-tax-revolts.json ===
  [
    "taxes--famous-tax-revolts.json",
    "The Nika Riots",
    "buildup",
    "Justinian's tax collector, John the Cappadocian, squeezed citizens to fund wars and grand buildings like the Hagia Sophia.",
    "Justinian's tax collector, John the Cappadocian, squeezed citizens to fund wars and buildings like the Hagia Sophia."
  ],
  [
    "taxes--famous-tax-revolts.json",
    "The Russian Revolution's Tax Roots",
    "hook",
    "Russia's 1917 revolution had deep tax roots. Peasants paid crushing 'redemption payments' for land they thought was already theirs.",
    "Russia's 1917 revolution had tax roots. Peasants paid crushing 'redemption payments' for land they thought was theirs."
  ],
  [
    "taxes--famous-tax-revolts.json",
    "The Mexican Revolution and Hacienda Taxes",
    "hook",
    "Mexico's 1910 revolution exploded partly because hacienda owners paid minimal taxes while peasants lost their communal lands.",
    "Mexico's 1910 revolution exploded partly because hacienda owners paid minimal taxes while peasants lost communal lands."
  ],

  // === taxes--history-of-taxation.json ===
  [
    "taxes--history-of-taxation.json",
    "The Church Tithe",
    "twist",
    "Some countries still collect church taxes today. Germany deducts a church tax from your paycheck unless you formally leave.",
    "Some countries still collect church taxes. Germany deducts a church tax from your paycheck unless you formally leave."
  ],
  [
    "taxes--history-of-taxation.json",
    "The Stamp Act Crisis",
    "climax",
    "The American Revolution started as a tax dispute. Independence was born from a disagreement about who has the right to tax.",
    "The American Revolution started as a tax dispute. Independence was born from a debate about who has the right to tax."
  ],
  [
    "taxes--history-of-taxation.json",
    "The Laffer Curve",
    "hook",
    "Arthur Laffer drew a curve on a napkin in 1974. It argued that raising tax rates past a certain point reduces total revenue.",
    "Arthur Laffer drew a curve on a napkin in 1974. He argued raising tax rates past a certain point cuts total revenue."
  ],
  [
    "taxes--history-of-taxation.json",
    "The Rise of Tax Havens",
    "twist",
    "Tax havens aren't just islands. The US state of Delaware and the City of London are themselves major secrecy jurisdictions.",
    "Tax havens aren't just islands. Delaware and the City of London are themselves major secrecy jurisdictions."
  ],
  [
    "taxes--history-of-taxation.json",
    "Wealth Tax Debate",
    "discovery",
    "Jeff Bezos' wealth grew by $75 billion in 2020 while his taxable income was a fraction of that. Wealth escapes income tax.",
    "Bezos' wealth grew $75 billion in 2020 while his taxable income was a fraction of that. Wealth escapes income tax."
  ],

  // === taxes--how-income-tax-works.json ===
  [
    "taxes--how-income-tax-works.json",
    "Who Pays Income Tax?",
    "buildup",
    "Low earners, retirees, and families with children often qualify for enough deductions and credits to reduce their bill to zero.",
    "Low earners, retirees, and families with children often qualify for enough deductions and credits to owe nothing."
  ],
  [
    "taxes--how-income-tax-works.json",
    "The Alternative Minimum Tax",
    "hook",
    "The AMT is a shadow tax system. It recalculates your tax without most deductions to ensure high earners pay a minimum amount.",
    "The AMT is a shadow tax system. It recalculates your tax without most deductions to ensure high earners pay a minimum."
  ],
  [
    "taxes--how-income-tax-works.json",
    "The Alternative Minimum Tax",
    "twist",
    "The AMT wasn't indexed to inflation for decades. By 2017, it hit millions of middle-class families it was never meant to target.",
    "The AMT wasn't indexed to inflation for decades. By 2017, it hit millions of middle-class families it never targeted."
  ],
  [
    "taxes--how-income-tax-works.json",
    "Filing Status Matters",
    "twist",
    "The 'marriage penalty' hits some high-earning couples: filing jointly pushes combined income into higher brackets than filing separately.",
    "The 'marriage penalty' hits some high-earning couples: joint filing pushes combined income into higher brackets."
  ],
  [
    "taxes--how-income-tax-works.json",
    "What Happens If You Don't File",
    "discovery",
    "The IRS rarely prosecutes ordinary late filers. They focus enforcement on deliberate fraud and high-dollar evasion cases.",
    "The IRS rarely prosecutes late filers. They focus enforcement on deliberate fraud and high-dollar evasion cases."
  ],
  [
    "taxes--how-income-tax-works.json",
    "State Income Tax Differences",
    "discovery",
    "Remote work has enabled 'tax migration.' Workers move to zero-tax states while keeping high-paying jobs in expensive cities.",
    "Remote work enabled 'tax migration.' Workers move to zero-tax states while keeping high-paying jobs in expensive cities."
  ],
  [
    "taxes--how-income-tax-works.json",
    "Tax Avoidance vs. Tax Evasion",
    "twist",
    "Aggressive 'tax shelters' blur the line. Some arrangements are technically legal but exploit loopholes Congress never foresaw.",
    "Aggressive 'tax shelters' blur the line. Some arrangements are legal but exploit loopholes Congress never intended."
  ],

  // === taxes--psychology-of-paying-taxes.json ===
  [
    "taxes--psychology-of-paying-taxes.json",
    "Procedural Justice in Taxation",
    "discovery",
    "The Australian Tax Office found that taxpayers treated respectfully during audits were 40% more likely to comply in future years.",
    "Australia's Tax Office found taxpayers treated well during audits were 40% more likely to comply in future years."
  ],
  [
    "taxes--psychology-of-paying-taxes.json",
    "Social Norms and Tax Honesty",
    "hook",
    "In a Minnesota experiment, telling taxpayers '93% of your neighbors pay on time' increased compliance more than threatening penalties.",
    "A Minnesota study found telling taxpayers '93% of neighbors pay on time' boosted compliance more than threats."
  ],
  [
    "taxes--psychology-of-paying-taxes.json",
    "Social Norms and Tax Honesty",
    "climax",
    "Every news story about widespread tax evasion may actually increase evasion by normalizing it. Messaging matters enormously.",
    "Every news story about widespread tax evasion may actually boost evasion by normalizing it. Messaging matters deeply."
  ],
  [
    "taxes--psychology-of-paying-taxes.json",
    "Tax Morale: The Invisible Engine",
    "discovery",
    "World Values Survey data shows tax morale is highest in Scandinavian countries and lowest in parts of Latin America and Africa.",
    "World Values Survey data shows tax morale is highest in Scandinavia and lowest in parts of Latin America and Africa."
  ],

  // === taxes--sales-tax-around-the-world.json ===
  [
    "taxes--sales-tax-around-the-world.json",
    "The Gabelle: France's Salt Tax",
    "discovery",
    "Salt smuggling became a huge underground economy. Thousands of armed 'faux-sauniers' smuggled salt across regional borders.",
    "Salt smuggling became a huge underground economy. Thousands of armed 'faux-sauniers' smuggled salt across borders."
  ],
  [
    "taxes--sales-tax-around-the-world.json",
    "The Fat Tax: Denmark's Failed Experiment",
    "climax",
    "Denmark's fat tax proved a principle: consumption taxes fail when borders are close and the taxed product is available next door.",
    "Denmark's fat tax proved a principle: consumption taxes fail when borders are close and the product is sold next door."
  ],
  [
    "taxes--sales-tax-around-the-world.json",
    "Tax Salience: Hidden vs. Visible Taxes",
    "twist",
    "Europe's inclusive pricing is more transparent but collects less because shoppers feel the full cost upfront and buy less.",
    "Europe's inclusive pricing is transparent but collects less because shoppers feel the full cost upfront and buy less."
  ],
  [
    "taxes--sales-tax-around-the-world.json",
    "Why People Accept Some Taxes More",
    "twist",
    "Governments know this. Payroll withholding was invented in WWII specifically to make income tax less painful and less visible.",
    "Governments know this. Payroll withholding was invented in WWII to make income tax less painful and less visible."
  ],
  [
    "taxes--sales-tax-around-the-world.json",
    "Real-Time Tax Collection",
    "hook",
    "Brazil pioneered real-time electronic invoicing. Every transaction is reported to the tax authority the instant it happens.",
    "Brazil pioneered real-time electronic invoicing. Every transaction is reported to the tax authority instantly."
  ],

  // === taxes--tax-havens-and-offshore-finance.json ===
  [
    "taxes--tax-havens-and-offshore-finance.json",
    "Legal vs. Illegal Offshore",
    "climax",
    "The offshore world operates in a gray zone. Most structures are legal but designed to be as close to invisible as possible.",
    "The offshore world operates in a gray zone. Most structures are legal but designed to be nearly invisible."
  ],
  [
    "taxes--tax-havens-and-offshore-finance.json",
    "Delaware: America's Haven",
    "twist",
    "The US criticizes foreign tax havens while hosting one of the world's largest secrecy jurisdictions within its own borders.",
    "The US criticizes foreign tax havens while hosting one of the world's largest secrecy jurisdictions on its own soil."
  ],
  [
    "taxes--tax-havens-and-offshore-finance.json",
    "The Paradise Papers",
    "buildup",
    "The leak revealed offshore interests of Nike, Apple, Uber, and the estates of Queen Elizabeth II and the US Commerce Secretary.",
    "The leak revealed offshore interests of Nike, Apple, Uber, Queen Elizabeth II's estate, and the US Commerce Secretary."
  ],
  [
    "taxes--tax-havens-and-offshore-finance.json",
    "FATCA: America's Long Arm",
    "discovery",
    "Over 300,000 foreign banks now comply with FATCA. The US government reached into the world's banking system from Washington.",
    "Over 300,000 foreign banks now comply with FATCA. The US reached into the world's banking system from Washington."
  ],
  [
    "taxes--tax-havens-and-offshore-finance.json",
    "The OECD's Pillar Two",
    "twist",
    "Implementation is uneven. The US hasn't fully enacted it. Ireland adjusted its rate from 12.5% to 15% to keep revenue at home.",
    "Implementation is uneven. The US hasn't fully enacted it. Ireland moved from 12.5% to 15% to keep revenue at home."
  ],
  [
    "taxes--tax-havens-and-offshore-finance.json",
    "Beneficial Ownership Registers",
    "hook",
    "Who really owns that shell company? Beneficial ownership registers force disclosure of the real humans behind anonymous entities.",
    "Who really owns that shell company? Ownership registers force disclosure of the real humans behind anonymous entities."
  ],
  [
    "taxes--tax-havens-and-offshore-finance.json",
    "Beneficial Ownership Registers",
    "climax",
    "Transparency is advancing, but shell companies can use nominees and layers to obscure true ownership even in registered systems.",
    "Transparency advances, but shell companies use nominees and layers to obscure true ownership even in registered systems."
  ],
  [
    "taxes--tax-havens-and-offshore-finance.json",
    "Will Tax Havens Survive?",
    "twist",
    "Cryptocurrency offers a new kind of offshore: decentralized, borderless finance that exists beyond any government's direct control.",
    "Crypto offers a new kind of offshore: decentralized, borderless finance beyond any government's direct control."
  ],
  [
    "taxes--tax-havens-and-offshore-finance.json",
    "Crypto as the New Offshore",
    "buildup",
    "Decentralized exchanges and privacy coins like Monero allow transactions that are nearly impossible for tax authorities to trace.",
    "Decentralized exchanges and privacy coins like Monero allow transactions nearly impossible for tax authorities to trace."
  ],
  [
    "taxes--tax-havens-and-offshore-finance.json",
    "Tax Competition or Tax War?",
    "climax",
    "There's no neutral answer. Tax competition versus cooperation is a values choice about what kind of global economy we want.",
    "There's no neutral answer. Tax competition versus cooperation is a values choice about what global economy we want."
  ],

  // === taxes--taxes-that-shaped-civilizations.json ===
  [
    "taxes--taxes-that-shaped-civilizations.json",
    "Athens' Liturgy System",
    "climax",
    "Athens funded democracy without income tax. Social obligation and status competition did what modern tax systems need armies of auditors to achieve.",
    "Athens funded democracy without income tax. Social obligation achieved what modern systems need audit armies to match."
  ],
  [
    "taxes--taxes-that-shaped-civilizations.json",
    "The Gabelle and the French Revolution",
    "buildup",
    "Salt smuggling became a massive enterprise. Thousands were imprisoned annually for buying cheaper salt across regional borders.",
    "Salt smuggling became a massive enterprise. Thousands were jailed yearly for buying cheaper salt across borders."
  ],
  [
    "taxes--taxes-that-shaped-civilizations.json",
    "The VAT Revolution",
    "hook",
    "France invented the Value Added Tax in 1954. Today 170 countries use it. The VAT is the most successful tax innovation of the 20th century.",
    "France invented the VAT in 1954. Now 170 countries use it. It's the most successful tax innovation of the 20th century."
  ],

  // === taxes--the-irs-americas-tax-collector.json ===
  [
    "taxes--the-irs-americas-tax-collector.json",
    "Lincoln Creates the Tax Bureau",
    "buildup",
    "The Union was spending $2 million per day. Tariffs couldn't cover it. Lincoln created the first income tax: 3% on income over $800.",
    "The Union spent $2 million a day. Tariffs fell short. Lincoln created the first income tax: 3% on income over $800."
  ],
  [
    "taxes--the-irs-americas-tax-collector.json",
    "Withholding: The Invisible Collection",
    "climax",
    "Withholding is the IRS's most powerful tool. By taking money before you see it, it eliminates the decision to pay entirely.",
    "Withholding is the IRS's strongest tool. By taking money before you see it, it eliminates the decision to pay entirely."
  ],
  [
    "taxes--the-irs-americas-tax-collector.json",
    "The Taxpayer Advocate",
    "twist",
    "Recent Advocates have publicly criticized the IRS for disproportionately auditing low-income earners while ignoring wealthy tax cheats.",
    "Recent Advocates criticized the IRS for disproportionately auditing low-income earners while ignoring wealthy cheats."
  ],
  [
    "taxes--the-irs-americas-tax-collector.json",
    "The Church of Scientology vs. the IRS",
    "climax",
    "Scientology vs. IRS showed that even the most powerful agency can be overwhelmed by sheer legal pressure from a determined opponent.",
    "Scientology vs. IRS showed even the most powerful agency can be overwhelmed by sheer pressure from one opponent."
  ],
  [
    "taxes--the-irs-americas-tax-collector.json",
    "The IRS Tea Party Scandal",
    "hook",
    "In 2013, the IRS admitted it had singled out Tea Party groups for extra scrutiny when they applied for tax-exempt status. Both parties erupted.",
    "In 2013, the IRS admitted targeting Tea Party groups for extra scrutiny on tax-exempt bids. Both parties erupted."
  ],
  [
    "taxes--the-irs-americas-tax-collector.json",
    "The IRS Tea Party Scandal",
    "discovery",
    "An inspector general report confirmed the targeting was real but found no evidence of political orders from the White House.",
    "An inspector general confirmed the targeting was real but found no evidence of political orders from the White House."
  ],
  [
    "taxes--the-irs-americas-tax-collector.json",
    "Auditing the Poor",
    "discovery",
    "ProPublica's analysis showed that majority-Black counties in the Deep South were audited at much higher rates than wealthy suburbs.",
    "ProPublica found majority-Black counties in the Deep South were audited at much higher rates than wealthy suburbs."
  ],
  [
    "taxes--the-irs-americas-tax-collector.json",
    "The Political Weapon Accusation",
    "twist",
    "Despite safeguards, the accusation never dies. Every IRS enforcement action against a politically connected person triggers weaponization claims.",
    "The accusation never dies. Every IRS action against a politically connected person triggers weaponization claims."
  ],
];

// Limits per beat
const LIMITS = {
  hook: 120,
  buildup: 120,
  discovery: 120,
  twist: 120,
  climax: 120,
  punchline: 80,
};

const DANGLING =
  /\b(a|an|the|of|in|on|at|to|for|and|but|or|is|it|by|as|no|so|if|its|was|has|had|are|be|do|my|we|he|she|our|can|all|from|with|that|this|than|into|also|not|yet|nor|per|via)\.\s*$/i;

// Pre-validate all fixes
let preErrors = 0;
for (const [file, title, beat, oldText, newText] of fixes) {
  const limit = LIMITS[beat];
  if (newText.length > limit) {
    console.error(
      `PRE-CHECK FAIL: ${file} / "${title}" / ${beat}: new text is ${newText.length} chars (limit ${limit})`
    );
    console.error(`  NEW: "${newText}"`);
    preErrors++;
  }
  if (!/[.!?]\s*$/.test(newText)) {
    console.error(
      `PRE-CHECK FAIL: ${file} / "${title}" / ${beat}: new text doesn't end with sentence punctuation`
    );
    preErrors++;
  }
  if (DANGLING.test(newText)) {
    console.error(
      `PRE-CHECK FAIL: ${file} / "${title}" / ${beat}: new text ends with dangling word`
    );
    preErrors++;
  }
}

if (preErrors > 0) {
  console.error(`\n${preErrors} pre-check errors found. Aborting.`);
  process.exit(1);
}

console.log(`All ${fixes.length} fixes pass pre-check. Applying...`);

// Group fixes by file
const byFile = {};
for (const fix of fixes) {
  const file = fix[0];
  if (!byFile[file]) byFile[file] = [];
  byFile[file].push(fix);
}

let applied = 0;
let errors = 0;

for (const [file, fileFixes] of Object.entries(byFile)) {
  const filePath = path.join(DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  for (const [, title, beat, oldText, newText] of fileFixes) {
    const topic = data.topics.find((t) => t.title === title);
    if (!topic) {
      console.error(`ERROR: Topic "${title}" not found in ${file}`);
      errors++;
      continue;
    }
    const current = topic.story[beat].text;
    if (current !== oldText) {
      console.error(
        `ERROR: Text mismatch for "${title}" / ${beat} in ${file}`
      );
      console.error(`  EXPECTED: "${oldText}"`);
      console.error(`  FOUND:    "${current}"`);
      errors++;
      continue;
    }
    topic.story[beat].text = newText;
    applied++;
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`  Updated ${file} (${fileFixes.length} fixes)`);
}

console.log(`\nDone. Applied: ${applied}, Errors: ${errors}`);
