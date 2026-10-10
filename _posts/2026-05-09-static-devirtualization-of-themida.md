---
layout: post
title: "Static Devirtualization of Themida"
description: "Cross-post: devirtualizing CodeVirtualizer/Themida with guided symbolic evaluation, co-authored with IDontCode at Aftermath Labs."
preview_label: Themida / Devirtualization
date: 2026-05-09 12:00:00 +0300
---

I co-authored a new article with [IDontCode](https://aftermathlabs.net/authors/idontcode/) on the Aftermath Labs blog:

### [Static Devirtualization of Themida](https://aftermathlabs.net/blog/09/05/2026/)

The article demonstrates devirtualization of CodeVirtualizer/Themida protected code. The techniques apply to pretty much every virtual machine based obfuscator (VMProtect, VxLang, EagleVM, ...), requiring only minor modifications for each.

It covers:

- **Guided symbolic evaluation:** lifting native instructions into an IR and concretizing control flow as optimizations resolve unknown branch destinations, starting with a concrete stack pointer.
- **A small set of optimizations running to convergence:** constant promotion and memory modeling, constant folding, dead store elimination, instruction combination and branch folding are enough to collapse the VM scaffolding.
- **VM-specific parts:** VMEXIT classification by stack displacement, tracking the virtual instruction pointer to recognize loops, and Themida's VJCC handler.
- **Lowering back to native code:** dead dependency analysis, stack pointer rewriting, and why avoiding register spills matters for reinsertion.

The original, virtualized and devirtualized binaries are available at [backengineering/themida-devirt](https://github.com/backengineering/themida-devirt).

If you are new to the topic, my posts on [lifting]({{ '/2025/01/25/lifting_0.html' | relative_url }}) and [Mergen](https://github.com/NaC-L/Mergen) are a good starting point.

**[Read the full article on Aftermath Labs →](https://aftermathlabs.net/blog/09/05/2026/)**
