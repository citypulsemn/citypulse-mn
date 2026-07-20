-- City Pulse MN — reclassify events (roadmap 4.1)
-- Fixes categories that were assigned by whichever research agent FOUND the
-- event rather than by what the event actually IS. That flaw is why the Live
-- Music collection was empty while Festivals held 69.
--
-- 40 of 200 exported events change.
-- Paste into Supabase → SQL Editor. Wrapped in a transaction: review, then COMMIT.

begin;

-- ─────────────────────────────────────────────────────────
-- → MUSIC (16)
--   was arts      Cantus Vocal Ensemble Presents
--   was arts      Oratorio Society of Minnesota Presents
--   was arts      SPCO Opening Weekend: Beethoven's Second Symphony with Gabor Takacs-Nagy
--   was arts      SPCO Opening Weekend: Beethoven's Second Symphony with Gabor Takacs-Nagy
--   was arts      SPCO Opening Weekend: Beethoven's Second Symphony with Gabor Takacs-Nagy (Matinee)
--   was festival  Art and All That Jazz Festival
--   was festival  Lakeside Guitar Festival
--   was festival  Lakeside Guitar Festival
--   was festival  On The One Music Festival
--   was festival  Outlaw Music Festival
--   was festival  Uptown Porchfest
--   was festival  Uptown Porchfest (Second Edition)
--   was festival  Washington County Bluegrass Festival
--   was food      Beer Choir at Elm Creek Brewing
--   was food      Beer Choir at Forgotten Star Brewing
--   was food      Beer Choir at MetroNOME Brewery
update events set category = 'music' where id in (
  '9666229e-1662-4171-a06f-11eca4354191',
  '10eb0321-2aff-4fb7-b4af-7e450ff22281',
  '1ad16fd8-e8f1-4e66-8dc9-eed2e170824c',
  '446de284-5322-455a-9a35-f668087a5c76',
  '53dac8f4-136a-48af-b202-d37f2229c1f6',
  '733a8718-06ed-4504-97af-e7e0f83e66a1',
  '5a43e2ef-e622-4943-93e6-9e26fec7ad82',
  '7072ce6c-01a1-4118-9666-80680ea89a74',
  '7d0beb9d-ecc9-4176-95f2-d4df581a046e',
  'b7478075-6435-4905-8f73-b3ed64a8361d',
  'dad8bdf7-3fef-4484-915c-7a75eb44d1cd',
  '1491a285-42ba-430c-bc6f-43bc811945b5',
  '21721352-2e49-4b87-a69f-217eb670b057',
  '00e10b02-348f-4fcd-9f01-3da734a3dd15',
  '7932a92b-57d7-456d-8feb-2c642e6d1923',
  '07d332ac-0602-4654-9de0-378ff93da141'
);

-- ─────────────────────────────────────────────────────────
-- → ARTS (9)
--   was family    Art on Fire - Eagan Art Block
--   was family    Caponi Art Park Self-Guided Family Trails
--   was festival  Arboretum Art & Craft Festival
--   was festival  Art in the Gardens
--   was festival  Downtown Minneapolis Street Art Festival
--   was festival  Jackalope Art Fair
--   was festival  Minnesota Fringe Festival
--   was festival  Minnesota Fringe Festival
--   was festival  Powderhorn Art Fair
update events set category = 'arts' where id in (
  'ee0db639-6d55-43dd-ade0-574de0f5c614',
  'e5c38b9e-4738-40a4-8e5c-c478fe18797c',
  'bc94d4ba-5d71-45ba-bec0-b6ed7a651df7',
  '50820b68-5dbd-4e9e-a2a8-9bdc32492683',
  'b052df82-7bbb-4338-9731-18b8bc53714f',
  'aae00b26-0483-4098-9364-4135ff6dee0e',
  '914ace60-a990-46f7-be66-b683240dde02',
  'fd98755b-ae36-4ec1-8f29-7505d74aecc8',
  'ff5879c1-c4fa-4ec7-b926-bab54f8d53e4'
);

-- ─────────────────────────────────────────────────────────
-- → FOOD (7)
--   was festival  Brews, Eats and Beats
--   was festival  Brews, Eats and Beats
--   was festival  Latin Music and Food Festival
--   was festival  Minnesota Food Truck Festival - Minneapolis
--   was festival  MinnesoThai Street Food Festival
--   was festival  Nershfest
--   was festival  Taste of Greece Festival
update events set category = 'food' where id in (
  '96b7b567-c9eb-4880-92e0-a5f3d99d06e8',
  '185c81a1-6b9e-4c87-8d27-d4f080b3cfc8',
  '5af979b9-0d38-4fd3-8806-2df76ae65f54',
  '17985ef8-2e60-43d9-a82e-691691e30ccf',
  '3bdd4a7a-2df1-4b9f-ad21-b9c54446054f',
  '1fe9d03d-b310-4d30-9fdd-c35153b9803e',
  'fc3792c9-e409-449b-9a9f-a3acfc93266e'
);

-- ─────────────────────────────────────────────────────────
-- → FAMILY (2)
--   was arts      Free First Saturday: Puppet Playdate
--   was arts      Mia Family Day
update events set category = 'family' where id in (
  '55d3e25b-abf2-49fc-81af-20707b446a37',
  'b678b15e-2684-4605-a4e7-c97c20dcab37'
);

-- ─────────────────────────────────────────────────────────
-- → FESTIVAL (6)
--   was family    Blaine World Fest
--   was family    Carver Steamboat Days
--   was food      Carver County Fair
--   was food      Chaska River City Days 2026
--   was food      Colors of Southeast Asia Fest (COSA Fest) 2026
--   was food      Dakota County Fair
update events set category = 'festival' where id in (
  '7fcf3167-7913-4909-86ed-57d502e31de0',
  '71ec90db-0764-47ae-98df-9eaa26f679a7',
  '3c61b213-00c9-456e-953f-e01d826e4f2a',
  '8860b470-f43e-4dc5-becf-58bea3dd9101',
  '85c905a9-c362-4d4f-8291-f1048fa136eb',
  '9a24aa89-28c9-4e65-98fa-4aca4e6bfbea'
);

commit;
-- (use ROLLBACK; instead if anything looks wrong)

-- Verify afterwards:
-- select category, count(*) from events where status = 'published'
-- group by category order by 2 desc;
