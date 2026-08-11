# Search — behaviour spec

The Search surface is a **correlation engine**, not a search engine. One seed in;
one merged, scored profile out.

## Interaction
- Time-of-day greeting: "Good morning / afternoon / evening, sir."
- Seed type selector: email, IP, phone, username, domain, business, MAC, image
  (image = upload for reverse search).
- Enter or Search → brief launch animation → loading state.
- Sidebar is collapsible; the collapse pattern applies to every surface.

## Live results
- Sources are queried in parallel; each one appears in real time as it returns,
  with a spinner → check, and shows **where** the data came from.
- Results populate a **hierarchical tree** (file-structure style): root = the
  seed; children = sources; leaves = extracted data points.
- No separate ranked "blue links." Everything merges into the one tree.

## Cross-reference + strength
- When the same data point returns from multiple sources it is linked and marked
  (e.g. `⇄ 3×`).
- A strength/likeliness meter scores each corroborated entity by independent source count: 1 = single-source, 2 = likely, 3 = strong, 4+ = confirmed.
- Score is computed from corroboration, never typed by a human or the model.

## Actions
- Click any data point to inspect it and trace it through the tree.
- Save any node, or the whole result, to the active case.
- "Search this further" pivots a data point into a new seed (and can be handed
  to the osint-agent).
