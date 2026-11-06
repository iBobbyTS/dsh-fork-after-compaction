# Maintainer contract

This project adds a conversation action at a completed compaction. It does not change compaction, implement a separate fork backend, or write session history.

- Fork at the selected successful `compaction/end`, not the current transcript tail or a preceding `turn/end`. Reuse the Chat view's fork and permission handling.
- Derive displayed summary and usage from the matching committed compaction. Do not invent missing provider usage.
- Keep DOM integration within the owning conversation; inherited sequence values do not identify a current session globally.
- README files own installation, user behavior and limits. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) owns rendering details, the statusbar integration contract and verification. Keep both README languages aligned when their behavior changes.
- Use the documented verification path for affected behavior and target DSH contracts. Harness tests do not establish real Desktop UI behavior.
