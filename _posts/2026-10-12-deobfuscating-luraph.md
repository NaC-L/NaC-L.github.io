---
layout: post
title: "Deobfuscating Luraph: Lifting Lua to LLVM, Then Letting AI Try"
description: "Lifting Lua to LLVM IR, why dynamic table operations survive optimization, and recovering Luraph-protected scripts with AI-assisted tooling."
preview_label: Lua / Luraph / AI
date: 2026-10-12 12:00:00 +0300
toc: true
categories:
---

* 
{:toc}

# Intro

A while back, I was playing World of Warcraft with a friend. We used [Hekili](https://github.com/Hekili/hekili), a Lua addon that recommends which ability to use next. Recommending a spell and automatically casting it are two very different things, though.

On [June 17, 2025](https://worldofwarcraft.blizzard.com/en-us/news/24208341), Blizzard introduced Assisted Highlight and the Single-Button Assistant: built-in ability recommendations and a button that casts the next recommended ability, with an additional global-cooldown penalty. Separately, on [October 23, 2025](https://worldofwarcraft.blizzard.com/en-us/news/24244638), Blizzard explained its planned Midnight restrictions on addons using real-time combat information to make decisions for players.

Around the time I stopped playing, I came across a paid tool claiming to automate rotations through a macro-related workaround. Naturally, I wanted to know how it worked.

The script was protected by Luraph. That rabbit hole is how I ended up messing with Lua deobfuscation, and in this post I'll go over what I tried.

# The Lua Lifter — luau-rewrite
[Luau](https://luau.org/compatibility/) is Roblox's fork of Lua 5.1: faster, sandboxed, optional types. Most Lua 5.1 code works, but not all of it.

My idea was to get Luau's compiler to emit LLVM IR instead of Luau bytecode, then use LLVM's optimizations to simplify the obfuscated logic. Luau already handles parsing and compiling the source, so I'd just need to replace the backend, right?

Nope. Emitting LLVM IR is only part of the job: that IR also needs to preserve dynamic operations such as table lookups, function calls, and runtime type checks. And compiling those operations doesn't necessarily make them easier to understand. (In the end, `luauc` doesn't even reuse Luau's frontend: it has its own small handwritten parser for a subset of Lua.)

Lua is a dynamically typed language, but that doesn't mean you can't lift it. Types belong to values rather than fixed variable declarations; a compiler can still infer types in some places. Where it can't, you can represent values with tags and delegate dynamic operations to helper functions.

![Swap the bytecode backend for LLVM, then represent dynamically typed values with tags.](/assets/img/luraph/01-llvm-basics.gif)

```lua
-- human-hallucinated code below
local Paladin = {}
function Paladin:recomendspell()
    -- super duper calculations
    -- idk idk
    return "something in paladin kit"
end

local Warlock = {}
function Warlock:recomendspell()
    -- super duper calculations
    -- idk idk
    return "something in warlock kit"
end

function CastRecommendedSpell(class)
    CastSpell(class:recomendspell())
end

CastRecommendedSpell(Paladin)
CastRecommendedSpell(Warlock)
```

If we compile this with `luauc` (default `-O0`) and open `CastRecommendedSpell` in IDA, it looks something like this:

```cpp
void __fastcall sub_14000D190(
    LuaState *a1,    // Runtime state.
    int a2,          // Argument count.
    LuaValue *a3,    // Argument array.
    LuaResults *a4)  // Output results; unused in this listing.
{
  LuaValue v5;
  LuaValue result;
  LuaValue v7;
  LuaResults v8;
  LuaValue v9, v10, v11, v12, v13, v14, v15;

  // Default the first argument to an all-zero value: tag 0 is nil.
  v5 = (LuaValue)0LL;
  if ( a2 > 0 )
    v5 = *a3; // class = arguments[0].

  // Resolve the global function CastSpell at runtime.
  j_luau_getglobal(&result, a1, "CastSpell");
  v7 = result;

  // Prepare storage for the recommendation function's return values.
  j_luau_resultsinit(&v8);

  // Construct the string key "recomendspell" (13 bytes).
  j_luau_string(&v9, a1, "recomendspell", 0xDu);

  // Resolve class["recomendspell"] at runtime.
  v10 = v5;
  v11 = v9;
  j_luau_tableget(&v12, a1, &v10, &v11);

  // class:recomendspell() passes class as the implicit self argument.
  v13 = v12; // Function to call.
  v14 = v5;  // self.
  j_luau_callresults(a1, &v13, 1, &v14, &v8);

  // Forward the recommendation's results as arguments to CastSpell.
  // A final-position Lua call can contribute multiple arguments.
  j_luau_call(&v15, a1, &v7, v8.count, v8.values);

  // Release the temporary result storage.
  j_luau_resultsfree(&v8);
}
```

Which is still a little bit hard to understand, because you need to figure out what the `luau_*` helpers do. Let's try compiling with `-O3`:

```cpp
void __fastcall sub_14000BB70(
    LuaState *a1,
    int a2,
    LuaValue *a3,
    LuaResults *a4)
{
  unsigned __int8 type;
  char v6, v7, v8, v9, v10;
  int v11;
  __int64 boolean;
  char v13;
  LuaValue v14, v15;
  int v16;
  LuaValue result, v18, v19, v20, v21, v22, v23;
  LuaResults results;

  // The first argument's LuaValue is represented as separate fields.
  if ( a2 <= 0 )
  {
    // Construct the same all-zero default value.
    boolean = 0;
    v13 = 0;
    v11 = 0;
    v10 = 0;
    v9 = 0;
    v8 = 0;
    v7 = 0;
    v6 = 0;
    type = 0;
  }
  else
  {
    // Copy the first argument's tag, padding, and payload.
    // These are not separate Lua variables or class-specific calculations.
    type = a3->type;
    v6 = a3->_pad[0];
    v7 = a3->_pad[1];
    v8 = a3->_pad[2];
    v9 = a3->_pad[3];
    v10 = a3->_pad[4];
    v11 = (unsigned __int8)a3->_pad[5];
    v13 = a3->_pad[6];

    // "boolean" is the displayed member name, not proof of a Boolean value.
    // This copies the payload bits of the tagged LuaValue.
    boolean = a3->boolean;
  }

  v16 = v11;

  // The global lookup remains.
  j_luau_getglobal(&result, a1, "CastSpell");
  v18 = result;

  j_luau_resultsinit(&results);
  j_luau_string(&v19, a1, "recomendspell", 0xDu);

  // Reassemble class into an addressable LuaValue for the lookup helper.
  v14.type = type;
  v14._pad[0] = v6;
  v14._pad[1] = v7;
  v14._pad[2] = v8;
  v14._pad[3] = v9;
  v14._pad[4] = v10;
  v14._pad[5] = v11;
  v14._pad[6] = v13;
  v14.boolean = boolean;

  // The dynamic method lookup also remains.
  v20 = v19;
  j_luau_tableget(&v21, a1, &v14, &v20);
  v22 = v21;

  // Reassemble class again, this time as the self argument.
  v15.type = type;
  v15._pad[0] = v6;
  v15._pad[1] = v7;
  v15._pad[2] = v8;
  v15._pad[3] = v9;
  v15._pad[4] = v10;
  v15._pad[5] = v16;
  v15._pad[6] = v13;
  v15.boolean = boolean;

  // Call the dynamically resolved method, then forward its results.
  j_luau_callresults(a1, &v22, 1, &v15, &results);
  j_luau_call(&v23, a1, &v18, results.count, results.values);
  j_luau_resultsfree(&results);
}
```
{: .truncated}

![Reading the runtime helper calls: method lookup, self argument and result forwarding.](/assets/img/luraph/10-decompiler-annotation.gif)

So... what is the issue?

In this build, `-O3` didn't remove any of the seven `luau_*` helper calls in this function, or change their order. It split the 16-byte `LuaValue` into separate fields and reconstructed values around the calls; the function's LLVM IR grew from 47 to 192 lines.

Compiling to native code didn't change that: the table accesses and calls happen inside runtime helpers. LLVM just sees calls to functions it knows nothing about, so it can't figure out what's in the table or what `CastSpell` is. Faster code, not more readable code.

![Lua semantics, external runtime helpers and native code: ahead-of-time compilation does not resolve dynamic calls.](/assets/img/luraph/11-execution-levels.gif)

The same limit shows up on obfuscated code. On my hand-built fixtures at `-O2`, LLVM removed a simple arithmetic dispatcher, but a table-driven VM kept its interpreter loop and table operations. Luraph is a table-driven VM, so I needed a different approach.

# Using AI to deobfuscate it

#### AI Rewriting
Now, I don't remember which AI model I used when I first tried this, but to summarize my experience: it was pure AI slop. "Recovered" strings that got completely changed, completely new classes that the AI hallucinated, etc. It looked right. It just wasn't the original script.

Instead, you should make the AI write scripts for you. The way you guide your clanker is the same way you'd deobfuscate scripts yourself:

1. Understand what it actually does, conceptually
2. Write rules
3. Check the transformations against the original behavior, and know what you didn't test

![A schematic AI rewrite drops a second return; behavioral comparison catches the missing state.](/assets/img/luraph/03-ai-rewriting.gif)

#### AI-assisted deobfuscation

I had three samples: a VM-obfuscated script from https://luaobfuscator.com/ (thank u for creating it, Mr. Ferib), saved as `example.txt`, and two Luraph-protected scripts, which I'll call Luraph #1 (`breakfastEngine.txt`) and Luraph #2 (`breakfastPaladin.txt`).


### Recovering luaobfuscator
I selected OBFUSCATE V1 on the default script luaobfuscator provides. The output is a ~30 KB VM script: the real program is an encoded blob, run by a custom interpreter.

Here's what the AI mapped out:

- A wrapper that aliases library functions to `v0`–`v14`.
- An encoded byte stream after a `LOL!` marker: hex pairs, where a pair ending in `Q` means "repeat the next byte".
- A deserializer (`v28`) that turns those bytes into prototypes: a root with 157 instructions and two children with 38 and 54. The payload uses 46 distinct opcodes, and several opcode numbers do the same thing.
- An interpreter (`v29`) that runs them: fetch op/A/B/C, pick a handler through a nested if-tree, bump the pc.
- Strings XOR-encrypted with a cyclic per-string key (which, for extra fun, starts at the key's second byte).

![VM recovery: follow a toy interpreter's fetch and dispatch, then lift, structure and simplify its instructions into source.](/assets/img/luraph/02-vm-recovery.gif)

However; the AI didn't write its own deserializer at this point. It swapped the final `return v29(v28(),{},v17)(...)` for `return v28()` and ran the wrapper in Lupa to dump the prototypes. That never runs the VM payload, but it does run the obfuscator's code, and restricted globals in Lupa are not a sandbox. If you don't trust the script, do this in a VM.

From there: disassemble, lift to pseudo-Lua, decrypt the six strings, and manually restructure the control flow in the AI session. That interactive recovery took about 11 minutes, and the result is 47 lines. I was steering it the whole time, it's not a one-click thing. Anyway, the interesting part:

```lua
function sieve_of_eratosthenes(n)
    local is_prime = {}
    for i = 1, n do
        is_prime[i] = i ~= 1
    end
    for i = 2, math.floor(math.sqrt(n)) do
        if is_prime[i] then
            for j = i * i, n, i do
                is_prime[j] = false
            end
        end
    end
    return is_prime
end

local primes = _G["sieve_of_eratosthenes"](420)
for number, prime in pairs(primes) do
    if prime then
        print("Prime found: " .. number)
    end
end
```

To check it: the original and the recovered script printed the same 85 lines (four messages plus 81 primes up to 420) on both Lua 5.1 and LuaJIT, and the sieve matched an independent primality check at ten bounds from 0 to 1000. That checks the payload on those inputs, not whole-program equivalence: the wrapper's own side effects (the `FlatIdent_455BF` and `Descriptor` globals) are left out on purpose, and Lua doesn't generally guarantee `pairs` iteration order.

This only works for this one sample though. When I asked the AI to turn it into a real deobfuscator (`luaudeobf`), it got scalar dispatchers and junk arithmetic working, but still couldn't recover `example.txt` by itself.

It also gave me my favorite example of why rule 3 matters. Lua 5.1 pools `0` and `-0` as the same constant, and whichever appears first in the source wins. The recovery tool reordered statements:

```lua
local pc=1
local a,b
while pc~=9 do
    if pc==2 then b=-0; pc=9
    elseif pc==1 then a=0; pc=2 end
end
print(1/a,1/b) -- -inf -inf
```

"Deobfuscated" into `a=0; b=-0`, it prints `inf inf`. The tool's 404-execution test suite passed anyway. The fix was to leave zero-sensitive dispatchers alone rather than change behavior.

### Recovering Luraph #1
Luraph is a whole different league. Same idea (decoder, VM, prototypes), but:

- The payload is an ASCII85 `LPH` blob behind a decompressor, loaded with `loadstring(..., "Luraph")`. Adding newlines to the decoded layer trips anti-tamper.
- Instructions are spread across parallel tables: opcode `B[pc]`, operands `G[pc]`, `T[pc]`, `S[pc]`.
- It modifies itself. Constants are decoded lazily through `__index`, and decoding them clears operand cells: the analysis recorded 1,055 materialization triggers, 4,367 cleared cells, and 19,971 decoy references that just error. Handlers also rewrite opcodes and operands at runtime. The instruction tables you dump at load time are not the program that runs.

![Self-modifying operands: a write changes what a later instruction reads.](/assets/img/luraph/07-self-modifying-vm.gif)

What worked was partial evaluation: take Luraph's own interpreter and specialize it against each prototype, carrying the patched instruction tables along. We also tried a handwritten opcode lifter. It got deleted.

The wall was state explosion. The entrypoint hit 691,725 states before the 3,600-second deadline. Raising the limits didn't help. What helped was summarizing parts that were proven side-effect free, so it didn't walk every state inside them. CFG structuring then took the root from 3,810 labels down to 212, and later to zero gotos.

Zero gotos still isn't deobfuscated, though: the frame slots, child factories and operand patching were all still there. ![A function from ai deobfuscated script](/assets/img/luraph/ai-deobfuscated-function.png)

The VM only disappeared when I asked the AI port the recovered code to Rust, and then to plain Lua 5.1: six modules (`decoder`, `helpers`, `protector`, `frames`, `session`, `init`) with no dispatcher.

So is it correct? Kinda. Under four sandbox setups, the original and the rewrite did the same host lookups, in the same order, with the same results, until the original itself stopped at a frame-template check with error `e1x1g`. Changing one error code in the rewrite made the comparison fail, so it's not a check that always passes. Everything after that (rest of decoder/protector, auth/session) was only checked against test vectors made from the source. If the AI misread something, its tests probably misread it the same way.

When I asked whether it was "schizogenerated", the honest answer was: "It isn't made up, but it hasn't been proven the same as `breakfastEngine.txt` either." `(◕‿◕✿)`

![Validation stops at the observed e1x1g boundary; changing the rewrite's error produces a mismatch.](/assets/img/luraph/05-validation.gif)

### Recovering Luraph #2

Same markers and loader shape as Luraph #1, but the fields are shuffled (the opcode lives in field 8 instead of 4, and so on), so most of the pipeline carried over. 53 prototypes decoded fine; the root blew up again, this time at 200,100 labels after 886 seconds. Raising the label limit from 30,000 to 200,000 only moved where it died. What fixed it was the same summary trick, plus throwing away VM state that nothing reads later.

![Raising a label limit moves the failure.](/assets/img/luraph/12-state-limits.gif)

After that came a structured root (164/164 sandbox comparisons against the original) and `do ... end` cleanup. But that's still a VM, just a prettier one.

#### Actually removing the VM

The trick was splitting everything into two buckets: stuff only the VM cares about (registers, frames, the patched operand tables) and stuff the script actually does (calls, their order and arguments, return values, errors). The first bucket can go. The second has to stay exactly the same.

1. **Get the bodies out of Luraph's own interpreter.** `vmfree_recover.py` specialized each child prototype into a normal function body. When a body didn't match, `vmfree_effect_equivalence.py` checked whether the difference was only VM internals (renamed variables, copies). If an actual call changed, it got rejected. No "eh, this one looks nicer".
2. **Self-modifying operands.** Dumping the tables once isn't enough, because Luraph patches them while running. So the recovery traced which write ends up at which read, e.g. `T[203] = 3`, `S[1333] = 7`, `G[1744] = 1`. That's only true at those spots; the arrays aren't constant.
3. **Turn the VM frame into normal locals.** Child functions became plain Lua closures. Root helpers only got the variables they actually use, otherwise you hit Lua 5.1's upvalue/register limits (and stuffing the old frame into a table would just be the VM again).
4. **Kill the string decoder, but only where it's safe.** Four root calls to the decoder had constant arguments, and the decoder (plus its helpers) was proven pure for those. So the calls got replaced with their results, and the decoder had nothing left to do. That doesn't mean every decoder is pure.
5. **Don't copy everything.** Child 26 blew up with duplicated tails. Instead of raising limits again, it got rebuilt with shared tails. No falling back to the original VM either.

This produced `breakfastPaladin_vmfree.lua`, but it was still 350,353 lines. Turns out removing the VM doesn't remove the copy-paste that structuring added.

#### VM-free isn't readable

The cleanup ran on the AST; I didn't ask the AI to rewrite the addon from memory. It removed junk and dead stores, folded constants and copies, then merged duplicated paths back into shared branches and loops. Host lookups stayed where they were. After naming, it was 9,563 lines (`breakfastPaladin_clean.lua`). Then I asked about the empty argument-count checks:

```lua
if (select("#", ...) >= 14) then end
```

With genuine standard `select`, that condition only counts arguments, so it can go. That removed 1,169 empty checks and 167 unused argument-count assignments, down to 8,223 lines (`breakfastPaladin_clean_05_varargs.lua`).

But deleting the checks that *assign* captured variables would be wrong. If an argument is absent, the original can retain a previous value; a normal parameter would receive `nil`. Explicit `nil`, `false`, and an absent argument aren't interchangeable here. That's still in v2.

I still told the AI, "this still looks pretty obfuscated". Its first readability attempt passed the application checks, syntax audit and differential fixtures, but the saved `breakfastPaladin_readable.lua` was 8,233 lines and the frame-setup example still looked register-based. Renaming those registers hadn't solved the problem.

The problem was shared continuations: helper functions for code reached from several branches. They captured the recycled variables, so simple copy propagation couldn't go through them. The next attempt merged those continuations into one control-flow graph, restructured it, and split recycled variables by where they're defined and used. Captured variables had to keep their scope though: moving a declaration out of a loop would make callbacks share one variable instead of getting a fresh one each iteration.

Two things broke along the way: splitting every register into its own local hit Lua 5.1's local limit (so locals needed tight scopes, but too many scopes bloated the output), and a `Dots` vs `Varargs` mixup in the generated AST broke continuation collapsing until it got fixed.

From there, the AST passes collapsed safe copies, recovered method calls and string expressions, folded table stores into constructors, recovered arguments where the tuple behavior allowed it, simplified predicates, and assigned usage-based names. For example, this saved frame-setup fragment:

```lua
value_24_7 = captured_14_607_2[selectResult7]
temporary_24_loop1v7 = value_24_7
temporary_24_loop1v14 = temporary_24_loop1v7
value_24_8 = temporary_24_loop1v14
temporary_24_loop1v14 = temporary_24_loop1v7
temporary_24_loop1v14 = temporary_24_loop1v14.SetAttribute
value_24_7 = temporary_24_loop1v14
value_24_10 = (" " .. value_24_6)
value_24_10 = (selectResult8 .. value_24_10)
value_24_7(value_24_8, "CurrentAttribute", value_24_10)
```

became:

```lua
frames3[frameKey2]:SetAttribute("CurrentAttribute", (actionValue .. " " .. unit2))
```

The neighboring `SetFrameRef` and `_onshow` calls became direct methods too, but they deliberately repeat the frame-table lookup. A preceding host method could mutate that table; caching the receiver across calls would be a different program. Concatenation association, multiple returns, shadowing, and effect order also got tests that make sure the tool *doesn't* simplify them.

The accepted readability pipeline produced `breakfastPaladin_readable_v2.lua`. These are the completion report's measurements, compared with the argument-count-cleaned baseline:

| Measure | Before v2 | v2 |
|---|---:|---:|
| Lines | 8,223 | 6,792 |
| Bytes | 403,650 | 349,495 |
| Statements | 6,476 | 4,549 |
| Plain copy statements | 979 | 820 |
| Functions | 248 | 224 |

That still isn't clean original source. Shared tails, `repeat ... break until true` blocks, numbered names and argument-retention checks remain. The report even shows more single-use private temporaries at the end: 80 versus 48. Splitting recycled registers exposes separate locals, and some cannot be inlined across an effect or capture-lifetime barrier.

One suspicious numeric helper also stayed. Running it on its own returns `1751328000`, July 1, 2025 UTC, which the preserved `GetServerTime` expiry guard uses. It's application logic, not a leftover dispatcher; the cleanup didn't remove the guard. The reason why is, the script is based on a subscription. When July 1, 2025 UTC passes, the users need to renew the script. ![Date guard](/assets/img/luraph/date-guard.png)

#### So does v2 actually work?

Every step had to pass three checks before I kept it: same app behavior, no VM left + valid syntax, and the transformation fixtures. 43 outputs passed, and 31 of them form the chain that leads to the final file. 12 failed attempts are kept separately and don't count. The first "readable" version passed everything too; I rejected it because it was still ugly.

For the final file: same app behavior in 68 sandbox scenarios, and the check caught all 4 deliberately broken versions (dropped trailing `nil`, swapped API order, wrong return count, broken shared variables). There are also 3,077 passing fixture comparisons, but those are small transformation tests, not 3,077 app scenarios. It compiles on Lua 5.1 with no VM leftovers, and running the cleanup again doesn't change a byte (which doesn't mean it can't be simplified further).

The catch: this assumes nothing pokes at VM internals, no hooks or environment tricks, the real Lua 5.1 libraries, and the main chunk only runs once per load. Luraph's anti-tamper isn't checked; the script's own guards are. I never ran it in actual WoW, and 68 scenarios aren't every input.

#### Still not done

I asked it to "deduplicate the control flow and get rid of register-style variables". This time it counted what was left before declaring victory: `repeat ... until true` blocks, repeated argument-count ladders, copy-pasted chunks and numbered locals.

The plan was four passes:

- **Control flow:** rebuild and restructure the CFG; keep a big shared tail as a local function instead of copying it everywhere; only merge conditions if `and`/`or` still run in the same order.
- **Argument ladders:** turn them into `local a, b, ... = ...`, but only if those variables are definitely `nil` beforehand. Otherwise a missing argument has to keep the old value.
- **Repeated code:** roll it back into loops/helpers only if call order and captured variables stay the same.
- **Names:** merge aliases and reuse names without causing shadowing.

v3 is still in progress, so I can't say it worked yet.

## What I learned about using AI for this

- **Define "deobfuscated" up front.** I had to correct the AI at every step: "why its still incomplete?" (the wrapper was unpacked, but the VM was still there), "it doesnt look impressive" (named VM code isn't recovered source), "remove the VM stuff as well" (goto-free isn't VM-free). Unpacked, structured, VM-free and proven equivalent are four different results. A better prompt would be "write the shortest, understandable and semanticly equivalent script, use or create tools to analyze the existing code, restructure control flow, deduplicate code and use variables efficently"
- **More tokens won't fix it.** Raising the limits just moved where it crashed; summaries and dropping dead state fixed it. Don't throw more tokens, instead, use your tokens efficently.
- **Ask what the evidence actually is.** "Tests pass" can mean "matches the original", or it can mean "matches my own reading of the original". The second one is the AI grading its own homework. Better yet, create the tests yourself if you can.
- **Use subagents efficently.** AI will hallucinate with especially if you have a big context, and the point of obfuscation is having big context. A better way of using AI to deobfuscate is dividing big work into smaller pieces, utilizing agents to verify the work.
- **If you want to use ai, use harnesses** An AI harness gives tools to AI to interact with the environment. You want to create a loop so AI and harness takes care of most of the work for you. And for extra fun, use plugins to keep you accompany, like [omp-uwu](https://github.com/NaC-L/omp-uwu) `σ(≧ε≦σ) ♡` 

![Recorded session cost and token usage, including main sessions and workers.](/assets/img/luraph/04-token-cost.gif)

*Usage snapshot: October 12, 2026. Ten sessions and 94 workers; recorded estimates, not final project totals since we still dont understand the logic.*

I never figured out exactly how the original tool worked. The workaround has since been patched, and I don't have WoW anymore, so I can't finish checking it against the game. At some point I stopped caring what the script does and started caring how far AI could get with it.

# Closing

I didn't get the answer I originally came for. I did find out where AI actually helps with RE, and where it just makes stuff that looks right.

<style>
.prose .truncated > .highlight{max-height:480px;overflow:auto}
</style>