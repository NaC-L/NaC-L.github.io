---
layout: post
title:  "When Dragons Fight Back: Logic Assisted Reversal Program (L.A.R.P.) and Super Learning Optimized Program (S.L.O.P.)"
date:   2025-10-14 15:06:37 +0300
toc: true
categories:
---


# Table Of Contents

* 
{:toc}


# Intro
⚡ Today, we delve in the realm of amazing devirtualization of Virtual Machines and Artificial Intelligence.


🔍 We will be focusing on a comprehensive framework called "VMDragonSlayer", an advanced open-source tool designed to tackle one of the toughest problems in reverse engineering: VM based obfuscation.


👉 I call this process Logic Assisted Reversal Program and Super Learning Optimized Program — LARP & SLOP for short.


Please meet our mascot:


![image](/assets/img/dragons/mascot1.jpg)
# Awakening the Dragon


🧩 VMDragonSlayer is trying to make VM-based obfuscation less of a black box, giving analysts a framework to automate, scale, and learn.


On the left, you can see the original code, whereas on the right you can see the algorithm of nightmare fuel — indeed would put H.P. Lovecraft to shame.


![image](/assets/img/dragons/nightmare.jpg)


Over 500+ instructions, 16384 path constraints, more than 256 virtual registers, and 512 custom vm handlers. **It was truly astonishing to observe VMProtect, a stack based VM, use virtual registers for its VM.** Very robust and sophisticated investigation of VMProtect infrastructure.
<sub>On a serious note, the original claim of "256 virtual registers" in the VMProtect sample is complete bullshit. VMProtect is a stack based vm, it would use the stack for vm operations, not virtual registers.<sub>




This is a big issue for our soldiers in the front line, waging the war against malware.


![image](/assets/img/dragons/king_terryjpg.jpg)


As you can see, it is a completely overwhelming, unsustainable fight.


# The three headed dragon 🐉🐉🐉


![image](/assets/img/dragons/mascot2.jpg)


# Forging the Dragon Slaying Sword
Aight aight, here is the fun part.


## Logic Assisted Reversal Program (L.A.R.P.)


### SAT Solver


