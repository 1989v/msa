<!-- source: windwake/world.mjs -->
# Spec review — 2026-09-30

All six dimensions SHIP after one revision: architecture/implementation (cross_spec_arch), domain/use cases (cross_spec_domain), security/test strategy (cross_spec_test). Independent cross_spec_verdict confirmed the material findings.

Resolved: explicit required versus optional guardians, timed-relay deadline equality, separate snapshot/save restore coverage, actual equipped effects and actor-cap admission checks, documented complete-runtime rollback and preservation of newer saves. Inline glossary is sufficient; no additional domain concept or ADR required beyond ADR-0096/0097.

Approved scope remains SR1–SR5 in spec.md. No open pre-implementation question. Parallel ownership: world (cross_world), ruins (cross_ruins), relics/guidance (cross_guidance), integration/presentation/delivery (root).
