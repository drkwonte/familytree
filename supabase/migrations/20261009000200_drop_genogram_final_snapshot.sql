-- Saving is a single action now: the editor writes `graph` and nothing else.
-- The separate "최종 저장" snapshot no longer exists, so its columns go too.
alter table public.genograms
  drop constraint if exists genograms_final_graph_shape,
  drop constraint if exists genograms_final_complete,
  drop constraint if exists genograms_final_svg_size,
  drop column if exists final_graph,
  drop column if exists final_svg,
  drop column if exists finalized_at;

comment on column public.genograms.revision is
  'Bumped on every update; a save only applies when it carries the revision it loaded.';
