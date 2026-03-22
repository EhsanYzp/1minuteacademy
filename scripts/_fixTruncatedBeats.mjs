#!/usr/bin/env node
/**
 * Fix truncated beat texts across all neuroscience course plan files.
 * 
 * Detects sentences that were mechanically truncated (ending with dangling
 * articles, prepositions, conjunctions, etc.) and replaces them with
 * complete, meaningful sentences.
 *
 * Run:  node scripts/_fixTruncatedBeats.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const COURSE_DIR = 'content/course-plans';
const BEAT_HARD_MAX = 130;
const PUNCH_HARD_MAX = 90;

// Patterns that indicate truncation
const TRUNCATION_PATTERN = /\b(the|a|an|of|in|on|at|to|for|by|with|from|and|or|but|is|are|was|were|its|their|our|your|that|this|these|those|which|who|whom|than)\s*[.!?;:]+\s*$/i;

/**
 * Map of { "filename::topicTitle::beat" → replacement text }
 * Each replacement must be a complete, natural sentence that fits within limits.
 */
const REPLACEMENTS = {
  // ===== brain-disorders =====
  "neuroscience--brain-disorders.json::OCD: The Cortico-Striato-Thalamic Trap::discovery":
    "In OCD the thalamus relays the alarm signal back to the cortex, creating a self-reinforcing cycle of anxiety and compulsion.",
  
  "neuroscience--brain-disorders.json::Multiple Sclerosis: Myelin Under Attack::punchline":
    "MS is friendly fire—your immune system destroying the insulation your nerves need.",

  "neuroscience--brain-disorders.json::Psychedelic-Assisted Therapy::punchline":
    "The most stigmatized substances may become psychiatry's most powerful medicines.",

  // ===== consciousness-and-the-mind =====
  "neuroscience--consciousness-and-the-mind.json::Defining Consciousness::punchline":
    "You experience it every waking second, yet no one can explain how matter becomes aware.",

  "neuroscience--consciousness-and-the-mind.json::Awareness vs. Wakefulness::hook":
    "A patient lies in bed with eyes open, cycling through sleep-wake patterns, but has zero awareness of the world.",

  "neuroscience--consciousness-and-the-mind.json::Awareness vs. Wakefulness::climax":
    "Some vegetative patients show brain activity when asked to imagine playing tennis, revealing hidden awareness trapped inside.",

  "neuroscience--consciousness-and-the-mind.json::The Neural Correlates of Consciousness::buildup":
    "Scientists compare brain activity during conscious and unconscious processing to find the minimal neural signature of awareness.",

  "neuroscience--consciousness-and-the-mind.json::The Neural Correlates of Consciousness::twist":
    "Unconscious stimuli activate sensory cortex locally but fail to ignite this global broadcast, as if the signal stays trapped.",

  "neuroscience--consciousness-and-the-mind.json::Consciousness Across Species::discovery":
    "The 2012 Cambridge Declaration stated that many non-human animals possess the neurological substrates for conscious experience.",

  "neuroscience--consciousness-and-the-mind.json::Coma and the Vegetative State::twist":
    "About 20 percent of patients diagnosed as vegetative are actually minimally conscious, detectable only by brain imaging.",

  "neuroscience--consciousness-and-the-mind.json::Coma and the Vegetative State::punchline":
    "The line between being aware and appearing unaware is far thinner than medicine once assumed.",

  "neuroscience--consciousness-and-the-mind.json::Lucid Dreaming::punchline":
    "In lucid dreaming the body sleeps, the cortex dreams, and the prefrontal cortex watches.",

  "neuroscience--consciousness-and-the-mind.json::Implicit Memory and Priming::twist":
    "Reading the word yellow makes you faster at naming the color of a banana, even without consciously noticing the connection.",

  "neuroscience--consciousness-and-the-mind.json::The Unconscious Decision Maker::twist":
    "If the brain decides before you consciously choose, is free will an illusion created after the fact?",

  "neuroscience--consciousness-and-the-mind.json::Automaticity and Habits::discovery":
    "When a behavior becomes automatic, it shifts from prefrontal cortex control to the basal ganglia, a structure built for routines.",

  "neuroscience--consciousness-and-the-mind.json::Hypnosis and Suggestibility::buildup":
    "Hypnosis is focused attention plus heightened suggestibility: the subject responds to suggestions as if they were real events.",

  "neuroscience--consciousness-and-the-mind.json::Near-Death Experiences::twist":
    "Rat studies show a surge of synchronized gamma waves 30 seconds after cardiac arrest, suggesting one final burst of activity.",

  "neuroscience--consciousness-and-the-mind.json::Near-Death Experiences::punchline":
    "The brain may produce its most vivid experience at the moment it shuts down.",

  "neuroscience--consciousness-and-the-mind.json::Meditation and Altered Awareness::twist":
    "Long-term meditators show thicker cortical regions, increased gray matter in the hippocampus, and reduced amygdala volume.",

  "neuroscience--consciousness-and-the-mind.json::Global Workspace Theory::buildup":
    "Global Workspace Theory says consciousness is like a spotlight that broadcasts selected information across the entire brain.",

  "neuroscience--consciousness-and-the-mind.json::Integrated Information Theory::climax":
    "The cerebellum has more neurons than the cortex but low integration, so IIT predicts it adds almost nothing to consciousness.",

  "neuroscience--consciousness-and-the-mind.json::Higher-Order Theories::buildup":
    "Higher-order theories say a mental state becomes conscious only when the brain forms a meta-representation of that state.",

  "neuroscience--consciousness-and-the-mind.json::Predictive Processing and Consciousness::twist":
    "This explains illusions: when prediction overrides sensory input, you consciously experience what the brain expects, not reality.",

  "neuroscience--consciousness-and-the-mind.json::The Hard Problem of Consciousness::buildup":
    "David Chalmers coined the hard problem in 1995 to distinguish it from the easy problems of explaining behavior and cognition.",

  "neuroscience--consciousness-and-the-mind.json::Qualia: The Feel of Experience::discovery":
    "Frank Jackson argued that when the scientist finally sees red, she learns something new, proving qualia go beyond physical facts.",

  "neuroscience--consciousness-and-the-mind.json::Could Machines Be Conscious?::buildup":
    "If consciousness arises from information processing, any sufficiently complex system—biological or digital—might possess it.",

  "neuroscience--consciousness-and-the-mind.json::Panpsychism: Is Consciousness Everywhere?::buildup":
    "Panpsychism holds that consciousness is a fundamental feature of the universe, present in all physical entities to some degree.",

  "neuroscience--consciousness-and-the-mind.json::The Ethics of Consciousness Science::punchline":
    "Science can measure brain activity, but deciding what counts as conscious is moral.",

  // ===== emotions-and-the-brain =====
  "neuroscience--emotions-and-the-brain.json::The Reward Circuit::discovery":
    "Dopamine released along this pathway signals that something good or important just happened or will happen soon.",

  "neuroscience--emotions-and-the-brain.json::Emotional Intelligence::hook":
    "The smartest person in the room often is not the most successful. The most emotionally skilled one usually wins.",

  "neuroscience--emotions-and-the-brain.json::The Neural Basis of Emotional Intelligence::climax":
    "Neuroplasticity means these connections strengthen with practice: journaling, therapy, and feedback physically reshape the brain.",

  // ===== memory-and-forgetting =====
  "neuroscience--memory-and-forgetting.json::Memory Is Not a Recording::climax":
    "Eyewitness testimony, once considered rock-solid, is now known to be deeply unreliable because of reconstructive memory.",

  "neuroscience--memory-and-forgetting.json::Semantic Memory: Facts Without Feelings::hook":
    "You know Paris is the capital of France. But you probably cannot remember where or when you learned it.",

  // ===== neuroplasticity =====
  "neuroscience--neuroplasticity.json::Phantom Limbs and Cortical Remapping::discovery":
    "V. Ramachandran showed touching an amputee's face could produce sensations in the missing hand due to adjacent cortical maps.",

  "neuroscience--neuroplasticity.json::Addiction and Brain Rewiring::buildup":
    "Addictive substances flood the brain with dopamine, triggering powerful long-term potentiation in the reward circuitry.",

  "neuroscience--neuroplasticity.json::Transcranial Stimulation::buildup":
    "Transcranial direct current stimulation, or tDCS, modulates neuronal excitability by shifting the resting membrane potential.",

  "neuroscience--neuroplasticity.json::Epigenetics and Plasticity::hook":
    "Two identical twins grow up in different environments and decades later their brains look nothing alike despite identical DNA.",

  "neuroscience--neuroplasticity.json::Epigenetics and Plasticity::discovery":
    "When you learn something new, epigenetic marks such as methyl groups and histone modifications change which genes get expressed.",

  "neuroscience--neuroplasticity.json::Epigenetics and Plasticity::climax":
    "Researchers have reversed maladaptive epigenetic marks in animal models using targeted drugs, restoring normal plasticity.",

  // ===== the-developing-brain =====
  "neuroscience--the-developing-brain.json::Neural Migration::hook":
    "Newborn neurons grab onto long radial glial fibers like a person climbing a rope, pulling themselves to their destination.",

  "neuroscience--the-developing-brain.json::Axon Guidance and Pathfinding::buildup":
    "The growth cone at an axon's tip is a sensing structure covered in receptors that detect chemical signals in its surroundings.",

  "neuroscience--the-developing-brain.json::Axon Guidance and Pathfinding::climax":
    "This guidance system is so precise that axons from the left eye find the right brain target with near-perfect accuracy.",

  "neuroscience--the-developing-brain.json::Fetal Brain and the Environment::twist":
    "Chronic maternal stress floods the fetus with cortisol, permanently altering the stress-response axis.",

  "neuroscience--the-developing-brain.json::Fetal Brain and the Environment::climax":
    "Fetal alcohol exposure disrupts neural migration, stranding neurons in wrong layers and causing lifelong cognitive deficits.",

  "neuroscience--the-developing-brain.json::Attachment and Brain Wiring::discovery":
    "Well-attached infants develop better emotional regulation, lower baseline cortisol, and stronger prefrontal-amygdala connections.",

  "neuroscience--the-developing-brain.json::Attachment and Brain Wiring::twist":
    "Neglected infants show elevated cortisol, smaller prefrontal cortices, and enlarged amygdalae, priming them for lifelong anxiety.",

  "neuroscience--the-developing-brain.json::Play and Brain Development::hook":
    "Rats deprived of play develop normal-sized brains but cannot navigate social situations or solve novel problems effectively.",

  "neuroscience--the-developing-brain.json::Play and Brain Development::discovery":
    "Rough-and-tumble play triggers BDNF, a growth factor that promotes synaptic growth in the prefrontal cortex.",

  "neuroscience--the-developing-brain.json::Sensitive Periods for Learning::buildup":
    "Sensitive periods are time windows when the brain is especially responsive to input, making learning faster and more permanent.",

  "neuroscience--the-developing-brain.json::Executive Function Development::climax":
    "Training executive function through games, play, and mindfulness can physically thicken the prefrontal cortex in children.",

  "neuroscience--the-developing-brain.json::The Teenage Brain Under Construction::climax":
    "This mismatch creates a brain with a powerful accelerator and weak brakes, explaining why teenagers chase thrills impulsively.",

  "neuroscience--the-developing-brain.json::Sleep and the Adolescent Clock::climax":
    "Sleep-deprived adolescents show impaired memory, worse emotional regulation, and higher rates of depression.",

  "neuroscience--the-developing-brain.json::Cognitive Reserve::buildup":
    "Cognitive reserve is the brain's ability to find alternate routes to complete tasks when primary pathways fail.",

  "neuroscience--the-developing-brain.json::Cognitive Reserve::twist":
    "Cognitive reserve does not prevent brain disease. The brain compensates so well that symptoms stay hidden until damage is severe.",

  "neuroscience--the-developing-brain.json::Stress and the Adult Brain::discovery":
    "Chronic cortisol kills hippocampal neurons, weakens prefrontal connections, and enlarges the amygdala, skewing the whole system.",

  "neuroscience--the-developing-brain.json::Stress and the Adult Brain::twist":
    "The amygdala grows more sensitive under chronic stress while the prefrontal cortex weakens, creating a vicious feedback loop.",

  "neuroscience--the-developing-brain.json::Lifelong Learning and Adult Plasticity::hook":
    "London taxi drivers who memorize 25,000 streets develop larger posterior hippocampi than bus drivers on fixed routes.",

  "neuroscience--the-developing-brain.json::Dementia and Neurodegeneration::discovery":
    "In Alzheimer's, amyloid plaques and tau tangles accumulate between and inside neurons, disrupting communication and killing cells.",

  "neuroscience--the-developing-brain.json::Dementia and Neurodegeneration::punchline":
    "Dementia is not inevitable. Understanding the developing brain may be key to preventing it.",

  "neuroscience--the-developing-brain.json::Superagers and Lifelong Brain Health::discovery":
    "They share lifestyle traits: regular vigorous exercise, strong social connections, intellectual curiosity, and purposeful living.",

  "neuroscience--the-developing-brain.json::The Gut-Brain Axis in Aging::climax":
    "Diets rich in fiber, fermented foods, and polyphenols support microbiome diversity and slow cognitive decline in aging adults.",

  // ===== the-neuron =====
  "neuroscience--the-neuron.json::Resting Potential: The Charged Neuron::discovery":
    "Sodium-potassium pumps work nonstop, pushing 3 sodium ions out for every 2 potassium ions allowed back inside.",

  "neuroscience--the-neuron.json::The Synaptic Gap::buildup":
    "When an action potential reaches the axon terminal, it triggers calcium ions to rush inward and release neurotransmitters.",

  "neuroscience--the-neuron.json::Neurogenesis: New Neurons in Adulthood::punchline":
    "The brain can grow new neurons throughout life—but only if you give it reasons to.",

  // ===== the-science-of-sleep =====
  "neuroscience--the-science-of-sleep.json::Insomnia: The Sleepless Epidemic::punchline":
    "Insomnia is often the fear of not sleeping—and the cure starts in the mind.",

  "neuroscience--the-science-of-sleep.json::Sleep Apnea: Breathing Stops::punchline":
    "If you snore loudly and wake tired, your airway may be closing hundreds of times.",

  "neuroscience--the-science-of-sleep.json::Sleep and Mental Health::punchline":
    "Sleep is not separate from mental health. It is the foundation it stands upon.",

  // ===== the-senses =====
  "neuroscience--the-senses.json::Sound Localization: The Duplex Theory::punchline":
    "Your brain runs two localization systems at once, one for timing and one for volume.",
};

