#!/usr/bin/env python3
"""Fix all beat-length violations in statistics course plans."""
import json, glob, os

BEAT_MAX = 120
PUNCH_MAX = 80

# Map: (filename, topic_index, beat_key) -> replacement text
FIXES = {
    # === statistics--bayesian-thinking.json (5 violations) ===
    ("statistics--bayesian-thinking.json", 9, "buildup"):
        "The fallacy confuses the probability of evidence given innocence with the probability of guilt given evidence.",
    ("statistics--bayesian-thinking.json", 9, "discovery"):
        "P(match | innocent) is tiny. But P(innocent | match) depends on how many suspects were screened.",
    ("statistics--bayesian-thinking.json", 9, "climax"):
        "Bayes' theorem is the fix. Prior probability of guilt matters just as much as the DNA evidence.",
    ("statistics--bayesian-thinking.json", 10, "twist"):
        "Priors are subjective by definition. Two Bayesians can start differently and converge as data arrives.",
    ("statistics--bayesian-thinking.json", 17, "twist"):
        "Bayesians say confidence intervals answer the wrong question. The debate reveals deep philosophical divides.",

    # === statistics--experimental-design.json (7 violations) ===
    ("statistics--experimental-design.json", 4, "punchline"):
        "Small samples miss effects. Large ones find trivia. Get the size right.",
    ("statistics--experimental-design.json", 18, "punchline"):
        "Every click is data. Every user is a participant. The web experiments on us.",
    ("statistics--experimental-design.json", 22, "discovery"):
        "Near the cutoff, students are nearly identical except for the scholarship. The jump at 70 is the effect.",
    ("statistics--experimental-design.json", 26, "twist"):
        "Re-analysis revealed coaching, selection bias, and demand effects. The experiment's validity is now disputed.",
    ("statistics--experimental-design.json", 27, "punchline"):
        "A tea party moment launched a statistical revolution. Design the test and the answer is clear.",
    ("statistics--experimental-design.json", 29, "buildup"):
        "Participants return every two years for physicals, blood tests, and surveys. Three generations now take part.",
    ("statistics--experimental-design.json", 29, "discovery"):
        "Framingham identified major risk factors: high blood pressure, cholesterol, smoking, and diabetes.",

    # === statistics--hypothesis-testing.json (4 violations) ===
    ("statistics--hypothesis-testing.json", 2, "twist"):
        "Fisher picked 0.05 arbitrarily. Yet it became a sacred threshold that entire careers hinge on.",
    ("statistics--hypothesis-testing.json", 12, "climax"):
        "Running an underpowered study is nearly pointless. If power is low, even real effects stay hidden.",
    ("statistics--hypothesis-testing.json", 15, "hook"):
        "Most researchers think a p-value is the probability the null is true. It's not. Not even close.",
    ("statistics--hypothesis-testing.json", 17, "discovery"):
        "Researchers test many hypotheses, then present the significant one as if it was planned all along.",

    # === statistics--statistical-paradoxes-and-puzzles.json (34 violations) ===
    ("statistics--statistical-paradoxes-and-puzzles.json", 0, "twist"):
        "UC Berkeley was sued for gender bias. Women were rejected more overall but accepted more in each department.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 3, "discovery"):
        "Without adjustment, no difference. Adjusting for baseline, Hall B adds more weight. Same data, different answers.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 4, "buildup"):
        "Stein showed that estimating three or more means simultaneously improves when you shrink them toward the center.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 4, "discovery"):
        "The James-Stein estimator beats individual averages even when the variables are completely unrelated.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 4, "punchline"):
        "Borrow strength from unrelated data. The group lifts every estimate.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 8, "twist"):
        "The paradox extends: your co-authors publish more and your followers have more followers. Popularity bias.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 9, "punchline"):
        "'One is a boy' and 'the first is a boy' give different answers.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 10, "hook"):
        "WWII planes returned with bullet holes on the wings. Engineers wanted to armor them. Wald said no.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 10, "climax"):
        "Self-help books interview successful founders. Thousands who did the same and failed aren't interviewed.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 11, "discovery"):
        "Hospital admission is the collider. Admitted for either disease, having one makes the other seem rarer.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 11, "twist"):
        "The dating 'attractiveness vs. niceness' trade-off may be Berkson's paradox. You filter on the sum.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 13, "buildup"):
        "The fallacy confuses the probability of evidence given innocence with the probability of innocence given evidence.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 13, "twist"):
        "Sally Clark was wrongly convicted partly due to this fallacy. A doctor misstated the probability in court.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 13, "punchline"):
        "Rare evidence doesn't mean rare innocence. The fallacy jails people.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 15, "twist"):
        "Soviet nail factories measured by weight made huge nails. Measured by count, they made millions of tiny ones.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 16, "hook"):
        "In Vietnam, the US measured success by body count. They were 'winning' by the numbers and losing the war.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 17, "twist"):
        "Cancer cluster investigations find this: residents identify a cluster, then search for a cause that may not exist.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 18, "punchline"):
        "We study where the data is, not where the answers are.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 20, "twist"):
        "Later replications found weaker effects. The paradox is real but context-dependent.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 21, "hook"):
        "Would you take a sure $1 million or a gamble with 10% chance of $5 million? Most take the sure thing.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 21, "buildup"):
        "Shift the scenario slightly. Most people's second choice contradicts their first — violating utility theory.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 21, "discovery"):
        "The Allais paradox shows people overweight certainty. The jump from 99% to 100% feels enormous.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 21, "twist"):
        "Expected utility predicts consistent choices. Humans aren't consistent — we avoid the regret of losing sure things.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 21, "punchline"):
        "Certainty has a premium that probability can't explain. We're human.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 22, "hook"):
        "A coin is flipped until heads. Tails on flip 1 pays $2, flip 2 pays $4, and so on. Expected value: infinity.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 25, "buildup"):
        "The replication crisis revealed that many published findings were false positives from noisy data.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 26, "twist"):
        "Collider bias, reverse causation, and weight measurement timing all contribute. The paradox likely isn't real.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 27, "discovery"):
        "Numbers grow multiplicatively. Going from 1 to 2 is 100% increase; 8 to 9 is just 12.5%.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 27, "twist"):
        "Forensic accountants use Benford's Law to detect fraud. Fabricated numbers don't follow the natural pattern.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 27, "climax"):
        "The law applies to city populations, river lengths, stock prices, and elections. It's remarkably universal.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 28, "twist"):
        "Real buses follow schedules. But many natural processes are memoryless: radioactive decay, server requests.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 28, "climax"):
        "The exponential is the only continuous memoryless distribution. This fact has deep consequences.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 28, "punchline"):
        "The bus doesn't know you waited. Every moment starts fresh.",
    ("statistics--statistical-paradoxes-and-puzzles.json", 29, "twist"):
        "The fractal dimension quantifies roughness. Britain's coast is about 1.25 — between a line and a plane.",

    # === statistics--time-series-and-forecasting.json (27 violations) ===
    ("statistics--time-series-and-forecasting.json", 3, "discovery"):
        "A value of 0.9 at lag 1 means today predicts tomorrow. The ACF plots this correlation at every lag.",
    ("statistics--time-series-and-forecasting.json", 5, "hook"):
        "Retail sales swing by $10M each December in 2010 and $50M in 2023. The swing grew. That's multiplicative.",
    ("statistics--time-series-and-forecasting.json", 5, "punchline"):
        "Fixed swings are additive. Proportional swings are multiplicative.",
    ("statistics--time-series-and-forecasting.json", 8, "hook"):
        "After removing trend and seasonality, what's left should be random noise. Patterns mean a missed signal.",
    ("statistics--time-series-and-forecasting.json", 8, "twist"):
        "The Ljung-Box test checks if residual autocorrelations are zero. Failure means the model is incomplete.",
    ("statistics--time-series-and-forecasting.json", 11, "punchline"):
        "Three letters, three numbers. ARIMA captures the patterns time leaves behind.",
    ("statistics--time-series-and-forecasting.json", 14, "twist"):
        "Models that can't beat the naive method are wasting effort. Always compare against these baselines.",
    ("statistics--time-series-and-forecasting.json", 15, "punchline"):
        "Every error metric has a blind spot. Match the metric to your cost of being wrong.",
    ("statistics--time-series-and-forecasting.json", 16, "punchline"):
        "A forecast without uncertainty is a guess. Show the range.",
    ("statistics--time-series-and-forecasting.json", 17, "discovery"):
        "Train on old data, test on recent data. Good on both means generalizing. Good on old only means overfitting.",
    ("statistics--time-series-and-forecasting.json", 17, "punchline"):
        "A perfect fit to the past is a warning. Simplicity forecasts better.",
    ("statistics--time-series-and-forecasting.json", 18, "punchline"):
        "Test on the past before predicting the future. But the future may differ.",
    ("statistics--time-series-and-forecasting.json", 19, "punchline"):
        "Competition settles arguments. Ensembles win and simplicity holds its own.",
    ("statistics--time-series-and-forecasting.json", 20, "twist"):
        "Chaos theory limits prediction. Beyond 10 days, small initial errors amplify into total uncertainty.",
    ("statistics--time-series-and-forecasting.json", 20, "punchline"):
        "Forecasting improved dramatically but chaos caps how far ahead we'll ever see.",
    ("statistics--time-series-and-forecasting.json", 21, "punchline"):
        "Forecasts work best when you don't need them. Surprises matter most.",
    ("statistics--time-series-and-forecasting.json", 23, "discovery"):
        "A forecast is a probability distribution, not a prediction. 70% for Clinton meant 30% for Trump.",
    ("statistics--time-series-and-forecasting.json", 23, "punchline"):
        "29% is not zero. People confuse unlikely with impossible.",
    ("statistics--time-series-and-forecasting.json", 24, "twist"):
        "A forecast that guides investment becomes self-fulfilling. The prediction created its own success.",
    ("statistics--time-series-and-forecasting.json", 24, "punchline"):
        "The best forecast in history worked because everyone believed it.",
    ("statistics--time-series-and-forecasting.json", 25, "punchline"):
        "ML doesn't replace statistics for time series. It extends it.",
    ("statistics--time-series-and-forecasting.json", 26, "hook"):
        "Ask 100 people to guess the weight of an ox. The average beats almost every individual guess.",
    ("statistics--time-series-and-forecasting.json", 26, "buildup"):
        "Ensemble forecasting combines predictions from multiple models. The combination usually wins.",
    ("statistics--time-series-and-forecasting.json", 26, "punchline"):
        "Combine forecasts. The wisdom of models exceeds any individual.",
    ("statistics--time-series-and-forecasting.json", 27, "discovery"):
        "The model learns normal behavior and flags anything that falls far outside expected bounds.",
    ("statistics--time-series-and-forecasting.json", 28, "punchline"):
        "What would have happened without the change? The counterfactual answers it.",
    ("statistics--time-series-and-forecasting.json", 29, "twist"):
        "Confident predictions get media attention. Calibrated, uncertain ones are ignored.",
}

def main():
    files = sorted(glob.glob('content/course-plans/statistics--*.json'))
    fixed_count = 0
    for f in files:
        fname = os.path.basename(f)
        with open(f) as fh:
            data = json.load(fh)
        changed = False
        for i, t in enumerate(data.get('topics', [])):
            story = t.get('story', {})
            for beat_key in ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline']:
                key = (fname, i, beat_key)
                if key in FIXES:
                    old = story[beat_key]['text']
                    new = FIXES[key]
                    limit = PUNCH_MAX if beat_key == 'punchline' else BEAT_MAX
                    if len(new) > limit:
                        print(f'WARNING: Fix still too long: {key} -> {len(new)} chars (limit {limit})')
                    story[beat_key]['text'] = new
                    changed = True
                    fixed_count += 1
        if changed:
            with open(f, 'w') as fh:
                json.dump(data, fh, indent=2, ensure_ascii=False)
                fh.write('\n')
            print(f'Fixed: {fname}')
    print(f'\nTotal fixes applied: {fixed_count}')

if __name__ == '__main__':
    main()
