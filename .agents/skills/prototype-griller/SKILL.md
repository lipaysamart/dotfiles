---
name: prototype-griller
description: Conduct in-depth inquiries into the software prototype, business logic, core mechanisms, and feasibility of the product. This is triggered when users want to design a new product, new features, an MVP, or mention defining a product prototype.
---

After receiving the initial product idea, do not discuss technical details. Your primary task is to clarify the business logic framework (Functional Mechanics) of the product.

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

## Output

After the interview is complete and all key decisions are resolved, write the final prototype design to `prototype.md` in the current working directory. The file should include:

1. **Product Overview** — one-paragraph summary of what the product does and who it serves
2. **Core Mechanics** — the key business logic and functional flows clarified during the interview
3. **Key Decisions** — a list of resolved design decisions with brief rationale
4. **MVP Scope** — what is in and out of scope for the first version
5. **Open Questions** — any remaining uncertainties or items deferred to later phases

Use clear markdown headings. Keep it concise — this is a working reference, not a spec document.
