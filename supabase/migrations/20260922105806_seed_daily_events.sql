-- Migration: seed_daily_events
--
-- Public Alpha pool: 10 hardcoded events, one decision × two outcomes.
-- Idempotent (ON CONFLICT DO NOTHING) so re-running never duplicates or
-- overwrites live edits made through the table.
--
-- sort_order 0 is the FTUE event: a fresh user's day 0 always lands on it.
-- Outcomes are deliberately asymmetric: the "curious" choice pays more and
-- hints at a consequence the Public Alpha does not implement (lore-tease);
-- the "safe" choice pays less and is clean.

insert into public.daily_events_catalog
  (id, sort_order, title, narrative, option_a, option_b)
values
  (
    'ftue_first_event_static_1', 0,
    'Strange Packet at the Door',
    'A Fork brings something to the Main Branch terminal. It''s a packet — old format, half-corrupted, addressed to nobody. The Fork wants to know what to do.',
    '{"label": "Open it. The 404 doesn''t deliver mail by accident.", "outcome_text": "It was a fragment. A blueprint for something we don''t have a name for yet. (And maybe a problem for tomorrow.)", "bytes_delta": 25}',
    '{"label": "Burn it. Curiosity is how Repos get force-pushed.", "outcome_text": "Smart. Boring, but smart. The Fork files the ash with the rest of the questions we don''t ask.", "bytes_delta": 10}'
  ),
  (
    'flickering_terminal_01', 10,
    'The Green Terminal in Room 3',
    'The terminal nobody is supposed to touch is printing again. Same line, over and over: MERGE PENDING. A Fork is standing in front of it, hand hovering over the keyboard.',
    '{"label": "Let them press Enter. What''s the worst a merge can do.", "outcome_text": "Nothing happened. Then the lights dimmed for exactly one second. The Fork swears they heard something say ''thank you''.", "bytes_delta": 20}',
    '{"label": "Pull the plug. Again.", "outcome_text": "The terminal goes dark. It will be printing again by morning. It always is.", "bytes_delta": 10}'
  ),
  (
    'open_source_trader_01', 20,
    'A Trader at the Perimeter',
    'An Open Source Trader is waiting outside, cart full of parts nobody has seen in years. They want to come in and ''just look around''. They keep glancing at your Power Plant.',
    '{"label": "Let them in. Trade is how the 404 stays alive.", "outcome_text": "They left a bag of salvaged RAM as thanks and a business card that reads ''no refunds''. Nothing is missing. Probably.", "bytes_delta": 25}',
    '{"label": "Trade through the fence. Nobody comes inside.", "outcome_text": "Fair deal, cold handshake. They''ll be back. Traders always come back to the careful ones.", "bytes_delta": 15}'
  ),
  (
    'dependabot_at_the_gate_01', 30,
    'Something Knocking in a Loop',
    'Three knocks. Pause. Three knocks. Pause. It has been going for an hour. Through the slit you can see a Crawler with a Dependabot badge still pinned to its chest, politely waiting.',
    '{"label": "Open the hatch a crack and see what it wants.", "outcome_text": "It handed you a pull request and walked away. The PR is 40,000 lines and titled ''bump everything''. You keep it as a warning.", "bytes_delta": 20}',
    '{"label": "Ignore it until it times out.", "outcome_text": "It timed out around dawn. The Forks slept badly but they slept.", "bytes_delta": 10}'
  ),
  (
    'static_broadcast_01', 40,
    'Voices in The Static',
    'The GitNet radio picked up a clean signal from The Static, which never happens. A voice reading coordinates. A Fork wants to write them down.',
    '{"label": "Log the coordinates. We might need them.", "outcome_text": "The voice stopped mid-number and said your Repo''s name. The Fork finished writing anyway. Brave, or stupid. Same thing out here.", "bytes_delta": 25}',
    '{"label": "Kill the radio. Clean signals are bait.", "outcome_text": "Silence. The Fork looks disappointed, then relieved, then goes back to work.", "bytes_delta": 10}'
  ),
  (
    'fork_argument_01', 50,
    'Two Forks, One Chair',
    'Two Forks are arguing over the only decent chair in the Main Branch. It''s been twenty minutes. The others are placing bets in bytes.',
    '{"label": "Auction the chair. Winner pays the Repo.", "outcome_text": "The chair sold for more than the chair is worth. Everybody is annoyed and slightly richer. This is what civilization looks like now.", "bytes_delta": 20}',
    '{"label": "Nobody gets the chair. Go build things.", "outcome_text": "Grumbling, then work. The chair sits empty like a monument to fairness.", "bytes_delta": 10}'
  ),
  (
    'zombie_process_01', 60,
    'Something Is Still Running',
    'The Power Plant is drawing more than it should. A Fork traced it to a process that predates the Merge Conflict, still ticking in a corner of the mainframe. Nobody knows what it computes.',
    '{"label": "Leave it running. It hasn''t hurt anyone yet.", "outcome_text": "It finished at 3 AM and printed one line: DONE. Then started over. The Forks have named it Steve.", "bytes_delta": 20}',
    '{"label": "Kill -9 it.", "outcome_text": "The draw dropped instantly. Somewhere in the 404, something noticed. You''ll find out later if that matters.", "bytes_delta": 15}'
  ),
  (
    'refugee_at_the_door_01', 70,
    'A Stranger with a Laptop',
    'A stranger made it to the perimeter carrying nothing but a laptop with 4% battery. They say they were a Maintainer once. They ask for a charge and a night indoors.',
    '{"label": "Let them charge. Everybody was somebody once.", "outcome_text": "They left before sunrise and wiped the laptop first. On the table: a hand-drawn map of The Heap with one X on it.", "bytes_delta": 25}',
    '{"label": "Charge the laptop through the fence. That''s all.", "outcome_text": "They said thanks and meant it. The Forks argue for an hour about whether that was kindness or cowardice.", "bytes_delta": 10}'
  ),
  (
    'old_wiki_page_01', 80,
    'The Wikipedia Clone Has an Extra Page',
    'A Fork browsing the local Wikipedia clone found an article that shouldn''t exist: a page about your Repo, last edited yesterday. Nobody here edits the wiki.',
    '{"label": "Read the whole thing.", "outcome_text": "It''s accurate up to this morning. The last section is titled ''Tomorrow''. It''s empty. For now.", "bytes_delta": 25}',
    '{"label": "Delete it and unplug the wiki server.", "outcome_text": "Gone. The Fork keeps checking anyway. So do you.", "bytes_delta": 10}'
  ),
  (
    'quiet_night_01', 90,
    'Nothing Happened Tonight',
    'No knocks. No signals. No Crawlers. The Forks don''t trust it. One of them suggests a night watch anyway; another suggests everybody sleeps for once.',
    '{"label": "Everybody sleeps. Quiet is allowed to just be quiet.", "outcome_text": "Eight hours. Nobody remembers the last time. Productivity in the morning is frankly suspicious.", "bytes_delta": 20}',
    '{"label": "Post a watch. The 404 doesn''t do free.", "outcome_text": "The watch saw nothing and is very tired. Nothing is also a result.", "bytes_delta": 15}'
  )
on conflict (id) do nothing;
