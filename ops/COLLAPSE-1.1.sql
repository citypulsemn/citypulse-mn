-- ============================================================
-- CITY PULSE MN - roadmap 1.1: multi-day collapse + duplicate merge
-- Generated 2026-07-16 from the export you pasted.
-- STEP 0 and STEP 1 are separate pastes. Run STEP 0 first.
-- ============================================================

-- STEP 0 - PRE-FLIGHT (run alone). Lists any id below that does NOT exist
-- in your events table (e.g. a transcription slip). EXPECT ZERO ROWS.
-- If any id appears, tell me which - the transaction is still safe to run;
-- a missing id simply won't match, and the count check will show it.
select x.id as missing_from_events
from (values
  ('caff0b53-d3ee-4025-ab4a-abee1097e482'),
  ('90b64201-23e1-453b-985a-8fad8b72ab25'),
  ('74e75c1b-a7f4-4fff-9852-1c091ee697f8'),
  ('9864eb14-e5c0-466c-99c6-9eabbf5f28ae'),
  ('a0036ddf-8acc-46de-8685-93d57599467f'),
  ('90b5b88d-25d2-4376-be23-8833013a0ec8'),
  ('1378c773-8839-4b18-9cfd-46d66ff08966'),
  ('3379a542-bfc1-4807-b79a-cb541c4e19c4'),
  ('a63880b9-f0ae-4e4d-a731-150a39009aa2'),
  ('f085eada-bb24-410a-a88a-6892a0b9aff4'),
  ('26124c75-f722-42c4-9de8-2e0bff57974f'),
  ('51301ea2-abb4-432c-a00c-7846ec26aa16'),
  ('312ee15e-9362-4939-96f3-37d26709b299'),
  ('416e242b-c1e7-4f71-a54c-8474626f65ae'),
  ('e50514ea-f703-4f5b-945e-5fea25171cd2'),
  ('3f8707d2-66d3-4ca3-a2fd-c0fe22968ca6'),
  ('07b21c6d-847b-441c-9140-ef26cdf95ac9'),
  ('9d7120da-89c1-4cc0-bc07-21d57caa27a3'),
  ('1f4549f0-575f-427e-8525-3587b82422e9'),
  ('916b05d6-0a04-454a-88f8-d22a680077a2'),
  ('537acf1f-2fec-4fc1-b91f-17cb0da8f149'),
  ('22da2167-c838-4551-b2f1-2a295ddb1e19'),
  ('4fb674dd-b47b-4166-b1ff-04e74db468d3'),
  ('6dd0a81f-ff7f-4c90-ba97-2eb5d9178518'),
  ('5d5bf5da-d8ec-4c45-86b4-fa4d32c9c6dd'),
  ('2b5e7bc0-4b58-417d-9ae6-6d568c9a2f52'),
  ('cd44ba23-68fe-4c89-8661-3bf6076f31b6'),
  ('e29534d0-e986-4e4a-be63-a6cb308ad11e'),
  ('fdd521d4-822c-4ded-b96e-1879dd5bb4b9'),
  ('56c69366-01b1-415b-a586-b3725e8c1a17'),
  ('ed84f5e8-411e-474b-b8e8-68521183bc64'),
  ('50ee5258-335e-4c60-933f-9434d3c850de'),
  ('29dc28a5-1123-4364-975d-4b2d8e34d49c'),
  ('4837dc56-7abe-441d-99fc-aba5e41ce9b4'),
  ('e78cd3db-5fcd-4416-8977-02024636cbd9'),
  ('827ede61-e30d-40e4-87c9-e34f47b07c88'),
  ('3550621e-29fb-4c3c-a8de-dcd8dd9cbef9'),
  ('9d6700f5-ff6e-4a93-be4f-3107222bfbc8'),
  ('59c9c8ec-57d9-473f-9f53-d1b4e70a66d1'),
  ('ecef318a-1f1e-40cf-a043-e4c277a43898'),
  ('c7f2d163-28b2-4612-b0ad-55900905fcc0'),
  ('48c1035f-2d10-40e4-a6f1-d88aebf45c56'),
  ('a971dc5e-ed09-42a9-9af5-408bf91a3b45'),
  ('f31e18bd-2278-493e-ba43-bfb3efc52fa6'),
  ('3fbff40b-4fbb-4e1d-bde6-3dbc15e9de00'),
  ('88cc1903-b2fe-4f3b-babc-8f09a6f2358b'),
  ('c472f444-1f4a-455d-abc6-bbe18c55e6b5'),
  ('b80e926b-3647-49d0-aeb7-dded8e0424ed'),
  ('86f8702e-dd3f-49f9-9caf-c1eed805aae2'),
  ('b5bca185-41bd-4b4e-8d02-0c9eb8d23a83'),
  ('58e53e40-a766-4359-b9e3-50d1027fe88b'),
  ('5a4d6c6c-34fa-4ade-8165-cc410aae9eb6'),
  ('8f96d231-6458-4237-a2d1-f212f6dc7d68'),
  ('39eb2899-8aba-44bb-8b63-8f71120bef3c'),
  ('d1b5f7f0-37e9-4cef-b1a9-9eb64d1e6de4'),
  ('06ad2ffa-1d85-4c05-a9af-30ac6db3f336'),
  ('2a551476-985a-4848-975e-854cee3d6a99'),
  ('af40ded7-5086-4c29-8cb2-9f65ab57d5d0'),
  ('b47de206-de41-449a-b9b1-726a85eed75e'),
  ('16179e6b-9b18-4ede-a57d-1e722b432a06'),
  ('395beb35-170d-4d02-a55e-d1cc61ccec99'),
  ('265514bb-800a-48b0-968b-9b0263ae77d0'),
  ('e6ab9ce2-576a-42fe-a19f-3ced836e3eaa'),
  ('3308f3f1-67cb-4f76-9fce-29b461710674'),
  ('785657c7-b314-4978-bbad-3ef5b5da8ca8'),
  ('877024e6-a656-4c3c-a0ac-10efd8f21932'),
  ('96be843f-411f-4d65-89a1-03f265f1bc3d'),
  ('66f209b8-4cf6-4ae4-b4a7-661b79493771'),
  ('e23c01bf-7a86-478e-a20c-74b4942ae6f0'),
  ('5c31f268-12a1-4cab-9394-634c1e96adcc'),
  ('29741ee3-d84f-49e9-a25b-336ec427cf37'),
  ('fa1950a7-028e-4cbe-9044-7d01b71fa7df'),
  ('cc21f064-3a43-4986-aadb-3d360f59441b'),
  ('581a281c-d526-4039-927c-06df074e3973'),
  ('7d6d19a3-e50b-42d4-b4bc-c8278982fcac'),
  ('fe43b39a-dc61-4440-81ee-fe691ae33d6f'),
  ('d9acbb1d-709e-46b8-af00-1c78f3629005'),
  ('6d439aba-375f-4086-9a8d-f3c71bb094ad'),
  ('7880da99-db44-493e-b48e-51de08dd4642'),
  ('0cc6d2be-2b98-4444-b3ac-2e6f0fe68d27'),
  ('2d483948-8f54-43c5-9d7e-7e32eda25509'),
  ('fc96586b-d863-43f3-b78e-f837727fc28e'),
  ('8367ca6f-19e7-45a8-ac2a-d9b37dd444e9'),
  ('0d2a235f-75ef-4b8e-b888-2e4c4d7161b4'),
  ('79b04ad4-dba0-451c-93eb-7a8b373cf5f5'),
  ('37a67ed9-71d9-4448-899e-726f2e100524'),
  ('79c03769-a979-4b7e-940c-4c363f661f65'),
  ('e50e28bf-d183-4703-a34c-ed87a60bed22'),
  ('9bc32ab9-2c99-4315-86b6-c761b755ba71'),
  ('f7bad414-4fa1-47d9-ade9-4a1dbcc1efce'),
  ('386e51eb-f155-419d-8ed3-97baa2899dc7'),
  ('4d4cc60b-0488-4627-ac1e-37e2465882a6'),
  ('4fa8a9f0-0c43-4f0e-a905-afead9e52f12'),
  ('cb3c0f0a-3bb1-4a8d-87b9-9ebcc3491468'),
  ('c611a93f-1f9a-4305-8bc3-d9cbe92583ff'),
  ('99f00e39-5b8c-4520-96e1-8320fa1443d6'),
  ('2b3648be-090f-43c5-aff5-7aa9087925fa'),
  ('1ac5403d-5e80-4cb0-b521-d409e79ddb8e'),
  ('5d851d03-3652-44f5-95f1-019f5e7cd902'),
  ('eada41a8-d147-456f-be8b-786929b1461e'),
  ('7045f549-295a-4eeb-9b11-12b647d46e16'),
  ('f3afbf99-d801-45de-bd47-5799676894c1'),
  ('1ecd82e0-785b-4957-a3c3-04e9fcd9c93e'),
  ('79ed6271-0af9-42f9-bf38-bdf910a76de8'),
  ('c3451c1d-2315-4516-9264-3222a9ece9a0'),
  ('166bce24-c7e6-4572-9460-bc3f79ad9816'),
  ('63ad39bc-ea93-4277-94e7-037a05fa4f98'),
  ('05955fa5-874c-4f26-8106-1114d72dd27c'),
  ('5e5b3572-8d3a-483a-b7fd-a9fd44be9318'),
  ('6e980724-f44e-45f0-99f6-1293e1bc744b'),
  ('e4ea1de8-fc6f-4da3-b2be-33144fbc76fb'),
  ('a121eb75-fe12-4257-b761-e652eb2ac9de'),
  ('87b3b8fa-f379-4617-b828-1b23f51150e0'),
  ('e9668857-00e9-42b8-a13b-0e0f99620579'),
  ('da40a8d9-ad0c-4d61-8cb3-24931401f8ea'),
  ('75e0dd97-5a6e-4c32-b0a3-567446347757'),
  ('4d65b4c5-8e0c-4dc0-8141-d43034317e6d'),
  ('45f3a562-a958-4524-997f-c7f8276dcb68'),
  ('1963f428-9340-4439-b214-f1794f9e2f93'),
  ('7984d75b-ef20-4678-8546-1cf8b5232643'),
  ('dff9be38-dbc3-425a-9592-495bc7e14ac4'),
  ('f23dd515-402d-47ad-a78d-c8fdd7e992a9'),
  ('d920bd08-be42-45a0-bf19-50627b1514b1'),
  ('e17c709a-f910-4a2b-8de6-9fe8406c53e1'),
  ('22b3d625-e319-4bbd-ac61-093dcb5232fc'),
  ('01f29e87-ce70-44f5-809d-4c84612b1e90'),
  ('19409bbb-9fcd-4b04-bf58-723c177e2951'),
  ('b000ee08-2780-44f1-9e43-2471daf11b8a'),
  ('e8a74c3c-37d7-4b2d-98ea-e4a1d48f71e8'),
  ('44a7bbe9-b023-47bd-8d64-a53a64875be6'),
  ('fed5cfcc-3762-4516-8967-478069756981'),
  ('ad0c1ab5-6e91-4709-b7b7-47646497d45a'),
  ('1491a285-42ba-430c-bc6f-43bc811945b5'),
  ('760cf91b-e5c1-4b89-bae2-130c8083bb21'),
  ('bd265531-ae73-4783-aa44-1d8064b4066c'),
  ('d283482c-93e5-4f7b-bc71-f69c0a3f83b0'),
  ('887d4bf1-4630-40eb-bd1f-95298fd5ed60'),
  ('9f5060dd-bc0a-441c-9994-19f27357d9e5'),
  ('2626989a-ef44-4abb-af47-d16b2e4f2e9e'),
  ('0cec69c3-fe94-4394-a45d-01669b310a2c'),
  ('1122635c-ee3c-485f-8798-db15099b2ac5'),
  ('481ce33e-128a-4cb5-a3b2-52bf96271c7d'),
  ('8405127d-f65a-4aec-9ec2-85e65c73a03a'),
  ('65b91ad0-2f05-49f9-9e98-34daa7e4a1cb'),
  ('100888ca-ede1-4070-9788-31ad7df7b36d'),
  ('10a13ff6-7f3e-4e1e-994d-7d7cef7eeb5e'),
  ('af0a314a-636a-4637-b2ca-deb98a9ef9f4'),
  ('81931dc7-0fbc-4dad-a861-9c401ea4c473'),
  ('390ad76c-1faf-4374-84c8-23ac157cc158'),
  ('4d92555d-f6fb-48c9-a742-b2b0e4678f84'),
  ('9668dfda-74cd-43b8-a64c-3cbdf0dcf706'),
  ('15a096fb-b04b-4d6d-bc20-f8365dffefe4'),
  ('2abc195f-7e2e-4cbc-9a34-2e522385f52f'),
  ('09688193-6d06-4a8d-a979-5e74dfd0432f'),
  ('91cf6a73-356d-47d4-963d-cf80379940fc'),
  ('08d0f2fd-e8db-465e-b002-30b0b9e3e1b2'),
  ('2a852ab5-dd1e-4417-83ef-f74502b1da75'),
  ('cf29069c-10b8-42b4-9cd4-4ca5e4ca94f9'),
  ('66038fbe-bcad-448b-965d-eb4e19db9920')
) as x(id)
where not exists (select 1 from events e where e.id = x.id::uuid);