[Here is our sat solver.](https://github.com/poppopjmp/VMDragonSlayer/blob/7250e415240d830a4793983c370626a4d89043e3/dragonslayer/analysis/symbolic_execution/solver.py#L368)




<div class="code-container truncated">
{% highlight py %}{% raw %}
def _evaluate_constraint(self, constraint: Constraint, assignments: Dict[str, Any]) -> bool:
        """Evaluate a single constraint against variable assignments"""
        try:
            expr = constraint.expression.strip()
           
            # Replace variables with their assigned values
            eval_expr = expr
            for var_name in constraint.variables:
                if var_name in assignments:
                    value = assignments[var_name]
                    # Replace variable names with their values
                    eval_expr = eval_expr.replace(var_name, str(value))
           
            # Evaluate different constraint types
            if constraint.type == ConstraintType.EQUALITY:
                if "==" in eval_expr:
                    left, right = eval_expr.split("==", 1)
                    try:
                        return int(left.strip()) == int(right.strip())
                    except ValueError:
                        return str(left.strip()) == str(right.strip())
                       
            elif constraint.type == ConstraintType.INEQUALITY:
                if "!=" in eval_expr:
                    left, right = eval_expr.split("!=", 1)
                    try:
                        return int(left.strip()) != int(right.strip())
                    except ValueError:
                        return str(left.strip()) != str(right.strip())
                elif ">" in eval_expr and ">=" not in eval_expr:
                    left, right = eval_expr.split(">", 1)
                    return int(left.strip()) > int(right.strip())
                elif ">=" in eval_expr:
                    left, right = eval_expr.split(">=", 1)
                    return int(left.strip()) >= int(right.strip())
                elif "<" in eval_expr and "<=" not in eval_expr:
                    left, right = eval_expr.split("<", 1)
                    return int(left.strip()) < int(right.strip())
                elif "<=" in eval_expr:
                    left, right = eval_expr.split("<=", 1)
                    return int(left.strip()) <= int(right.strip())
                   
            elif constraint.type == ConstraintType.BOOLEAN:
                if "true" in eval_expr.lower() or eval_expr == "1":
                    return True
                elif "false" in eval_expr.lower() or eval_expr == "0":
                    return False
                # Try to evaluate as boolean expression
                try:
                    return bool(eval(eval_expr))
                except:
                    return True
                   
            elif constraint.type == ConstraintType.ARITHMETIC:
                # For arithmetic constraints, assume they're satisfied if we can evaluate them
                try:
                    result = eval(eval_expr)
                    return bool(result)
                except:
                    return True
                   
            elif constraint.type == ConstraintType.BITWISE:
                # For bitwise operations
                try:
                    result = eval(eval_expr)
                    return bool(result)
                except:
                    return True
                   
            # Default case - assume satisfied
            return True
           
        except Exception as e:
            logger.debug(f"Error evaluating constraint {constraint.expression}: {e}")
            return True  # Assume satisfied on error
{% endraw %}
{% endhighlight %}
</div>


Here, as you can notice, we gracefully assume that every variable has a value to solve the expression. This way, we can solve the expression with simply converting our string expression to int and compare. Converting expressions to string and backforth allows us to handle errors more gracefully. I also invite you to take a check out the eval function
```py
def eval(expr):
    # Real implementation here
```


I previously had mentioned that in VM based protections, you would see path constraints. To wrestle with this, we lift the instructions. [Below, you can see a comprehensive function that lifts control flow.](https://github.com/poppopjmp/VMDragonSlayer/blob/7250e415240d830a4793983c370626a4d89043e3/dragonslayer/analysis/symbolic_execution/lifter.py#L326)




### Lifter


<div class="code-container truncated">
{% highlight py %}{% raw %}
  def _lift_control_flow(
        self, instruction: Instruction, context: ExecutionContext
    ) -> LiftingResult:
        """Lift control flow instructions"""
        constraints = []
        symbolic_values = []
        new_contexts = []


        # Example: conditional branch
        if instruction.mnemonic.upper() in ["JE", "JNE", "JMP"]:
            if instruction.mnemonic.upper() == "JMP":
                # Unconditional jump
                new_context = context.clone()
                if instruction.operands:
                    new_context.pc = int(instruction.operands[0])
                new_contexts.append(new_context)
            else:
                # Conditional jump - create two paths


                # Branch taken
                taken_context = context.clone()
                taken_constraint = SymbolicConstraint(
                    type=ConstraintType.BOOLEAN,
                    expression=f"branch_condition_{instruction.address} == true",
                    variables={f"branch_condition_{instruction.address}"},
                    source_instruction=instruction.address,
                )
                taken_context.add_constraint(taken_constraint)
                if instruction.operands:
                    taken_context.pc = int(instruction.operands[0])
                constraints.append(taken_constraint)
                new_contexts.append(taken_context)


                # Branch not taken
                not_taken_context = context.clone()
                not_taken_constraint = SymbolicConstraint(
                    type=ConstraintType.BOOLEAN,
                    expression=f"branch_condition_{instruction.address} == false",
                    variables={f"branch_condition_{instruction.address}"},
                    source_instruction=instruction.address,
                )
                not_taken_context.add_constraint(not_taken_constraint)
                not_taken_context.pc += 1  # Next instruction
                constraints.append(not_taken_constraint)
                new_contexts.append(not_taken_context)


        return LiftingResult(
            new_contexts=new_contexts,
            constraints_added=constraints,
            symbolic_values_created=symbolic_values,
        )
{% endraw %}
{% endhighlight %}
</div>


As you can see, we lift [every instruction](https://www.felixcloutier.com/x86/jcc) that creates a conditional branch, "JE", "JNE", "JMP".


[Here is the function that is responsible of stack operations.](https://github.com/poppopjmp/VMDragonSlayer/blob/7250e415240d830a4793983c370626a4d89043e3/dragonslayer/analysis/symbolic_execution/lifter.py#L369)
<div class="code-container truncated">
{% highlight py %}{% raw %}
 def _lift_stack(
        self, instruction: Instruction, context: ExecutionContext
    ) -> LiftingResult:
        """Lift stack operations"""
        new_context = context.clone()
        constraints = []
        symbolic_values = []


        # Example: PUSH operation
        if instruction.mnemonic.upper() == "PUSH" and instruction.operands:
            value = instruction.operands[0]


            # Create symbolic stack operation
            stack_value = SymbolicValue(
                name=f"stack_push_{instruction.address}",
                size=32,
                metadata={"instruction": str(instruction), "stack_op": "push"},
            )


            constraint = SymbolicConstraint(
                type=ConstraintType.MEMORY,
                expression=f"stack[sp] == {value}",
                variables={"sp", str(value)},
                source_instruction=instruction.address,
            )


            stack_value.add_constraint(constraint)
            constraints.append(constraint)
            symbolic_values.append(stack_value)


            # Update stack pointer
            sp_value = SymbolicValue(name=f"sp_after_{instruction.address}", size=32)
            sp_constraint = SymbolicConstraint(
                type=ConstraintType.ARITHMETIC,
                expression=f"sp_after_{instruction.address} == sp - 4",
                variables={"sp", f"sp_after_{instruction.address}"},
                source_instruction=instruction.address,
            )
            sp_value.add_constraint(sp_constraint)
            constraints.append(sp_constraint)
            symbolic_values.append(sp_value)


            new_context.set_register("sp", sp_value)


        return LiftingResult(
            new_contexts=[new_context],
            constraints_added=constraints,
            symbolic_values_created=symbolic_values,
        )
{% endraw %}
{% endhighlight %}
</div>


Have you noticed for **PUSH**, we set [sp] first then decrement it by 4? Truly powerful and correct. This also covers all the cases, because every value pushed will always be 4 bytes.


And for the **POP** instruction, find lines 69-82, if you can't find it, here it is:
```py
# Implement logic for pop here.
```


<sub>Serious note: Seriously? Do you even need a note? Everything here is completely ai hallucinated.<sub>


[And do I even need to mention bitwise operations?](https://github.com/poppopjmp/VMDragonSlayer/blob/7250e415240d830a4793983c370626a4d89043e3/dragonslayer/analysis/symbolic_execution/lifter.py#L469)


I think you get the point.




## Super Learning Optimized Program (S.L.O.P.)


[Here are some patterns we thought of:](https://github.com/poppopjmp/VMDragonSlayer/blob/7250e415240d830a4793983c370626a4d89043e3/dragonslayer/analysis/pattern_analysis/recognizer.py#L410)


```py
# Arithmetic operations
        self.add_pattern(
            SemanticPattern(
                name="VM_ADD",
                pattern_type="arithmetic",
                signature=[
                    "0x50",
                    "*",
                    "0x50",
                    "*",
                    "0x51",
                ],  # PUSH val1, PUSH val2, ADD
                constraints=["length:>=5"],
                metadata={
                    "description": "VM addition operation",
                    "semantic_equivalent": "val1 + val2",
                    "complexity": 2,
                },
            )
        )
```


If we catch this signature in our target binary, that indicates a vm add operation was executed. We determine this by using powerful AI technologies.


We can also determine other **common** vm operations, such as : 'VM_LOAD_URL', 'VM_HOOK_BROWSER', 'VM_CAPTURE_CREDS'. <sub>Serious note again, this is completely made up.</sub>


![image](/assets/img/dragons/lmfao.jpg)




# When Dragons Fight Back


Unfortunately, VMDragonSlayer is not perfect, it has a failure rate of 30% after we merge with a parallel universe where this project actually works.


Here are some issues that VMDragonSlayer fails to tackle:


Advanced Techniques (3% of failures) include:
Cutting-Edge Defenses:


AI-Driven Obfuscation:


- Neural network-generated handler variations that morph VM instruction patterns.
- Adversarial patterns crafted to evade machine learning detection.
- Dynamic adaptation of patterns in response to analysis attempts.




Quantum-Resilient Strategies:


- Use of post-quantum cryptographic algorithms to secure VM operations.
- Integration with hardware security modules for enhanced protection.
- Quantum-inspired superposition techniques that create unpredictable VM states.


If you don't want to go for realism, you can go better than realism. What do you mean by better than realism, how about an elephant with blue eyes?


![image](/assets/img/dragons/terry-a-davis-terry-davis.gif)


# The End
Let's stop the sarcasm and be serious.


If there is one thing that is incredible about this project, it is the impudence of the "creator" of this project and the incompetence of the reviewing team of defcon. That was two, but hey, I never claimed I was good at counting. Anyone who's associated with this project or associated with delivering this project to people should be ashamed of themselves.


This is not about AI generated code and presenting it. You can use AI, however this is not what is happening here.


You might think this blog post mocks them, but in reality we are the joke for allowing this to happen in the first place.


We, passionate and skilled reverse engineers, have to change this.


# Special Thanks

Check these amazing people out if you don't already know them.

[Aslan](https://github.com/r3bb1t)

[Marius](https://github.com/Nitr0-G)

[Dan](https://github.com/Dan0xE)

[Mrexodia](https://github.com/mrexodia)

[phage](https://github.com/kyle-elliott)

[terraphax](https://www.terraphax.com/home)

[colton](https://github.com/Colton1skees)

[momo5502](https://momo5502.com/)

[can1357](https://blog.can.ac/)

[Garfield1002](https://github.com/Garfield1002)


<style>
/* Thumbnail Styles */
.zoomable-thumbnail {
  aspect-ratio: 16 / 9;
  width: auto;
  max-height: 300px;
  height: auto;
  cursor: pointer;
  display: block;
  margin: 20px auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  transition: transform 0.2s;
}

.zoomable-thumbnail:hover {
  transform: scale(1.03);
}

/* Modal Backdrop */
.modal {
  display: none;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0,0,0,0.9);
  overflow: auto;
  transition: transform 0.3s ease;
  transform-origin: center center;
  cursor: grab;
  -webkit-overflow-scrolling: touch;
}

/* Modal Content */
.modal-content {
  margin: auto;
  display: block;
  width: auto;
  height: auto;
  max-width: 90vw;
  max-height: 90vh;
  transition: transform 0.3s ease;
  transform-origin: center center;
  object-fit: contain;
  transition: transform 0.3s ease;
  transform-origin: center center;
}

.modal-content.zoomed {
  transform: scale(2);
}

/* Close Button */
.close {
  position: absolute;
  top: 20px;
  right: 20px;
  color: #f1f1f1;
  font-size: 40px;
  font-weight: bold;
  transition: 0.3s;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.close:hover {
  color: #bbb;
}



.truncated {
    max-height: 300px; overflow-y: scroll; border: 1px solid #ccc; padding: 10px;
}

button {
    margin-top: 5px;
    cursor: pointer;
    padding: 5px 10px;
}

</style>