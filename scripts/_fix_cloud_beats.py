#!/usr/bin/env python3
"""Fix all beat-length violations in cloud-computing course plans."""
import json, glob, os

BEAT_MAX = 120
PUNCH_MAX = 80

# Map: (filename, topic_index, beat_key) -> replacement text
FIXES = {
    # === cloud-computing--cloud-architecture-patterns.json (6 violations) ===
    ("cloud-computing--cloud-architecture-patterns.json", 0, "buildup"):
        "Distributed systems split work across many services. Each runs independently and communicates over the network.",
    ("cloud-computing--cloud-architecture-patterns.json", 14, "twist"):
        "CDNs work great for static content. Dynamic, personalized content is harder — you can't cache what differs per user.",
    ("cloud-computing--cloud-architecture-patterns.json", 17, "buildup"):
        "Chaos engineering injects failures on purpose to test resilience. Kill a server. Slow the network. See what happens.",
    ("cloud-computing--cloud-architecture-patterns.json", 17, "twist"):
        "Most teams fear breaking things on purpose. But controlled failure tests beat discovering weaknesses during outages.",
    ("cloud-computing--cloud-architecture-patterns.json", 25, "twist"):
        "Cold starts — the delay when a function hasn't run recently — add seconds of latency. That matters for real-time apps.",
    ("cloud-computing--cloud-architecture-patterns.json", 29, "buildup"):
        "The framework covers six pillars: security, reliability, performance, cost optimization, operations, and sustainability.",

    # === cloud-computing--cloud-data-and-storage.json (9 violations) ===
    ("cloud-computing--cloud-data-and-storage.json", 6, "buildup"):
        "NoSQL databases trade rigid structure for flexibility. Key-value, document, column, and graph each fit different data.",
    ("cloud-computing--cloud-data-and-storage.json", 9, "discovery"):
        "Spanner, CockroachDB, and Cosmos DB offer globally distributed databases, solving the latency vs. consistency dilemma.",
    ("cloud-computing--cloud-data-and-storage.json", 10, "discovery"):
        "They use columnar storage: instead of reading entire rows, they scan only the columns you need. Much faster for queries.",
    ("cloud-computing--cloud-data-and-storage.json", 17, "twist"):
        "Search clusters are resource-hungry. They consume heavy memory and CPU, making them one of the costlier cloud services.",
    ("cloud-computing--cloud-data-and-storage.json", 18, "hook"):
        "A self-driving car generates 4 TB of data per day. Sending it all to the cloud is too slow. Process it at the edge.",
    ("cloud-computing--cloud-data-and-storage.json", 18, "twist"):
        "Edge doesn't replace the cloud — it extends it. Critical decisions happen locally; everything else syncs to the cloud.",
    ("cloud-computing--cloud-data-and-storage.json", 22, "twist"):
        "Backups are worthless if never tested. Many teams discover broken backups only during an actual disaster.",
    ("cloud-computing--cloud-data-and-storage.json", 28, "twist"):
        "These techniques are still slow. Homomorphic encryption can be millions of times slower than normal computing.",
    ("cloud-computing--cloud-data-and-storage.json", 29, "buildup"):
        "Cloud providers manage exabytes across millions of drives. When drives fail, data is automatically re-replicated.",

    # === cloud-computing--cloud-economics.json (2 violations) ===
    ("cloud-computing--cloud-economics.json", 2, "buildup"):
        "Spot instances are leftover cloud capacity sold at steep discounts. The catch: they can vanish with two minutes' notice.",
    ("cloud-computing--cloud-economics.json", 9, "climax"):
        "The real cost of lock-in isn't the bill — it's lost leverage. You can't threaten to leave if leaving is impossible.",

    # === cloud-computing--famous-cloud-failures.json (27 violations) ===
    ("cloud-computing--famous-cloud-failures.json", 0, "climax"):
        "AWS added safeguards: rate limits on server removal speed. One typo changed cloud infrastructure forever.",
    ("cloud-computing--famous-cloud-failures.json", 1, "twist"):
        "Google's internal tools were also affected. Engineers had to work around their own broken systems to fix the problem.",
    ("cloud-computing--famous-cloud-failures.json", 2, "discovery"):
        "A code change in authentication introduced a bug. It wasn't caught in testing because it only appeared at scale.",
    ("cloud-computing--famous-cloud-failures.json", 4, "hook"):
        "On October 4, 2021, Facebook, Instagram, and WhatsApp vanished for six hours. 3.5 billion users were affected.",
    ("cloud-computing--famous-cloud-failures.json", 7, "climax"):
        "The breach showed that source code is a high-value target. Protecting repositories is as critical as protecting data.",
    ("cloud-computing--famous-cloud-failures.json", 8, "hook"):
        "In 2021, Chinese hackers exploited four zero-day vulnerabilities in Microsoft Exchange, compromising 250,000 servers.",
    ("cloud-computing--famous-cloud-failures.json", 8, "twist"):
        "The attack strengthened the case for cloud: Microsoft patches cloud services instantly. On-premises waits for you.",
    ("cloud-computing--famous-cloud-failures.json", 9, "discovery"):
        "The compromised update gave attackers access to networks at the U.S. Treasury and Homeland Security.",
    ("cloud-computing--famous-cloud-failures.json", 9, "twist"):
        "The attack went undetected for nine months. Attackers moved through cloud environments, reading emails and files.",
    ("cloud-computing--famous-cloud-failures.json", 11, "buildup"):
        "The engineer was troubleshooting database replication late at night. Fatigue led to a command on the wrong server.",
    ("cloud-computing--famous-cloud-failures.json", 11, "twist"):
        "GitLab live-streamed the recovery on YouTube. Radical transparency turned a disaster into a trust-building moment.",
    ("cloud-computing--famous-cloud-failures.json", 11, "climax"):
        "After recovery, GitLab overhauled its backup strategy. The incident became a teaching moment for the industry.",
    ("cloud-computing--famous-cloud-failures.json", 12, "climax"):
        "Named 'Cloudbleed,' the bug hit millions of sites. Shared infrastructure magnifies single-point failures.",
    ("cloud-computing--famous-cloud-failures.json", 13, "climax"):
        "The epidemic forced Elastic to add security defaults. Secure defaults matter more than documentation.",
    ("cloud-computing--famous-cloud-failures.json", 14, "hook"):
        "In 2019, Docker Hub was breached. 190,000 accounts exposed — including tokens that could push container images.",
    ("cloud-computing--famous-cloud-failures.json", 14, "twist"):
        "Most teams pull container images without verifying them. If a trusted image is poisoned, malware deploys automatically.",
    ("cloud-computing--famous-cloud-failures.json", 17, "climax"):
        "Auto-scaling requires understanding every bottleneck in the chain. Scaling one layer while starving another fails.",
    ("cloud-computing--famous-cloud-failures.json", 18, "twist"):
        "Thundering herds often happen during recovery from another failure. The system breaks twice: outage, then stampede.",
    ("cloud-computing--famous-cloud-failures.json", 19, "climax"):
        "Let's Encrypt and automated managers have reduced the problem. But manual certificates still catch people off guard.",
    ("cloud-computing--famous-cloud-failures.json", 21, "hook"):
        "A developer commits an AWS key to a public GitHub repo. Within minutes, crypto miners spin up $50,000 in EC2 instances.",
    ("cloud-computing--famous-cloud-failures.json", 21, "twist"):
        "Even after rotation, the damage may be done. Attackers may have already exfiltrated data or planted backdoors.",
    ("cloud-computing--famous-cloud-failures.json", 24, "climax"):
        "Guardrails — canary releases, progressive rollouts, mandatory staging — prevent small mistakes from going big.",
    ("cloud-computing--famous-cloud-failures.json", 25, "buildup"):
        "A good post-mortem is blameless. It focuses on systems, not individuals. People make mistakes; systems catch them.",
    ("cloud-computing--famous-cloud-failures.json", 25, "twist"):
        "The hardest part isn't writing the post-mortem — it's following through on action items. Many get filed and forgotten.",
    ("cloud-computing--famous-cloud-failures.json", 26, "twist"):
        "Chasing 100% uptime is counterproductive. Google's error budget concept says some failures are acceptable and useful.",
    ("cloud-computing--famous-cloud-failures.json", 29, "twist"):
        "Technology alone can't make you resilient. Culture determines whether tools and processes get used under pressure.",
    ("cloud-computing--famous-cloud-failures.json", 29, "climax"):
        "The best cloud teams assume failure is inevitable. Pessimism about uptime breeds optimism about recovery.",

    # === cloud-computing--the-future-of-cloud.json (59 violations) ===
    ("cloud-computing--the-future-of-cloud.json", 1, "twist"):
        "5G edge isn't just for phones. It powers smart factories, remote surgery, autonomous vehicles, and real-time AR.",
    ("cloud-computing--the-future-of-cloud.json", 2, "discovery"):
        "Workers uses V8 isolates instead of containers. Startup: under 5 milliseconds. Cold starts are nearly eliminated.",
    ("cloud-computing--the-future-of-cloud.json", 2, "twist"):
        "Edge functions have constraints: limited CPU, smaller memory, no filesystem. You write code differently for the edge.",
    ("cloud-computing--the-future-of-cloud.json", 3, "buildup"):
        "Smart sensors in factories, farms, and cities generate petabytes. Sending it all to the cloud is expensive and slow.",
    ("cloud-computing--the-future-of-cloud.json", 3, "climax"):
        "The future isn't cloud vs. edge. It's a seamless continuum where data flows to wherever it's processed best.",
    ("cloud-computing--the-future-of-cloud.json", 5, "buildup"):
        "AI training needs massive parallel computing. Cloud providers offer GPU clusters no single company could afford to own.",
    ("cloud-computing--the-future-of-cloud.json", 5, "discovery"):
        "AWS, Azure, and Google Cloud offer specialized AI chips: A100 GPUs, TPUs, and custom silicon for training and inference.",
    ("cloud-computing--the-future-of-cloud.json", 6, "hook"):
        "You don't need to train your own AI. Cloud APIs add vision, language, and prediction to any app with one API call.",
    ("cloud-computing--the-future-of-cloud.json", 6, "discovery"):
        "MLaaS democratizes AI. A startup with no data scientists can add image recognition in an hour using cloud APIs.",
    ("cloud-computing--the-future-of-cloud.json", 6, "climax"):
        "AI-as-a-service is powerful but needs responsible use. Understanding what the model can and can't do is still your job.",
    ("cloud-computing--the-future-of-cloud.json", 7, "hook"):
        "AWS Bedrock, Azure OpenAI, and Google Vertex AI let you access GPT-4, Claude, and Llama through your cloud account.",
    ("cloud-computing--the-future-of-cloud.json", 7, "twist"):
        "Cloud provider competition now centers on AI model access. Whoever has the best models wins cloud customers.",
    ("cloud-computing--the-future-of-cloud.json", 8, "discovery"):
        "AI detects patterns humans miss: subtle performance drops, unusual traffic, and correlated failures across services.",
    ("cloud-computing--the-future-of-cloud.json", 9, "buildup"):
        "Every major AI company needs GPU clusters. Providers, startups, and governments all compete for limited supply.",
    ("cloud-computing--the-future-of-cloud.json", 10, "buildup"):
        "Wasm is a binary format that runs anywhere — browsers, servers, or edge — at near-native speed, safely sandboxed.",
    ("cloud-computing--the-future-of-cloud.json", 10, "climax"):
        "Fermyon, Cosmonic, and Fastly run Wasm in production. It's not replacing containers — it fills gaps they can't.",
    ("cloud-computing--the-future-of-cloud.json", 11, "hook"):
        "DevOps gave developers freedom. Too much freedom. Platform engineering builds golden paths that make the right way easy.",
    ("cloud-computing--the-future-of-cloud.json", 11, "discovery"):
        "Internal Developer Platforms abstract away infrastructure. Backstage, Humanitec, and Port build self-service portals.",
    ("cloud-computing--the-future-of-cloud.json", 11, "twist"):
        "Platform engineering doesn't replace DevOps. It's the next step — making DevOps practices accessible to all developers.",
    ("cloud-computing--the-future-of-cloud.json", 11, "climax"):
        "Gartner predicts 80% of large companies will have platform teams by 2026. The platform engineer is the new key role.",
    ("cloud-computing--the-future-of-cloud.json", 12, "climax"):
        "GitOps is becoming the cloud-native standard. It unifies deployment, rollback, and compliance in a single workflow.",
    ("cloud-computing--the-future-of-cloud.json", 13, "twist"):
        "The FinOps Foundation reports most companies waste 30% of cloud spend. Visibility alone can cut costs dramatically.",
    ("cloud-computing--the-future-of-cloud.json", 13, "climax"):
        "FinOps is now a career path. The FinOps Foundation certifies practitioners and publishes cloud cost best practices.",
    ("cloud-computing--the-future-of-cloud.json", 14, "hook"):
        "In microservices, every service talks to dozens of others. A service mesh ensures every conversation is secured.",
    ("cloud-computing--the-future-of-cloud.json", 14, "twist"):
        "Traditional firewalls protect the perimeter. In the cloud there is no perimeter. Security must be embedded everywhere.",
    ("cloud-computing--the-future-of-cloud.json", 14, "climax"):
        "Service meshes and zero trust are converging into the default cloud-native security model. Verify everything.",
    ("cloud-computing--the-future-of-cloud.json", 15, "twist"):
        "Moving to the cloud is often greener than on-premises. Shared infrastructure runs at higher utilization — less waste.",
    ("cloud-computing--the-future-of-cloud.json", 15, "climax"):
        "AWS, Google, and Microsoft have pledged carbon neutrality. But growing demand may outpace renewable investments.",
    ("cloud-computing--the-future-of-cloud.json", 16, "buildup"):
        "Air cooling wastes enormous energy. Liquid cooling submerges servers in non-conductive fluid, cutting energy use 40%.",
    ("cloud-computing--the-future-of-cloud.json", 17, "hook"):
        "What if your workload ran when electricity was cleanest? Carbon-aware computing schedules by grid emissions.",
    ("cloud-computing--the-future-of-cloud.json", 17, "twist"):
        "Most workloads can shift by minutes or hours without users noticing. Batch jobs, backups, and training can wait.",
    ("cloud-computing--the-future-of-cloud.json", 17, "climax"):
        "The Green Software Foundation is standardizing carbon-aware APIs. Any developer can build carbon-aware apps soon.",
    ("cloud-computing--the-future-of-cloud.json", 19, "buildup"):
        "Decommissioned servers contain rare metals, plastics, and hazardous materials. Responsible recycling is expensive.",
    ("cloud-computing--the-future-of-cloud.json", 19, "climax"):
        "The cloud industry is learning to balance performance upgrades with environmental responsibility. Tension remains.",
    ("cloud-computing--the-future-of-cloud.json", 20, "hook"):
        "IBM, Google, and Amazon offer quantum computers as a cloud service. You can run quantum circuits from your browser.",
    ("cloud-computing--the-future-of-cloud.json", 20, "buildup"):
        "Quantum computers use qubits that can be 0 and 1 simultaneously, solving certain problems exponentially faster.",
    ("cloud-computing--the-future-of-cloud.json", 20, "twist"):
        "Current quantum computers are noisy and limited. They can't replace classical computers yet, but hybrids are emerging.",
    ("cloud-computing--the-future-of-cloud.json", 20, "climax"):
        "Quantum-as-a-service lets researchers experiment without buying million-dollar machines. Cloud democratizes quantum.",
    ("cloud-computing--the-future-of-cloud.json", 21, "hook"):
        "Data is encrypted at rest and in transit. But what about during processing? Confidential computing protects data in use.",
    ("cloud-computing--the-future-of-cloud.json", 21, "twist"):
        "Confidential computing lets healthcare and finance use the cloud for sensitive data they couldn't process before.",
    ("cloud-computing--the-future-of-cloud.json", 21, "climax"):
        "The Confidential Computing Consortium is standardizing the tech. Full lifecycle encryption is the new normal.",
    ("cloud-computing--the-future-of-cloud.json", 22, "hook"):
        "What if cloud services ran in your data center but were managed by the provider? That's distributed cloud.",
    ("cloud-computing--the-future-of-cloud.json", 22, "buildup"):
        "AWS Outposts, Azure Stack, and Google Distributed Cloud bring cloud services to on-premises and edge sites.",
    ("cloud-computing--the-future-of-cloud.json", 22, "discovery"):
        "The provider manages hardware, updates, and APIs. You get cloud consistency with local data residency and low latency.",
    ("cloud-computing--the-future-of-cloud.json", 23, "hook"):
        "What if anyone could rent out spare compute? Decentralized cloud networks let individuals become cloud providers.",
    ("cloud-computing--the-future-of-cloud.json", 23, "buildup"):
        "Filecoin, Akash, and Render Network use blockchain to coordinate distributed computing resources worldwide.",
    ("cloud-computing--the-future-of-cloud.json", 23, "climax"):
        "Decentralized cloud may serve niche uses but won't replace centralized providers for mission-critical workloads.",
    ("cloud-computing--the-future-of-cloud.json", 24, "buildup"):
        "A digital twin is a real-time virtual replica of a physical system, updated continuously with live sensor data.",
    ("cloud-computing--the-future-of-cloud.json", 24, "discovery"):
        "AWS IoT TwinMaker, Azure Digital Twins, and NVIDIA Omniverse power digital twins of cities, factories, and more.",
    ("cloud-computing--the-future-of-cloud.json", 24, "twist"):
        "Digital twins require massive compute and storage. Only the cloud can simulate entire physical systems in real time.",
    ("cloud-computing--the-future-of-cloud.json", 24, "climax"):
        "By 2027, half of large companies will use digital twins. Physical and digital worlds are merging through the cloud.",
    ("cloud-computing--the-future-of-cloud.json", 25, "climax"):
        "Global innovation versus national sovereignty — that tension is reshaping how cloud providers build their services.",
    ("cloud-computing--the-future-of-cloud.json", 26, "buildup"):
        "Teams choose best-of-breed: AWS for infra, Google for AI, Azure for enterprise. Nobody picks just one provider.",
    ("cloud-computing--the-future-of-cloud.json", 26, "twist"):
        "Terraform, Pulumi, and Crossplane abstract multi-cloud. But true portability between providers remains difficult.",
    ("cloud-computing--the-future-of-cloud.json", 26, "climax"):
        "The future is multi-cloud with strategic intent — not accidental sprawl. The right provider per workload matters.",
    ("cloud-computing--the-future-of-cloud.json", 27, "discovery"):
        "Repatriation makes sense for stable, predictable workloads. Bursty, unpredictable work still belongs in the cloud.",
    ("cloud-computing--the-future-of-cloud.json", 28, "discovery"):
        "Ambient computing means technology disappears into the background. The interface is your voice, gestures, and presence.",
    ("cloud-computing--the-future-of-cloud.json", 29, "twist"):
        "Maybe the answer isn't one next thing. Maybe it's all of them converging into a computing fabric we can't yet imagine.",
    ("cloud-computing--the-future-of-cloud.json", 29, "climax"):
        "The cloud was just the beginning. Every computing generation seemed final — until the next revolution arrived.",
}