-- ============================================================
-- STEP 1 - THE COLLAPSE (one paste, one transaction)
-- ============================================================
begin;

-- Safety net: full before-state of every touched row. Rollback restores from here.
create table if not exists collapse_backup_20260716 as
select e.id, e.status, e.start_at, e.multi_day_end
from events e
join (values
  ('caff0b53-d3ee-4025-ab4a-abee1097e482'),
  ('90b64201-23e1-453b-985a-8fad8b72ab25'),
  ('74e75c1b-a7f4-4fff-9852-1c091ee697f8'),
  ('9864eb14-e5c0-466c-99c6-9eabbf5f28ae'),
  ('a0036ddf-8acc-46de-8685-93d57599467f'),
  ('90b5b88d-25d2-4376-be23-8833013a0ec8'),
  ('1378c773-8839-4b18-9cfd-46d66ff08966'),
  ('3379a542-bfc1-4807-b79a-cb541c4e19c4'),
  ('a63880b9-f0ae-4e4d-a731-150a39009aa2'),
  ('f085eada-bb24-410a-a88a-6892a0b9aff4'),
  ('26124c75-f722-42c4-9de8-2e0bff57974f'),
  ('51301ea2-abb4-432c-a00c-7846ec26aa16'),
  ('312ee15e-9362-4939-96f3-37d26709b299'),
  ('416e242b-c1e7-4f71-a54c-8474626f65ae'),
  ('e50514ea-f703-4f5b-945e-5fea25171cd2'),
  ('3f8707d2-66d3-4ca3-a2fd-c0fe22968ca6'),
  ('07b21c6d-847b-441c-9140-ef26cdf95ac9'),
  ('9d7120da-89c1-4cc0-bc07-21d57caa27a3'),
  ('1f4549f0-575f-427e-8525-3587b82422e9'),
  ('916b05d6-0a04-454a-88f8-d22a680077a2'),
  ('537acf1f-2fec-4fc1-b91f-17cb0da8f149'),
  ('22da2167-c838-4551-b2f1-2a295ddb1e19'),
  ('4fb674dd-b47b-4166-b1ff-04e74db468d3'),
  ('6dd0a81f-ff7f-4c90-ba97-2eb5d9178518'),
  ('5d5bf5da-d8ec-4c45-86b4-fa4d32c9c6dd'),
  ('2b5e7bc0-4b58-417d-9ae6-6d568c9a2f52'),
  ('cd44ba23-68fe-4c89-8661-3bf6076f31b6'),
  ('e29534d0-e986-4e4a-be63-a6cb308ad11e'),
  ('fdd521d4-822c-4ded-b96e-1879dd5bb4b9'),
  ('56c69366-01b1-415b-a586-b3725e8c1a17'),
  ('ed84f5e8-411e-474b-b8e8-68521183bc64'),
  ('50ee5258-335e-4c60-933f-9434d3c850de'),
  ('29dc28a5-1123-4364-975d-4b2d8e34d49c'),
  ('4837dc56-7abe-441d-99fc-aba5e41ce9b4'),
  ('e78cd3db-5fcd-4416-8977-02024636cbd9'),
  ('827ede61-e30d-40e4-87c9-e34f47b07c88'),
  ('3550621e-29fb-4c3c-a8de-dcd8dd9cbef9'),
  ('9d6700f5-ff6e-4a93-be4f-3107222bfbc8'),
  ('59c9c8ec-57d9-473f-9f53-d1b4e70a66d1'),
  ('ecef318a-1f1e-40cf-a043-e4c277a43898'),
  ('c7f2d163-28b2-4612-b0ad-55900905fcc0'),
  ('48c1035f-2d10-40e4-a6f1-d88aebf45c56'),
  ('a971dc5e-ed09-42a9-9af5-408bf91a3b45'),
  ('f31e18bd-2278-493e-ba43-bfb3efc52fa6'),
  ('3fbff40b-4fbb-4e1d-bde6-3dbc15e9de00'),
  ('88cc1903-b2fe-4f3b-babc-8f09a6f2358b'),
  ('c472f444-1f4a-455d-abc6-bbe18c55e6b5'),
  ('b80e926b-3647-49d0-aeb7-dded8e0424ed'),
  ('86f8702e-dd3f-49f9-9caf-c1eed805aae2'),
  ('b5bca185-41bd-4b4e-8d02-0c9eb8d23a83'),
  ('58e53e40-a766-4359-b9e3-50d1027fe88b'),
  ('5a4d6c6c-34fa-4ade-8165-cc410aae9eb6'),
  ('8f96d231-6458-4237-a2d1-f212f6dc7d68'),
  ('39eb2899-8aba-44bb-8b63-8f71120bef3c'),
  ('d1b5f7f0-37e9-4cef-b1a9-9eb64d1e6de4'),
  ('06ad2ffa-1d85-4c05-a9af-30ac6db3f336'),
  ('2a551476-985a-4848-975e-854cee3d6a99'),
  ('af40ded7-5086-4c29-8cb2-9f65ab57d5d0'),
  ('b47de206-de41-449a-b9b1-726a85eed75e'),
  ('16179e6b-9b18-4ede-a57d-1e722b432a06'),
  ('395beb35-170d-4d02-a55e-d1cc61ccec99'),
  ('265514bb-800a-48b0-968b-9b0263ae77d0'),
  ('e6ab9ce2-576a-42fe-a19f-3ced836e3eaa'),
  ('3308f3f1-67cb-4f76-9fce-29b461710674'),
  ('785657c7-b314-4978-bbad-3ef5b5da8ca8'),
  ('877024e6-a656-4c3c-a0ac-10efd8f21932'),
  ('96be843f-411f-4d65-89a1-03f265f1bc3d'),
  ('66f209b8-4cf6-4ae4-b4a7-661b79493771'),
  ('e23c01bf-7a86-478e-a20c-74b4942ae6f0'),
  ('5c31f268-12a1-4cab-9394-634c1e96adcc'),
  ('29741ee3-d84f-49e9-a25b-336ec427cf37'),
  ('fa1950a7-028e-4cbe-9044-7d01b71fa7df'),
  ('cc21f064-3a43-4986-aadb-3d360f59441b'),
  ('581a281c-d526-4039-927c-06df074e3973'),
  ('7d6d19a3-e50b-42d4-b4bc-c8278982fcac'),
  ('fe43b39a-dc61-4440-81ee-fe691ae33d6f'),
  ('d9acbb1d-709e-46b8-af00-1c78f3629005'),
  ('6d439aba-375f-4086-9a8d-f3c71bb094ad'),
  ('7880da99-db44-493e-b48e-51de08dd4642'),
  ('0cc6d2be-2b98-4444-b3ac-2e6f0fe68d27'),
  ('2d483948-8f54-43c5-9d7e-7e32eda25509'),
  ('fc96586b-d863-43f3-b78e-f837727fc28e'),
  ('8367ca6f-19e7-45a8-ac2a-d9b37dd444e9'),
  ('0d2a235f-75ef-4b8e-b888-2e4c4d7161b4'),
  ('79b04ad4-dba0-451c-93eb-7a8b373cf5f5'),
  ('37a67ed9-71d9-4448-899e-726f2e100524'),
  ('79c03769-a979-4b7e-940c-4c363f661f65'),
  ('e50e28bf-d183-4703-a34c-ed87a60bed22'),
  ('9bc32ab9-2c99-4315-86b6-c761b755ba71'),
  ('f7bad414-4fa1-47d9-ade9-4a1dbcc1efce'),
  ('386e51eb-f155-419d-8ed3-97baa2899dc7'),
  ('4d4cc60b-0488-4627-ac1e-37e2465882a6'),
  ('4fa8a9f0-0c43-4f0e-a905-afead9e52f12'),
  ('cb3c0f0a-3bb1-4a8d-87b9-9ebcc3491468'),
  ('c611a93f-1f9a-4305-8bc3-d9cbe92583ff'),
  ('99f00e39-5b8c-4520-96e1-8320fa1443d6'),
  ('2b3648be-090f-43c5-aff5-7aa9087925fa'),
  ('1ac5403d-5e80-4cb0-b521-d409e79ddb8e'),
  ('5d851d03-3652-44f5-95f1-019f5e7cd902'),
  ('eada41a8-d147-456f-be8b-786929b1461e'),
  ('7045f549-295a-4eeb-9b11-12b647d46e16'),
  ('f3afbf99-d801-45de-bd47-5799676894c1'),
  ('1ecd82e0-785b-4957-a3c3-04e9fcd9c93e'),
  ('79ed6271-0af9-42f9-bf38-bdf910a76de8'),
  ('c3451c1d-2315-4516-9264-3222a9ece9a0'),
  ('166bce24-c7e6-4572-9460-bc3f79ad9816'),
  ('63ad39bc-ea93-4277-94e7-037a05fa4f98'),
  ('05955fa5-874c-4f26-8106-1114d72dd27c'),
  ('5e5b3572-8d3a-483a-b7fd-a9fd44be9318'),
  ('6e980724-f44e-45f0-99f6-1293e1bc744b'),
  ('e4ea1de8-fc6f-4da3-b2be-33144fbc76fb'),
  ('a121eb75-fe12-4257-b761-e652eb2ac9de'),
  ('87b3b8fa-f379-4617-b828-1b23f51150e0'),
  ('e9668857-00e9-42b8-a13b-0e0f99620579'),
  ('da40a8d9-ad0c-4d61-8cb3-24931401f8ea'),
  ('75e0dd97-5a6e-4c32-b0a3-567446347757'),
  ('4d65b4c5-8e0c-4dc0-8141-d43034317e6d'),
  ('45f3a562-a958-4524-997f-c7f8276dcb68'),
  ('1963f428-9340-4439-b214-f1794f9e2f93'),
  ('7984d75b-ef20-4678-8546-1cf8b5232643'),
  ('dff9be38-dbc3-425a-9592-495bc7e14ac4'),
  ('f23dd515-402d-47ad-a78d-c8fdd7e992a9'),
  ('d920bd08-be42-45a0-bf19-50627b1514b1'),
  ('e17c709a-f910-4a2b-8de6-9fe8406c53e1'),
  ('22b3d625-e319-4bbd-ac61-093dcb5232fc'),
  ('01f29e87-ce70-44f5-809d-4c84612b1e90'),
  ('19409bbb-9fcd-4b04-bf58-723c177e2951'),
  ('b000ee08-2780-44f1-9e43-2471daf11b8a'),
  ('e8a74c3c-37d7-4b2d-98ea-e4a1d48f71e8'),
  ('44a7bbe9-b023-47bd-8d64-a53a64875be6'),
  ('fed5cfcc-3762-4516-8967-478069756981'),
  ('ad0c1ab5-6e91-4709-b7b7-47646497d45a'),
  ('1491a285-42ba-430c-bc6f-43bc811945b5'),
  ('760cf91b-e5c1-4b89-bae2-130c8083bb21'),
  ('bd265531-ae73-4783-aa44-1d8064b4066c'),
  ('d283482c-93e5-4f7b-bc71-f69c0a3f83b0'),
  ('887d4bf1-4630-40eb-bd1f-95298fd5ed60'),
  ('9f5060dd-bc0a-441c-9994-19f27357d9e5'),
  ('2626989a-ef44-4abb-af47-d16b2e4f2e9e'),
  ('0cec69c3-fe94-4394-a45d-01669b310a2c'),
  ('1122635c-ee3c-485f-8798-db15099b2ac5'),
  ('481ce33e-128a-4cb5-a3b2-52bf96271c7d'),
  ('8405127d-f65a-4aec-9ec2-85e65c73a03a'),
  ('65b91ad0-2f05-49f9-9e98-34daa7e4a1cb'),
  ('100888ca-ede1-4070-9788-31ad7df7b36d'),
  ('10a13ff6-7f3e-4e1e-994d-7d7cef7eeb5e'),
  ('af0a314a-636a-4637-b2ca-deb98a9ef9f4'),
  ('81931dc7-0fbc-4dad-a861-9c401ea4c473'),
  ('390ad76c-1faf-4374-84c8-23ac157cc158'),
  ('4d92555d-f6fb-48c9-a742-b2b0e4678f84'),
  ('9668dfda-74cd-43b8-a64c-3cbdf0dcf706'),
  ('15a096fb-b04b-4d6d-bc20-f8365dffefe4'),
  ('2abc195f-7e2e-4cbc-9a34-2e522385f52f'),
  ('09688193-6d06-4a8d-a979-5e74dfd0432f'),
  ('91cf6a73-356d-47d4-963d-cf80379940fc'),
  ('08d0f2fd-e8db-465e-b002-30b0b9e3e1b2'),
  ('2a852ab5-dd1e-4417-83ef-f74502b1da75'),
  ('cf29069c-10b8-42b4-9cd4-4ca5e4ca94f9'),
  ('66038fbe-bcad-448b-965d-eb4e19db9920'),
  ('5749202f-a4e9-47c6-bfff-d37b2331fdb3'),
  ('571ee003-ecc2-4ba4-8387-844a6c02631e'),
  ('7edeb04c-b1ea-4a19-8c53-675c9f5cb313'),
  ('4b45e3d7-8dab-4d1f-9236-6005ea1592ee'),
  ('5d0b751f-6b88-4a82-a4c1-841f23b0f5d1'),
  ('e5f99057-eacf-4e30-a45d-87296299f0fc'),
  ('b2d65376-f5c6-4314-8306-6ad33cba5b8b'),
  ('816fb73d-816e-4d65-9e3b-cd62ccfa15d5'),
  ('59a48ec7-4862-4002-8849-c409b68ec50a'),
  ('02f29a02-cfb2-4f56-bc94-24be98cdeaf9'),
  ('fd1c73d9-5012-4362-8d5f-a8d68260dfdf'),
  ('2908b344-dc03-4a6a-8b79-83de577766e5'),
  ('f8a0bb7c-bc74-4374-8552-7db273a501d9'),
  ('a931228c-2f31-46fa-8c56-af701c5488c9'),
  ('cf564667-1f0f-4dd7-830e-12cb28af0ca6'),
  ('05d799ca-354e-4033-9bcc-585307c11486'),
  ('4c0bc132-d62e-40ad-94f8-075b11d630f2'),
  ('6d48266c-a587-4147-a493-989aec4747d0'),
  ('78b242b9-9310-4d24-bb59-499ffd96d813'),
  ('5476dd4a-de9d-4236-9371-95e08a84dd50'),
  ('52299417-5440-4e6b-a847-1d62becfade7'),
  ('f0440a99-c4c0-4d40-aca3-fcbded0613d2'),
  ('4af5fc54-aa1a-4a51-b2b2-813c7b1cca7f'),
  ('e786b074-8732-4dbb-a5e1-025a05fd1e3f'),
  ('493c5631-f646-4c80-89ae-4251b6cba8bb'),
  ('17a0d839-4acb-424a-baa5-a41d9b13f487'),
  ('b2c1d108-ea6d-4717-be2b-7a575fb70af2'),
  ('13168fb8-daa2-4cad-9e67-8a8ab79649d7'),
  ('1001836d-2a26-407b-b147-099bd6ed2074'),
  ('d5a79632-aff7-4609-ba58-02928c4afb48'),
  ('bbb708ad-2e45-431e-9e0e-cdf6b267de9c'),
  ('c4b1286a-9245-452f-acc1-c9c7c9d1a99c'),
  ('03bf6f42-1e1e-4e6b-9439-21c14f25daec'),
  ('68077e2c-f436-48e0-8a36-d20a05f0c194'),
  ('046666a2-69b5-41a1-8601-12e0e9f69784'),
  ('720efde5-ae71-4da2-9503-5d7da2faeb6b'),
  ('7f6cb815-db24-42ae-8f5e-9c412cdb5d01'),
  ('3a71110c-571e-43dd-b9e1-2348d37e7762'),
  ('d81c8cd8-d450-40c4-91e6-9a124e2daca3'),
  ('dc81f4c0-339b-4a25-97c8-794e00d1506c'),
  ('11d9f92b-3133-4b2d-9894-523a8ce70f93'),
  ('a4cb52a0-9d63-4dee-80c5-f009b6f770e9'),
  ('493cd120-8b3c-4569-9f6a-d78bf367f287'),
  ('ac6cce82-3731-4f9c-998f-c14dc7684a72'),
  ('fc3792c9-e409-449b-9a9f-a3acfc93266e'),
  ('9200f038-a04a-4b5e-bdec-2c600023a2d9'),
  ('cf2bb5c7-8e77-417a-86ba-4a014bf79bed'),
  ('e840a342-84dc-4f17-8a29-b15ebd777e02'),
  ('b9e18fa4-8de2-4750-8689-deb3b280c4e5'),
  ('a82691fb-2a29-49ed-be20-84aaf1235e1f'),
  ('fe75f37d-4669-4321-9903-6440084db3d7'),
  ('58b09b14-3b49-470b-a5e1-544011c8ac92'),
  ('8a92e863-24d7-4f29-80f8-1eaba5dc91ec'),
  ('f609d60d-a2bb-41d2-8cb5-3ed682896090'),
  ('d72d48f8-b289-449b-a72f-8c9af2c2e6c6'),
  ('dfc6f990-d25b-47ec-975e-4f5585b92873'),
  ('b7478075-6435-4905-8f73-b3ed64a8361d'),
  ('52417dd3-b57e-46f0-9f9f-46b0cb8407b8'),
  ('4211b19e-8ab1-42df-abc5-a38b28579174'),
  ('4a942ad4-5d92-4e4e-8bd3-5d1374502200'),
  ('cfd499a6-24ea-4d6a-b23b-e44b02875254'),
  ('93f6fa36-a59f-4235-9842-a46b72e02204'),
  ('166f86e2-08c3-4f92-bba2-2f9dffcf634e'),
  ('da3c8410-1694-4412-b736-34e125b082c5'),
  ('596d91f6-166a-4b2d-b7b2-1d8813fc7696'),
  ('c0093539-b3e7-4708-9e59-f747d358c31b'),
  ('a9425f68-9be9-4b43-81a8-9fcc051c568b'),
  ('b65f44b5-1951-4a45-b7d1-229cab879452'),
  ('73986fbe-1f44-4923-b58e-6569b6bb1ae2'),
  ('f8988be7-04f9-482e-8c19-0d21a6aa20a4'),
  ('146e1791-5591-43de-9749-07cc6a20d25f'),
  ('a95e133e-ccbd-40fb-aca6-427d5813387b'),
  ('22e9c677-5365-4321-bf4a-6f9f2f2639ff'),
  ('4b2bf40a-e95a-43f6-a65c-18ac3c51daa6'),
  ('8962024f-6938-4e35-b762-60be18082f25'),
  ('2c98d327-6487-40aa-a46a-699daf465691'),
  ('f7633faa-d99b-4d58-bd21-0345a7b3dbbc'),
  ('477663e6-ac53-4346-b802-0573c0f3a10b'),
  ('27a98aa6-0d1d-459f-989a-a855104fe15f'),
  ('8ab24b25-82b8-46c8-99f8-20e37ad21d59'),
  ('0e714e6d-a14b-4622-9bcb-afdfeab22daa'),
  ('237f3290-1c9c-4508-b02d-bd8e987e3a21'),
  ('7f2f7026-7e4e-428b-bd33-c2424e6d2b01'),
  ('b95c2553-aeb2-4381-82ba-e3c25833fac0'),
  ('c4fcb2c8-75d1-4986-a505-1303f1a66a55'),
  ('728fff20-958a-4584-9836-10e86682b5c5'),
  ('360d4ba4-1a7e-4d00-8558-0f1108cd9b65'),
  ('0a674de9-8255-4607-97ce-e64d325c2da9'),
  ('4cb673af-7008-42bf-9675-d29215c9a145'),
  ('c760468f-0234-4644-883d-0b3014d979b9'),
  ('5596cc0f-9f23-47aa-a3e4-cedb8f447f8f'),
  ('ee0db639-6d55-43dd-ade0-574de0f5c614'),
  ('f38a913f-6c46-4a14-80c4-cd973e865085'),
  ('cd88622a-7fc7-4571-9f4e-42eff1c744cc'),
  ('cfd6ce5a-c678-460a-bfed-c6871755d7b1')
) as t(id) on e.id = t.id::uuid;

