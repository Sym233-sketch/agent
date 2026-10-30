# Resident conversation redesign · 2026-10-30

The previous iteration changed colors without changing the interaction. This revision replaces its two-panel empty chat with a centered composition, a continuous sculptural mark and a single input surface. The preparation document becomes a drawer rather than an empty permanent column.

## Design studies

- [Ben Simmons, AI Chat Interface Design / LiLi](https://dribbble.com/shots/26593036-AI-Chat-Interface-Design): studied the actual image for its centered greeting/input hierarchy, restrained dark surfaces and compact prompt cards. No image or template code copied.
- [Cosmos Studio, Umami Ware case study](https://www.cosmos.studio/projects/umami-ware-ai-website): studied the documented emphasis on continuous transitions, animated navigation and interaction feedback. The live reference site could not be reached from the local browser; this is a case-study reference, not a claim to have tested its live animation.
- [Apple Intelligence](https://www.apple.com/apple-intelligence/): studied the separation between an expressive assistant identity and a clear input surface. No Apple assets used.

## Implemented motion

- Original WebGL trefoil tube: lit pearlescent material, time-based rotation and eased pointer response. It uses local mesh/shaders, no remote graphics or library. Intersection/visibility gates stop offscreen rendering; reduced motion displays a static frame; unavailable WebGL uses CSS artwork.
- Route changes synchronously mount the real controls, then crossfade the outgoing visual and stagger incoming elements. Topic prefilling continues to work immediately.
- Empty scene contracts when the first message is submitted. Busy styling follows the real request lifecycle, never fake progress or staged model replies.
- Transcript reconciliation retains old message nodes, including pending-to-confirmed user messages. Only added messages animate. Reading position is retained when a user has scrolled up.
- Document drawer transitions from the edge, with explicit open/close controls, Escape and focus return.
- Input border illumination, restrained magnetic primary action and eased hover movement give local feedback without hijacking the system cursor.

## Guardrails

No policy, resident matching, model provider or application approval semantics changed. Official citations, uncertainty, human assistance and owner confirmation remain in the existing workflows. No live model credit is used by automated tests. Existing registration scene remains intact.
