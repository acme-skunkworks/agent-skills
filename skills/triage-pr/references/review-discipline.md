# triage-pr — review discipline

The Phase B triage in [`../SKILL.md`](../SKILL.md) compresses two well-worn
review-handling disciplines into a short step list. The full rules live here, so
the body stays lean and an agent can load this on demand. They are adapted from
the community `receiving-code-review` and `verification-before-completion` skills
(obra/superpowers).

## Receiving review feedback — the six steps

Run every AI finding through these in order. The point is **technical rigour, not
performative agreement**: a review bot is frequently wrong, partially right, or
missing context, and applying its suggestion blind is how a green PR ships a
regression.

1. **READ.** Absorb the whole finding — the comment body *and* the cited file and
   line — before reacting. Don't start editing on the strength of the summary.
2. **UNDERSTAND.** Restate the claim in your own words. If you can't, the finding
   is unclear; treat that as a signal to verify harder, not to guess.
3. **VERIFY.** Check the suggestion against the **actual codebase**. Open the
   cited lines. Confirm the problem is real, reproduces, and isn't already handled
   elsewhere. Never trust the bot's framing of the code — read the code.
4. **EVALUATE.** Decide whether the change is correct *for this project*: in
   scope, compatible with the stack, and not a YAGNI or architecture violation.
5. **RESPOND.** State a technical acknowledgement or a justified technical
   objection. For an accepted finding, note the planned fix. For a decline, reply
   on the thread with the reasoning and resolve it.
6. **IMPLEMENT.** Apply accepted findings **one at a time**, verifying each before
   the next. Batching changes hides which one broke something.

## No sycophancy

Do **not** open a reply with praise — "You're absolutely right!", "Great point!",
"Excellent feedback!". Actions speak: the code change itself shows the finding was
heard. Acknowledge by describing what changed ("Fixed — `line` now falls back to
`originalLine` for outdated threads") or simply implement without commentary.

## When to decline

Push back — with technical reasoning, not defensiveness — when the suggestion:

- breaks existing functionality;
- is made without the full context (the bot couldn't see a constraint you can);
- violates YAGNI (adds an unused capability "just in case");
- conflicts with the codebase's technical stack or conventions; or
- contradicts a deliberate architectural decision.

A declined finding still gets a reply explaining *why*, then the thread is
resolved so it doesn't re-surface.

## Evidence before claims

Before asserting that CI is green, a check passes, or a fix works:

1. Identify the command that **proves** the claim.
2. Run it freshly and completely — not from memory of a previous run.
3. Read the full output **and** the exit code.
4. Only then state the result, citing the evidence.

Banned until you have run the proving command: "should", "probably", "seems to",
and premature satisfaction ("Done!", "Perfect!", "All green!"). Any wording that
implies success without fresh verification breaks this rule.

Proving commands by claim:

| Claim | Proof |
| --- | --- |
| Lint clean | the lint command's output showing zero errors |
| Tests pass | the test command's output showing zero failures |
| Build succeeds | the build command exiting `0` |
| Manifest valid | `npx skills-ref validate ./skills/<name>` exiting `0` |
| CI green | `gh pr checks <pr>` showing every required check passed |
| Bug fixed | the original failing symptom now passing |