-- Minnesota State Fair -> one card, Aug 27-Sep 7 (Labor Day close)
update events set status = 'archived' where id in ('caff0b53-d3ee-4025-ab4a-abee1097e482', '90b64201-23e1-453b-985a-8fad8b72ab25', '74e75c1b-a7f4-4fff-9852-1c091ee697f8', '9864eb14-e5c0-466c-99c6-9eabbf5f28ae', 'a0036ddf-8acc-46de-8685-93d57599467f');
update events set multi_day_end = ('2026-09-07T21:00'::timestamp at time zone 'America/Chicago') where id = '360d4ba4-1a7e-4d00-8558-0f1108cd9b65';

-- Minnesota Renaissance Festival -> one card, weekends Aug 22-Oct 4 (19 rows!)
update events set status = 'archived' where id in ('90b5b88d-25d2-4376-be23-8833013a0ec8', '1378c773-8839-4b18-9cfd-46d66ff08966', '3379a542-bfc1-4807-b79a-cb541c4e19c4', 'a63880b9-f0ae-4e4d-a731-150a39009aa2', 'f085eada-bb24-410a-a88a-6892a0b9aff4', '26124c75-f722-42c4-9de8-2e0bff57974f', '51301ea2-abb4-432c-a00c-7846ec26aa16', '312ee15e-9362-4939-96f3-37d26709b299', '416e242b-c1e7-4f71-a54c-8474626f65ae', 'e50514ea-f703-4f5b-945e-5fea25171cd2', '3f8707d2-66d3-4ca3-a2fd-c0fe22968ca6', '07b21c6d-847b-441c-9140-ef26cdf95ac9', '9d7120da-89c1-4cc0-bc07-21d57caa27a3', '1f4549f0-575f-427e-8525-3587b82422e9', '916b05d6-0a04-454a-88f8-d22a680077a2', '537acf1f-2fec-4fc1-b91f-17cb0da8f149', '22da2167-c838-4551-b2f1-2a295ddb1e19', '4fb674dd-b47b-4166-b1ff-04e74db468d3');
update events set start_at = ('2026-08-22T09:00'::timestamp at time zone 'America/Chicago'), multi_day_end = ('2026-10-04T19:00'::timestamp at time zone 'America/Chicago') where id = '571ee003-ecc2-4ba4-8387-844a6c02631e';

