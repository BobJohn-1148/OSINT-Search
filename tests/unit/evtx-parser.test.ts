/**
 * EVTX parser tests keep Windows log import deterministic without requiring a
 * Windows event store. If filtering were only tested through wevtutil, provider
 * and event-id behavior would be hostage to the developer machine.
 */
import { filterEvtxEvents, parseEvtxXml } from "../../src/main/analyzers/evtx-parser";

const evtxXml = `
<Event>
  <System>
    <Provider Name="Microsoft-Windows-Security-Auditing"/>
    <EventID>4624</EventID>
    <Level>4</Level>
    <TimeCreated SystemTime="2026-08-10T10:00:00.000Z"/>
  </System>
  <RenderingInfo>
    <Message>An account was successfully logged on.</Message>
  </RenderingInfo>
</Event>
<Event>
  <System>
    <Provider Name="Microsoft-Windows-Security-Auditing"/>
    <EventID>4625</EventID>
    <Level>2</Level>
    <TimeCreated SystemTime="2026-08-10T10:01:00.000Z"/>
  </System>
  <RenderingInfo>
    <Message>An account failed to log on.</Message>
  </RenderingInfo>
</Event>`;

it("evtx parser reads a fixture and filters by event id so Windows events become case evidence", () => {
  const events = parseEvtxXml(evtxXml);
  const filtered = filterEvtxEvents(events, { eventId: 4625 });

  expect(events).toHaveLength(2);
  expect(filtered).toEqual([
    {
      eventId: 4625,
      provider: "Microsoft-Windows-Security-Auditing",
      level: "error",
      timestamp: "2026-08-10T10:01:00.000Z",
      message: "An account failed to log on."
    }
  ]);
});
