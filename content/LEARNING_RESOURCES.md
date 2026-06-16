# Electronics learning resources

Source material for building Ohmlet's curriculum (digitize → markdown → authored
lessons; see `CURRICULUM_AUTHORING.md`) and grounding Interview Mode. Compiled
2026-06-16 from r/electronics / r/AskElectronics consensus and curated GitHub lists.

## Books to download

Priority for digitizing is marked ⭐ (these map most directly onto the curriculum spine).

| Book | Author | Why | Level |
|------|--------|-----|-------|
| ⭐ Make: Electronics | Charles Platt | The #1 beginner recommendation, pure learn-by-doing | Beginner |
| ⭐ Encyclopedia of Electronic Components (Vol 1–3) | Charles Platt | Best source for per-component lessons | Reference |
| ⭐ Practical Electronics for Inventors | Scherz & Monk | The go-to comprehensive working reference | Beginner → Intermediate |
| Getting Started in Electronics | Forrest M. Mims III | Legendary hand-drawn classic | Beginner |
| Electronics for Beginners | Jonathan Bartlett | Modern; maps schematics → breadboard | Beginner |
| Make: More Electronics | Charles Platt | Sequel; logic, op-amps, sensors | Intermediate |
| The Art of Electronics | Horowitz & Hill | The field's bible | Advanced / reference |
| All New Electronics Self-Teaching Guide | Kybett & Boysen | Self-paced fundamentals | Beginner |
| Exploring Arduino | Jeremy Blum | Arduino-specific, project-led | Beginner → Intermediate |
| Programming Arduino: Getting Started with Sketches | Simon Monk | Arduino code fundamentals | Beginner |

**Digitize first:** Make: Electronics, Platt's Encyclopedia, Practical Electronics for Inventors.

## GitHub repos

### Curated "awesome" lists (resource firehoses)
- [kitspace/awesome-electronics](https://github.com/kitspace/awesome-electronics) — master EE resource list
- [nhivp/Awesome-Embedded](https://github.com/nhivp/Awesome-Embedded) — embedded programming
- [embedded-boston/awesome-embedded-systems](https://github.com/embedded-boston/awesome-embedded-systems) — libs, RTOSes, references
- [Lembed/Awesome-arduino](https://github.com/Lembed/Awesome-arduino) — Arduino hardware/libraries
- [iDoka/awesome-embedded-software](https://github.com/iDoka/awesome-embedded-software) — MCU-suitable software

### For Interview Mode (the "coding-interview-university for electronics" angle)
There is no single canonical repo like `jwasham/coding-interview-university` for
electronics/embedded. Candidates to verify and mine for question banks
(search terms): "embedded systems interview questions", "embedded engineering
roadmap", "firmware interview". TODO: confirm the live, well-starred ones before
relying on them.

## How these feed the product
1. **Curriculum** — digitize the ⭐ books → markdown → LLM-drafted, human-approved lessons.
2. **Interview Mode (Max tier)** — question banks grounded in the curriculum + embedded/interview repos, merged with company-specific data from a pasted job description.
3. **SEO blog** — each lesson concept also becomes a public build guide.