-- Sever's Fall Festival -> one card, weekends Sep 4-Oct 4 (15 rows)
update events set status = 'archived' where id in ('6dd0a81f-ff7f-4c90-ba97-2eb5d9178518', '5d5bf5da-d8ec-4c45-86b4-fa4d32c9c6dd', '2b5e7bc0-4b58-417d-9ae6-6d568c9a2f52', 'cd44ba23-68fe-4c89-8661-3bf6076f31b6', 'e29534d0-e986-4e4a-be63-a6cb308ad11e', 'fdd521d4-822c-4ded-b96e-1879dd5bb4b9', '56c69366-01b1-415b-a586-b3725e8c1a17', 'ed84f5e8-411e-474b-b8e8-68521183bc64', '50ee5258-335e-4c60-933f-9434d3c850de', '29dc28a5-1123-4364-975d-4b2d8e34d49c', '4837dc56-7abe-441d-99fc-aba5e41ce9b4', 'e78cd3db-5fcd-4416-8977-02024636cbd9', '827ede61-e30d-40e4-87c9-e34f47b07c88', '3550621e-29fb-4c3c-a8de-dcd8dd9cbef9');
update events set start_at = ('2026-09-04T10:00'::timestamp at time zone 'America/Chicago'), multi_day_end = ('2026-10-04T18:00'::timestamp at time zone 'America/Chicago') where id = '4b45e3d7-8dab-4d1f-9236-6005ea1592ee';

