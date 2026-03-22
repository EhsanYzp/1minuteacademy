const d = require('./content/course-plans/neuroscience--neuroplasticity.json');
const newTitles = ['Sensitive Periods vs. Critical Periods','Metaplasticity','Mental Rehearsal and Neural Change','Sensory Substitution','Addiction and Brain Rewiring','Epigenetics and Plasticity'];
let ok = true;
d.topics.filter(t => newTitles.includes(t.title)).forEach(t => {
  const json = JSON.stringify(t);
  if (json.includes("'")) { console.log('APOSTROPHE in', t.title); ok = false; }
  if (json.includes('\u2014')) { console.log('EM DASH in', t.title); ok = false; }
  if (t.is_free !== false) { console.log('is_free not false in', t.title); ok = false; }
  if (t.quiz.correct !== 0) { console.log('correct not 0 in', t.title); ok = false; }
  const parts = ['hook','buildup','discovery','twist','climax','punchline'];
  for (const p of parts) {
    if (!t.story[p] || !t.story[p].text || !t.story[p].visual) { console.log('Missing story part', p, 'in', t.title); ok = false; }
  }
  if (t.quiz.options.length !== 3) { console.log('Wrong options count in', t.title); ok = false; }
});
if (ok) console.log('All 6 new topics pass validation.');
