alter table factory.intake drop constraint if exists intake_source_check;
alter table factory.intake add constraint intake_source_check
  check (source = any (array['csv','cli','admin','sentinel','promotion','repair']));