-- Can Can Wonderland ongoing-attraction rows -> one (distinct dated shows kept)
-- NOTE: 9d6700f5 is category=sports but is the mini-golf attraction, not a game — exempt from the sports rule by inspection.
update events set status = 'archived' where id in ('9d6700f5-ff6e-4a93-be4f-3107222bfbc8', '59c9c8ec-57d9-473f-9f53-d1b4e70a66d1', 'ecef318a-1f1e-40cf-a043-e4c277a43898', 'c7f2d163-28b2-4612-b0ad-55900905fcc0', '48c1035f-2d10-40e4-a6f1-d88aebf45c56', 'a971dc5e-ed09-42a9-9af5-408bf91a3b45', 'f31e18bd-2278-493e-ba43-bfb3efc52fa6', '3fbff40b-4fbb-4e1d-bde6-3dbc15e9de00', '88cc1903-b2fe-4f3b-babc-8f09a6f2358b', 'c472f444-1f4a-455d-abc6-bbe18c55e6b5', 'b80e926b-3647-49d0-aeb7-dded8e0424ed');
update events set multi_day_end = ('2026-09-27T21:00'::timestamp at time zone 'America/Chicago') where id = '52299417-5440-4e6b-a847-1d62becfade7';

-- Skyline Mini Golf ongoing rows -> one
update events set status = 'archived' where id in ('86f8702e-dd3f-49f9-9caf-c1eed805aae2', 'b5bca185-41bd-4b4e-8d02-0c9eb8d23a83', '58e53e40-a766-4359-b9e3-50d1027fe88b');
update events set multi_day_end = ('2026-08-30T20:00'::timestamp at time zone 'America/Chicago') where id = '0a674de9-8255-4607-97ce-e64d325c2da9';

-- Trail of Small Wonders -> one (end date UNKNOWN — fill from source after verify)
update events set status = 'archived' where id in ('5a4d6c6c-34fa-4ade-8165-cc410aae9eb6', '8f96d231-6458-4237-a2d1-f212f6dc7d68', '39eb2899-8aba-44bb-8b63-8f71120bef3c');
update events set start_at = ('2026-07-13T09:00'::timestamp at time zone 'America/Chicago') where id = 'd81c8cd8-d450-40c4-91e6-9a124e2daca3';

-- Minnesota Zoo general-admission rows -> one
update events set status = 'archived' where id in ('d1b5f7f0-37e9-4cef-b1a9-9eb64d1e6de4', '06ad2ffa-1d85-4c05-a9af-30ac6db3f336');

-- Como Zoo daily-visit rows -> one
update events set status = 'archived' where id in ('2a551476-985a-4848-975e-854cee3d6a99');

-- Nickelodeon Universe fall/Halloween season -> one
update events set status = 'archived' where id in ('af40ded7-5086-4c29-8cb2-9f65ab57d5d0');

-- Maple Grove Restaurant Week + its kickoff/finale sub-rows -> the week
update events set status = 'archived' where id in ('b47de206-de41-449a-b9b1-726a85eed75e', '16179e6b-9b18-4ede-a57d-1e722b432a06');
update events set multi_day_end = ('2026-08-16T21:00'::timestamp at time zone 'America/Chicago') where id = 'f0440a99-c4c0-4d40-aca3-fcbded0613d2';

-- Minnesota Fringe -> one card (Aug 6-16, standard close — confirm)
update events set status = 'archived' where id in ('395beb35-170d-4d02-a55e-d1cc61ccec99', '265514bb-800a-48b0-968b-9b0263ae77d0');
update events set multi_day_end = ('2026-08-16T22:00'::timestamp at time zone 'America/Chicago') where id = '4a942ad4-5d92-4e4e-8bd3-5d1374502200';

-- Guys and Dolls (Chanhassen run) -> one, end = last attested date
update events set status = 'archived' where id in ('e6ab9ce2-576a-42fe-a19f-3ced836e3eaa', '3308f3f1-67cb-4f76-9fce-29b461710674');
update events set multi_day_end = ('2026-08-29T18:00'::timestamp at time zone 'America/Chicago') where id = 'c760468f-0234-4644-883d-0b3014d979b9';

-- Annie (Chanhassen) -> one
update events set status = 'archived' where id in ('785657c7-b314-4978-bbad-3ef5b5da8ca8');
update events set multi_day_end = ('2026-09-05T18:00'::timestamp at time zone 'America/Chicago') where id = 'fe75f37d-4669-4321-9903-6440084db3d7';

-- Dirty Dancing (Ordway run) -> one
update events set status = 'archived' where id in ('877024e6-a656-4c3c-a0ac-10efd8f21932');
update events set multi_day_end = ('2026-08-29T19:30'::timestamp at time zone 'America/Chicago') where id = '7f6cb815-db24-42ae-8f5e-9c412cdb5d01';

-- In the Heights (Artistry run) -> one
update events set status = 'archived' where id in ('96be843f-411f-4d65-89a1-03f265f1bc3d');
update events set multi_day_end = ('2026-08-25T19:30'::timestamp at time zone 'America/Chicago') where id = 'da3c8410-1694-4412-b736-34e125b082c5';