# Verify all fixes are within limits
print("Verifying fix lengths...")
over = []
for key, text in FIXES.items():
    limit = PUNCH_MAX if key[2] == 'punchline' else BEAT_MAX
    if len(text) > limit:
        over.append((key, len(text), limit))
if over:
    for k, l, lim in over:
        print(f"  FIX TOO LONG: {k} -> {l} chars (limit {lim})")
    exit(1)
print(f"  All {len(FIXES)} fixes are within limits.")

# Apply fixes
files = sorted(glob.glob('content/course-plans/cloud-computing--*.json'))
applied = 0
for f in files:
    with open(f) as fh:
        data = json.load(fh)
    fname = os.path.basename(f)
    changed = False
    for i, t in enumerate(data.get('topics', [])):
        story = t.get('story', {})
        for beat_key in ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline']:
            key = (fname, i, beat_key)
            if key in FIXES:
                old = story[beat_key]['text']
                story[beat_key]['text'] = FIXES[key]
                print(f"  FIXED {fname} topic {i} {beat_key}: {len(old)} -> {len(FIXES[key])}")
                applied += 1
                changed = True
    if changed:
        with open(f, 'w') as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write('\n')
        print(f"  Wrote {fname}")

print(f"\nApplied {applied} fixes out of {len(FIXES)} defined.")