// ───────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────
const files = readdirSync(COURSE_DIR)
  .filter(f => f.startsWith('neuroscience--') && f.endsWith('.json'));

let totalFixed = 0;
let totalFailed = 0;

for (const filename of files) {
  const filePath = join(COURSE_DIR, filename);
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  let fileFixed = 0;

  for (const topic of data.topics) {
    for (const beat of Object.keys(topic.story)) {
      const key = `${filename}::${topic.title}::${beat}`;
      if (REPLACEMENTS[key]) {
        const newText = REPLACEMENTS[key];
        const maxLen = beat === 'punchline' ? PUNCH_HARD_MAX : BEAT_HARD_MAX;
        
        if (newText.length > maxLen) {
          console.error(`  ❌ OVER LIMIT: ${key} → ${newText.length}/${maxLen} chars`);
          console.error(`     "${newText}"`);
          totalFailed++;
          continue;
        }
        
        // Check for truncation pattern in the replacement too
        if (TRUNCATION_PATTERN.test(newText)) {
          console.error(`  ❌ STILL TRUNCATED: ${key}`);
          console.error(`     "${newText}"`);
          totalFailed++;
          continue;
        }

        topic.story[beat].text = newText;
        fileFixed++;
      }
    }
  }

  if (fileFixed > 0) {
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`✅ ${filename}: fixed ${fileFixed} beats`);
    totalFixed += fileFixed;
  }
}

console.log(`\nDone — fixed ${totalFixed}, failed ${totalFailed}`);

// Re-scan for any remaining truncation issues
console.log('\n--- Remaining truncation issues ---');
let remaining = 0;
const articleEnding = /\b(the|a|an|than)\s*[.!?;:\u201D"')]+$/i;  // matches the validator
for (const filename of files) {
  const filePath = join(COURSE_DIR, filename);
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  for (const topic of data.topics) {
    for (const [beat, val] of Object.entries(topic.story)) {
      if (articleEnding.test(val.text)) {
        console.log(`  ⚠️  ${filename}::${topic.title}::${beat}`);
        console.log(`     "${val.text}"`);
        remaining++;
      }
    }
  }
}
console.log(remaining === 0 ? 'None! All clear.' : `${remaining} remaining issues.`);