-- Suzanne Jackson exhibition -> one (end = attested floor)
update events set status = 'archived' where id in ('66f209b8-4cf6-4ae4-b4a7-661b79493771');
update events set multi_day_end = ('2026-08-25T17:00'::timestamp at time zone 'America/Chicago') where id = '02f29a02-cfb2-4f56-bc94-24be98cdeaf9';

-- Monsters on Vacation -> one (two rows name different museums — verify venue)
update events set status = 'archived' where id in ('e23c01bf-7a86-478e-a20c-74b4942ae6f0');

-- Scream Town -> one ongoing (end = attested floor; extends to Halloween after verify)
update events set status = 'archived' where id in ('5c31f268-12a1-4cab-9394-634c1e96adcc', '29741ee3-d84f-49e9-a25b-336ec427cf37');
update events set multi_day_end = ('2026-10-03T23:00'::timestamp at time zone 'America/Chicago') where id = 'f609d60d-a2bb-41d2-8cb5-3ed682896090';

-- The Abandoned Hayride -> one ongoing
update events set status = 'archived' where id in ('fa1950a7-028e-4cbe-9044-7d01b71fa7df');
update events set multi_day_end = ('2026-10-03T23:00'::timestamp at time zone 'America/Chicago') where id = '93f6fa36-a59f-4235-9842-a46b72e02204';

-- Jack-O-Lantern Spectacular same-day pair
update events set status = 'archived' where id in ('cc21f064-3a43-4986-aadb-3d360f59441b');

-- Anoka Food Truck Fest 8/15 x3
update events set status = 'archived' where id in ('581a281c-d526-4039-927c-06df074e3973', '7d6d19a3-e50b-42d4-b4bc-c8278982fcac');

-- Art on Fire Eagan
update events set status = 'archived' where id in ('fe43b39a-dc61-4440-81ee-fe691ae33d6f');

-- Asian Street Food Night Market
update events set status = 'archived' where id in ('d9acbb1d-709e-46b8-af00-1c78f3629005');

-- Bleachers / Bleachers Forever
update events set status = 'archived' where id in ('6d439aba-375f-4086-9a8d-f3c71bb094ad');

-- Burnsville Fire Muster exact pair
update events set status = 'archived' where id in ('7880da99-db44-493e-b48e-51de08dd4642');

-- Church of St. Peter Fall Festival
update events set status = 'archived' where id in ('0cc6d2be-2b98-4444-b3ac-2e6f0fe68d27');

-- Como Fall Flower Show opening pair
update events set status = 'archived' where id in ('2d483948-8f54-43c5-9d7e-7e32eda25509');

-- Como Little Explorers Sep 10 pair
update events set status = 'archived' where id in ('fc96586b-d863-43f3-b78e-f837727fc28e');

-- Como Little Explorers Sep 17 pair
update events set status = 'archived' where id in ('8367ca6f-19e7-45a8-ac2a-d9b37dd444e9');

-- Como Little Explorers Sep 24 pair
update events set status = 'archived' where id in ('0d2a235f-75ef-4b8e-b888-2e4c4d7161b4');

-- Carousel free rides 9/24 pair
update events set status = 'archived' where id in ('79b04ad4-dba0-451c-93eb-7a8b373cf5f5');

-- Daughter Daddy pair
update events set status = 'archived' where id in ('37a67ed9-71d9-4448-899e-726f2e100524');

-- Dude Perfect pair
update events set status = 'archived' where id in ('79c03769-a979-4b7e-940c-4c363f661f65');

-- Eagan Food Truck Fest pair
update events set status = 'archived' where id in ('e50e28bf-d183-4703-a34c-ed87a60bed22');

-- Fall Food Truck Fest Rosemount x3
update events set status = 'archived' where id in ('9bc32ab9-2c99-4315-86b6-c761b755ba71', 'f7bad414-4fa1-47d9-ade9-4a1dbcc1efce');

-- Get The Led Out exact pair
update events set status = 'archived' where id in ('386e51eb-f155-419d-8ed3-97baa2899dc7');

-- India Fest / Independence Day x3
update events set status = 'archived' where id in ('4d4cc60b-0488-4627-ac1e-37e2465882a6', '4fa8a9f0-0c43-4f0e-a905-afead9e52f12');

-- Irish Fair / TC Irish Fest
update events set status = 'archived' where id in ('cb3c0f0a-3bb1-4a8d-87b9-9ebcc3491468');

-- James J. Hill Days pair
update events set status = 'archived' where id in ('c611a93f-1f9a-4305-8bc3-d9cbe92583ff');

-- Mendota Pow Wow pair
update events set status = 'archived' where id in ('99f00e39-5b8c-4520-96e1-8320fa1443d6');

-- MinnesoThai x3
update events set status = 'archived' where id in ('2b3648be-090f-43c5-aff5-7aa9087925fa', '1ac5403d-5e80-4cb0-b521-d409e79ddb8e');

-- Stiftungsfest x4
update events set status = 'archived' where id in ('5d851d03-3652-44f5-95f1-019f5e7cd902', 'eada41a8-d147-456f-be8b-786929b1461e', '7045f549-295a-4eeb-9b11-12b647d46e16');

-- Mastodon pair
update events set status = 'archived' where id in ('f3afbf99-d801-45de-bd47-5799676894c1');

-- NEXT Festival pair
update events set status = 'archived' where id in ('1ecd82e0-785b-4957-a3c3-04e9fcd9c93e');

-- New Brighton Stockyard pair
update events set status = 'archived' where id in ('79ed6271-0af9-42f9-bf38-bdf910a76de8');

-- Noise Party @ Cedar 9/1 = Yellow Swans show
update events set status = 'archived' where id in ('c3451c1d-2315-4516-9264-3222a9ece9a0');

-- Olivia Dean exact pair
update events set status = 'archived' where id in ('166bce24-c7e6-4572-9460-bc3f79ad9816');

-- Open Streets Cedarfest 8/16 pair
update events set status = 'archived' where id in ('63ad39bc-ea93-4277-94e7-037a05fa4f98');

-- Outlaw Festival pair
update events set status = 'archived' where id in ('05955fa5-874c-4f26-8106-1114d72dd27c');

-- Party on the Plaza pair
update events set status = 'archived' where id in ('5e5b3572-8d3a-483a-b7fd-a9fd44be9318');

-- PeopleFest pair
update events set status = 'archived' where id in ('6e980724-f44e-45f0-99f6-1293e1bc744b');

-- Polyphia pair
update events set status = 'archived' where id in ('e4ea1de8-fc6f-4da3-b2be-33144fbc76fb');

-- Prince Highway exact pair
update events set status = 'archived' where id in ('a121eb75-fe12-4257-b761-e652eb2ac9de');

-- Richfield Penn Fest pair
update events set status = 'archived' where id in ('87b3b8fa-f379-4617-b828-1b23f51150e0');

-- Rondo 8/1 pair
update events set status = 'archived' where id in ('e9668857-00e9-42b8-a13b-0e0f99620579');

-- Sahag Armenian x3
update events set status = 'archived' where id in ('da40a8d9-ad0c-4d61-8cb3-24931401f8ea', '75e0dd97-5a6e-4c32-b0a3-567446347757');

-- SMSC Wacipi pair
update events set status = 'archived' where id in ('4d65b4c5-8e0c-4dc0-8141-d43034317e6d');

-- Slice of Shoreview pair
update events set status = 'archived' where id in ('45f3a562-a958-4524-997f-c7f8276dcb68');

-- Social Distortion pair
update events set status = 'archived' where id in ('1963f428-9340-4439-b214-f1794f9e2f93');

-- Sunset Series: Reggae pair
update events set status = 'archived' where id in ('7984d75b-ef20-4678-8546-1cf8b5232643');

-- Sunset Series: Montvales pair
update events set status = 'archived' where id in ('dff9be38-dbc3-425a-9592-495bc7e14ac4');

-- Sunset Series: Westwind pair
update events set status = 'archived' where id in ('f23dd515-402d-47ad-a78d-c8fdd7e992a9');

-- Sunset Series: Power of 10 pair
update events set status = 'archived' where id in ('d920bd08-be42-45a0-bf19-50627b1514b1');

-- Taste of Lakeville 8/20 pair
update events set status = 'archived' where id in ('e17c709a-f910-4a2b-8de6-9fe8406c53e1');

-- Thai Sunday Market 8/30 pair
update events set status = 'archived' where id in ('22b3d625-e319-4bbd-ac61-093dcb5232fc');

-- Greek fest 9/11 x3
update events set status = 'archived' where id in ('01f29e87-ce70-44f5-809d-4c84612b1e90', '19409bbb-9fcd-4b04-bf58-723c177e2951');

-- Maron Lebanese pair
update events set status = 'archived' where id in ('b000ee08-2780-44f1-9e43-2471daf11b8a');

-- Toast exact pair
update events set status = 'archived' where id in ('e8a74c3c-37d7-4b2d-98ea-e4a1d48f71e8');

-- Tommy James Grandstand pair
update events set status = 'archived' where id in ('44a7bbe9-b023-47bd-8d64-a53a64875be6');

-- Tusk exact pair
update events set status = 'archived' where id in ('fed5cfcc-3762-4516-8967-478069756981');

-- Uptown Art Fair exact pair
update events set status = 'archived' where id in ('ad0c1ab5-6e91-4709-b7b7-47646497d45a');

-- Uptown Porchfest 8/15 pair
update events set status = 'archived' where id in ('1491a285-42ba-430c-bc6f-43bc811945b5');

-- Veg Fest pair
update events set status = 'archived' where id in ('760cf91b-e5c1-4b89-bae2-130c8083bb21');

-- Waiting for Godot pair
update events set status = 'archived' where id in ('bd265531-ae73-4783-aa44-1d8064b4066c');

-- Woodbury Days / Taste 8/21 pair
update events set status = 'archived' where id in ('d283482c-93e5-4f7b-bc71-f69c0a3f83b0');

-- Forrest Frank exact pair (miscategorized sports - 4.1's problem, not today's)
update events set status = 'archived' where id in ('887d4bf1-4630-40eb-bd1f-95298fd5ed60');

-- Megan Moroney exact pair
update events set status = 'archived' where id in ('9f5060dd-bc0a-441c-9994-19f27357d9e5');

-- Melanie Martinez exact pair
update events set status = 'archived' where id in ('2626989a-ef44-4abb-af47-d16b2e4f2e9e');

-- Indiana Fever at Lynx exact pair
update events set status = 'archived' where id in ('0cec69c3-fe94-4394-a45d-01669b310a2c');

-- LA Sparks at Lynx 7/15 exact pair
update events set status = 'archived' where id in ('1122635c-ee3c-485f-8798-db15099b2ac5');

-- Toronto Tempo exact pair
update events set status = 'archived' where id in ('481ce33e-128a-4cb5-a3b2-52bf96271c7d');

-- Gophers vs E. Illinois pair
update events set status = 'archived' where id in ('8405127d-f65a-4aec-9ec2-85e65c73a03a');

-- Gophers vs Mississippi St pair
update events set status = 'archived' where id in ('65b91ad0-2f05-49f9-9e98-34daa7e4a1cb');

-- MNUFC vs Atlanta x3 same night
update events set status = 'archived' where id in ('100888ca-ede1-4070-9788-31ad7df7b36d', '10a13ff6-7f3e-4e1e-994d-7d7cef7eeb5e');

-- MNUFC vs Dallas pair
update events set status = 'archived' where id in ('af0a314a-636a-4637-b2ca-deb98a9ef9f4');

-- MNUFC vs Orlando pair
update events set status = 'archived' where id in ('81931dc7-0fbc-4dad-a861-9c401ea4c473');

-- MNUFC 8/11 placeholder pair
update events set status = 'archived' where id in ('390ad76c-1faf-4374-84c8-23ac157cc158');

-- MNUFC 9/19 (nonsense 'away - Home' row)
update events set status = 'archived' where id in ('4d92555d-f6fb-48c9-a742-b2b0e4678f84');

-- Saints 9/8: 07:05 'Home Game' = shifted dup of Syracuse G1
update events set status = 'archived' where id in ('9668dfda-74cd-43b8-a64c-3cbdf0dcf706');

-- Twins vs Braves 8/18 pair (giveaway-title row)
update events set status = 'archived' where id in ('15a096fb-b04b-4d6d-bc20-f8365dffefe4');

-- Monster Jam Sat-evening 18:00/19:00 dup
update events set status = 'archived' where id in ('2abc195f-7e2e-4cbc-9a34-2e522385f52f');

-- Lynx 7/13: placeholders vs real Phoenix game
update events set status = 'archived' where id in ('09688193-6d06-4a8d-a979-5e74dfd0432f', '91cf6a73-356d-47d4-963d-cf80379940fc');

-- Lynx 7/18: placeholder + reversed-title row vs real Portland game
update events set status = 'archived' where id in ('08d0f2fd-e8db-465e-b002-30b0b9e3e1b2', '2a852ab5-dd1e-4417-83ef-f74502b1da75');

-- Junk rows (not events)
-- Closed for Private Event — not a public event
update events set status = 'archived' where id = 'cf29069c-10b8-42b4-9cd4-4ca5e4ca94f9';
-- Lynx 'WNBA Playoffs (if applicable)' — speculative placeholder
update events set status = 'archived' where id = '66038fbe-bcad-448b-965d-eb4e19db9920';

-- Known runs already stored as single rows - just set their end dates
-- MSP Magazine Restaurant Week runs through Jul 19
update events set multi_day_end = ('2026-07-19T21:00'::timestamp at time zone 'America/Chicago') where id = 'cd88622a-7fc7-4571-9f4e-42eff1c744cc';
-- Como Summer Flower Show — end from its own title
update events set multi_day_end = ('2026-09-22T18:00'::timestamp at time zone 'America/Chicago') where id = 'cfd6ce5a-c678-460a-bfed-c6871755d7b1';

-- Count check: rows now archived from this operation (EXPECT 159;
-- fewer means some ids didn't match - compare with STEP 0 output)
select count(*) as archived_now_should_be_159
from events
where status = 'archived' and id in (
  'caff0b53-d3ee-4025-ab4a-abee1097e482', '90b64201-23e1-453b-985a-8fad8b72ab25', '74e75c1b-a7f4-4fff-9852-1c091ee697f8', '9864eb14-e5c0-466c-99c6-9eabbf5f28ae', 'a0036ddf-8acc-46de-8685-93d57599467f', '90b5b88d-25d2-4376-be23-8833013a0ec8', '1378c773-8839-4b18-9cfd-46d66ff08966', '3379a542-bfc1-4807-b79a-cb541c4e19c4', 'a63880b9-f0ae-4e4d-a731-150a39009aa2', 'f085eada-bb24-410a-a88a-6892a0b9aff4', '26124c75-f722-42c4-9de8-2e0bff57974f', '51301ea2-abb4-432c-a00c-7846ec26aa16', '312ee15e-9362-4939-96f3-37d26709b299', '416e242b-c1e7-4f71-a54c-8474626f65ae', 'e50514ea-f703-4f5b-945e-5fea25171cd2', '3f8707d2-66d3-4ca3-a2fd-c0fe22968ca6', '07b21c6d-847b-441c-9140-ef26cdf95ac9', '9d7120da-89c1-4cc0-bc07-21d57caa27a3', '1f4549f0-575f-427e-8525-3587b82422e9', '916b05d6-0a04-454a-88f8-d22a680077a2', '537acf1f-2fec-4fc1-b91f-17cb0da8f149', '22da2167-c838-4551-b2f1-2a295ddb1e19', '4fb674dd-b47b-4166-b1ff-04e74db468d3', '6dd0a81f-ff7f-4c90-ba97-2eb5d9178518', '5d5bf5da-d8ec-4c45-86b4-fa4d32c9c6dd', '2b5e7bc0-4b58-417d-9ae6-6d568c9a2f52', 'cd44ba23-68fe-4c89-8661-3bf6076f31b6', 'e29534d0-e986-4e4a-be63-a6cb308ad11e', 'fdd521d4-822c-4ded-b96e-1879dd5bb4b9', '56c69366-01b1-415b-a586-b3725e8c1a17', 'ed84f5e8-411e-474b-b8e8-68521183bc64', '50ee5258-335e-4c60-933f-9434d3c850de', '29dc28a5-1123-4364-975d-4b2d8e34d49c', '4837dc56-7abe-441d-99fc-aba5e41ce9b4', 'e78cd3db-5fcd-4416-8977-02024636cbd9', '827ede61-e30d-40e4-87c9-e34f47b07c88', '3550621e-29fb-4c3c-a8de-dcd8dd9cbef9', '9d6700f5-ff6e-4a93-be4f-3107222bfbc8', '59c9c8ec-57d9-473f-9f53-d1b4e70a66d1', 'ecef318a-1f1e-40cf-a043-e4c277a43898', 'c7f2d163-28b2-4612-b0ad-55900905fcc0', '48c1035f-2d10-40e4-a6f1-d88aebf45c56', 'a971dc5e-ed09-42a9-9af5-408bf91a3b45', 'f31e18bd-2278-493e-ba43-bfb3efc52fa6', '3fbff40b-4fbb-4e1d-bde6-3dbc15e9de00', '88cc1903-b2fe-4f3b-babc-8f09a6f2358b', 'c472f444-1f4a-455d-abc6-bbe18c55e6b5', 'b80e926b-3647-49d0-aeb7-dded8e0424ed', '86f8702e-dd3f-49f9-9caf-c1eed805aae2', 'b5bca185-41bd-4b4e-8d02-0c9eb8d23a83', '58e53e40-a766-4359-b9e3-50d1027fe88b', '5a4d6c6c-34fa-4ade-8165-cc410aae9eb6', '8f96d231-6458-4237-a2d1-f212f6dc7d68', '39eb2899-8aba-44bb-8b63-8f71120bef3c', 'd1b5f7f0-37e9-4cef-b1a9-9eb64d1e6de4', '06ad2ffa-1d85-4c05-a9af-30ac6db3f336', '2a551476-985a-4848-975e-854cee3d6a99', 'af40ded7-5086-4c29-8cb2-9f65ab57d5d0', 'b47de206-de41-449a-b9b1-726a85eed75e', '16179e6b-9b18-4ede-a57d-1e722b432a06', '395beb35-170d-4d02-a55e-d1cc61ccec99', '265514bb-800a-48b0-968b-9b0263ae77d0', 'e6ab9ce2-576a-42fe-a19f-3ced836e3eaa', '3308f3f1-67cb-4f76-9fce-29b461710674', '785657c7-b314-4978-bbad-3ef5b5da8ca8', '877024e6-a656-4c3c-a0ac-10efd8f21932', '96be843f-411f-4d65-89a1-03f265f1bc3d', '66f209b8-4cf6-4ae4-b4a7-661b79493771', 'e23c01bf-7a86-478e-a20c-74b4942ae6f0', '5c31f268-12a1-4cab-9394-634c1e96adcc', '29741ee3-d84f-49e9-a25b-336ec427cf37', 'fa1950a7-028e-4cbe-9044-7d01b71fa7df', 'cc21f064-3a43-4986-aadb-3d360f59441b', '581a281c-d526-4039-927c-06df074e3973', '7d6d19a3-e50b-42d4-b4bc-c8278982fcac', 'fe43b39a-dc61-4440-81ee-fe691ae33d6f', 'd9acbb1d-709e-46b8-af00-1c78f3629005', '6d439aba-375f-4086-9a8d-f3c71bb094ad', '7880da99-db44-493e-b48e-51de08dd4642', '0cc6d2be-2b98-4444-b3ac-2e6f0fe68d27', '2d483948-8f54-43c5-9d7e-7e32eda25509', 'fc96586b-d863-43f3-b78e-f837727fc28e', '8367ca6f-19e7-45a8-ac2a-d9b37dd444e9', '0d2a235f-75ef-4b8e-b888-2e4c4d7161b4', '79b04ad4-dba0-451c-93eb-7a8b373cf5f5', '37a67ed9-71d9-4448-899e-726f2e100524', '79c03769-a979-4b7e-940c-4c363f661f65', 'e50e28bf-d183-4703-a34c-ed87a60bed22', '9bc32ab9-2c99-4315-86b6-c761b755ba71', 'f7bad414-4fa1-47d9-ade9-4a1dbcc1efce', '386e51eb-f155-419d-8ed3-97baa2899dc7', '4d4cc60b-0488-4627-ac1e-37e2465882a6', '4fa8a9f0-0c43-4f0e-a905-afead9e52f12', 'cb3c0f0a-3bb1-4a8d-87b9-9ebcc3491468', 'c611a93f-1f9a-4305-8bc3-d9cbe92583ff', '99f00e39-5b8c-4520-96e1-8320fa1443d6', '2b3648be-090f-43c5-aff5-7aa9087925fa', '1ac5403d-5e80-4cb0-b521-d409e79ddb8e', '5d851d03-3652-44f5-95f1-019f5e7cd902', 'eada41a8-d147-456f-be8b-786929b1461e', '7045f549-295a-4eeb-9b11-12b647d46e16', 'f3afbf99-d801-45de-bd47-5799676894c1', '1ecd82e0-785b-4957-a3c3-04e9fcd9c93e', '79ed6271-0af9-42f9-bf38-bdf910a76de8', 'c3451c1d-2315-4516-9264-3222a9ece9a0', '166bce24-c7e6-4572-9460-bc3f79ad9816', '63ad39bc-ea93-4277-94e7-037a05fa4f98', '05955fa5-874c-4f26-8106-1114d72dd27c', '5e5b3572-8d3a-483a-b7fd-a9fd44be9318', '6e980724-f44e-45f0-99f6-1293e1bc744b', 'e4ea1de8-fc6f-4da3-b2be-33144fbc76fb', 'a121eb75-fe12-4257-b761-e652eb2ac9de', '87b3b8fa-f379-4617-b828-1b23f51150e0', 'e9668857-00e9-42b8-a13b-0e0f99620579', 'da40a8d9-ad0c-4d61-8cb3-24931401f8ea', '75e0dd97-5a6e-4c32-b0a3-567446347757', '4d65b4c5-8e0c-4dc0-8141-d43034317e6d', '45f3a562-a958-4524-997f-c7f8276dcb68', '1963f428-9340-4439-b214-f1794f9e2f93', '7984d75b-ef20-4678-8546-1cf8b5232643', 'dff9be38-dbc3-425a-9592-495bc7e14ac4', 'f23dd515-402d-47ad-a78d-c8fdd7e992a9', 'd920bd08-be42-45a0-bf19-50627b1514b1', 'e17c709a-f910-4a2b-8de6-9fe8406c53e1', '22b3d625-e319-4bbd-ac61-093dcb5232fc', '01f29e87-ce70-44f5-809d-4c84612b1e90', '19409bbb-9fcd-4b04-bf58-723c177e2951', 'b000ee08-2780-44f1-9e43-2471daf11b8a', 'e8a74c3c-37d7-4b2d-98ea-e4a1d48f71e8', '44a7bbe9-b023-47bd-8d64-a53a64875be6', 'fed5cfcc-3762-4516-8967-478069756981', 'ad0c1ab5-6e91-4709-b7b7-47646497d45a', '1491a285-42ba-430c-bc6f-43bc811945b5', '760cf91b-e5c1-4b89-bae2-130c8083bb21', 'bd265531-ae73-4783-aa44-1d8064b4066c', 'd283482c-93e5-4f7b-bc71-f69c0a3f83b0', '887d4bf1-4630-40eb-bd1f-95298fd5ed60', '9f5060dd-bc0a-441c-9994-19f27357d9e5', '2626989a-ef44-4abb-af47-d16b2e4f2e9e', '0cec69c3-fe94-4394-a45d-01669b310a2c', '1122635c-ee3c-485f-8798-db15099b2ac5', '481ce33e-128a-4cb5-a3b2-52bf96271c7d', '8405127d-f65a-4aec-9ec2-85e65c73a03a', '65b91ad0-2f05-49f9-9e98-34daa7e4a1cb', '100888ca-ede1-4070-9788-31ad7df7b36d', '10a13ff6-7f3e-4e1e-994d-7d7cef7eeb5e', 'af0a314a-636a-4637-b2ca-deb98a9ef9f4', '81931dc7-0fbc-4dad-a861-9c401ea4c473', '390ad76c-1faf-4374-84c8-23ac157cc158', '4d92555d-f6fb-48c9-a742-b2b0e4678f84', '9668dfda-74cd-43b8-a64c-3cbdf0dcf706', '15a096fb-b04b-4d6d-bc20-f8365dffefe4', '2abc195f-7e2e-4cbc-9a34-2e522385f52f', '09688193-6d06-4a8d-a979-5e74dfd0432f', '91cf6a73-356d-47d4-963d-cf80379940fc', '08d0f2fd-e8db-465e-b002-30b0b9e3e1b2', '2a852ab5-dd1e-4417-83ef-f74502b1da75', 'cf29069c-10b8-42b4-9cd4-4ca5e4ca94f9', '66038fbe-bcad-448b-965d-eb4e19db9920'
);

commit;

-- ============================================================
-- ROLLBACK (only if needed - restores every touched row exactly)
-- ============================================================
-- begin;
-- update events e set status = b.status, start_at = b.start_at, multi_day_end = b.multi_day_end
-- from collapse_backup_20260716 b where e.id = b.id;
-- commit;